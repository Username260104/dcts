import { NextRequest, NextResponse } from 'next/server';
import { generateFollowUp } from '@/lib/llmOrchestrator';
import { createQuestionPayload, reconstructQuestionState } from '@/lib/sessionFlow';
import { getRefinementQuestion } from '@/lib/questionEngine';
import type {
    LLMFollowUpResponse,
    RefineSessionResponse,
    SessionState,
} from '@/types/ontology';

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? '15000');

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

        let followUp: LLMFollowUpResponse;
        let usedFallback = false;

        try {
            const llmPromise = generateFollowUp(baseState);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
            );

            followUp = await Promise.race([llmPromise, timeoutPromise]);
            console.info('[LLM] session/refine succeeded', {
                sessionId,
                timeoutMs: LLM_TIMEOUT_MS,
                questionCount: baseState.questionCount,
            });
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

            const sessionState: SessionState = {
                ...baseState,
                pendingRefinement: true,
            };

            const response: RefineSessionResponse = {
                sessionState,
                nextQuestion: createQuestionPayload(nextQuestion),
                usedFallback,
            };

            return NextResponse.json(response);
        }

        if (followUp.converged || !followUp.question || !followUp.options) {
            console.warn('[LLM] session/refine produced non-question response, using fallback question', {
                sessionId,
                converged: followUp.converged,
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
                nextQuestion: createQuestionPayload(nextQuestion),
                usedFallback: true,
            } satisfies RefineSessionResponse);
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
            },
            usedFallback,
        } satisfies RefineSessionResponse);
    } catch (error) {
        console.error('[API] session/refine error:', error);
        return NextResponse.json(
            { error: '추가 질문 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
