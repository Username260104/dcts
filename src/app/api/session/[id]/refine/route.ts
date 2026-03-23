import { NextRequest, NextResponse } from 'next/server';
import { generateClientFollowUp, generateStrategyGapQuestion } from '@/lib/llmOrchestrator';
import { createQuestionPayload, reconstructQuestionState } from '@/lib/sessionFlow';
import { getRefinementQuestion } from '@/lib/questionEngine';
import type {
    RefineSessionResponse,
    SessionState,
    StrategyGapResult,
    StrategyReadyResult,
} from '@/types/ontology';

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? '15000');

function buildStrategyResult(sessionState: SessionState): StrategyReadyResult | StrategyGapResult {
    if (!sessionState.strategyState) {
        throw new Error('Strategy state is required');
    }

    if (sessionState.strategyState.readinessStatus === 'ready') {
        return {
            kind: 'strategy_ready',
            summary: sessionState.strategyState.summary ?? '',
            strategyState: sessionState.strategyState,
        };
    }

    return {
        kind: 'strategy_gap',
        summary: sessionState.strategyState.summary ?? '',
        strategyState: sessionState.strategyState,
    };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;

        const body = await request.json() as { sessionState: SessionState };

        if (!body.sessionState) {
            return NextResponse.json(
                { error: '세션 상태가 필요합니다.' },
                { status: 400 }
            );
        }

        if (body.sessionState.jobType === 'strategy_to_design_translation') {
            const strategyState = body.sessionState.strategyState;

            if (!strategyState) {
                return NextResponse.json(
                    { error: '전략 상태가 필요합니다.' },
                    { status: 400 }
                );
            }

            const nextQuestion = generateStrategyGapQuestion(strategyState);
            const sessionState: SessionState = {
                ...body.sessionState,
                pendingRefinement: true,
                converged: !nextQuestion,
            };

            return NextResponse.json({
                sessionState,
                nextQuestion: nextQuestion ?? undefined,
                converged: !nextQuestion,
                result: nextQuestion ? undefined : buildStrategyResult(sessionState),
                debugState: nextQuestion
                    ? { questionSource: 'deterministic' }
                    : { resultSource: 'hybrid' },
                usedFallback: false,
            } satisfies RefineSessionResponse);
        }

        const baseState: SessionState = {
            ...body.sessionState,
            converged: false,
            detailQuestionCount: 0,
            detailFocusHistory: [],
            primaryBranch: undefined,
            secondaryBranch: undefined,
            reasoning: undefined,
            pendingRefinement: true,
        };

        let usedFallback = false;

        try {
            const llmPromise = generateClientFollowUp(baseState);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
            );

            const followUp = await Promise.race([llmPromise, timeoutPromise]);
            console.info('[LLM] session/refine succeeded', {
                sessionId,
                timeoutMs: LLM_TIMEOUT_MS,
                questionCount: baseState.questionCount,
            });

            if (followUp.converged || !followUp.question || !followUp.options) {
                throw new Error('Refine response did not produce a usable question');
            }

            return NextResponse.json({
                sessionState: {
                    ...baseState,
                    intentInterpretation: followUp.intentInterpretation ?? baseState.intentInterpretation,
                    uncertainAspects: followUp.uncertainAspects ?? baseState.uncertainAspects,
                    candidates: followUp.candidates,
                    eliminated: [
                        ...baseState.eliminated,
                        ...followUp.eliminatedNow.filter((id) => !baseState.eliminated.includes(id)),
                    ],
                    pendingRefinement: true,
                },
                nextQuestion: {
                    question: followUp.question,
                    options: followUp.options,
                    type: followUp.type ?? (followUp.options.length === 0 ? 'free_text' : 'text_choice'),
                    meta: {
                        lane: 'client_feedback_interpretation',
                        questionKind: 'interpretation',
                    },
                },
                debugState: { questionSource: 'language_model' },
                usedFallback,
            } satisfies RefineSessionResponse);
        } catch (error) {
            usedFallback = true;
            console.warn('[LLM] session/refine fallback', {
                sessionId,
                timeoutMs: LLM_TIMEOUT_MS,
                questionCount: baseState.questionCount,
                reason: error instanceof Error ? error.message : String(error),
            });

            const reconstructed = reconstructQuestionState(baseState);
            const nextQuestion = getRefinementQuestion(reconstructed);

            if (!nextQuestion) {
                return NextResponse.json(
                    { error: '추가 질문을 생성할 수 없습니다.' },
                    { status: 400 }
                );
            }

            return NextResponse.json({
                sessionState: baseState,
                nextQuestion: {
                    ...createQuestionPayload(nextQuestion),
                    meta: {
                        lane: 'client_feedback_interpretation',
                        questionKind: 'interpretation',
                    },
                },
                debugState: { questionSource: 'fallback' },
                usedFallback,
            } satisfies RefineSessionResponse);
        }
    } catch (error) {
        console.error('[API] session/refine error:', error);
        return NextResponse.json(
            { error: '추가 질문 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
