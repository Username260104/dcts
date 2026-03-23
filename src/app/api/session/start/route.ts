import { NextRequest, NextResponse } from 'next/server';
import {
    analyzeClientFeedback,
    extractStrategySchema,
    generateStrategyGapQuestion,
} from '@/lib/llmOrchestrator';
import { matchTrigger } from '@/lib/triggerMatcher';
import { createInitialState, getNextQuestion } from '@/lib/questionEngine';
import type {
    InputRole,
    JobType,
    LLMInitialAnalysis,
    SessionState,
    StartSessionRequest,
    StartSessionResponse,
    StrategyGapResult,
    StrategyReadyResult,
    UserContext,
    WorkflowQuestion,
} from '@/types/ontology';

function generateSessionId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? '15000');

function buildStrategistInput(feedbackText: string, context: UserContext): string {
    const parts = [feedbackText];
    if (context.brandDescription) parts.push(`브랜드: ${context.brandDescription}`);
    if (context.positioningNote) parts.push(`포지셔닝: ${context.positioningNote}`);
    if (context.additionalContext) parts.push(`추가 맥락: ${context.additionalContext}`);
    return parts.join('\n');
}

function resolveJobType(inputRole: InputRole, requestedJobType?: JobType): JobType {
    if (requestedJobType) {
        return requestedJobType;
    }

    return inputRole === 'strategist'
        ? 'strategy_to_design_translation'
        : 'client_feedback_interpretation';
}

function buildClientQuestion(analysis: LLMInitialAnalysis): WorkflowQuestion {
    return {
        question: analysis.question,
        options: analysis.options,
        type: analysis.options.length === 0 ? 'free_text' : 'text_choice',
        meta: {
            lane: 'client_feedback_interpretation',
            questionKind: 'interpretation',
        },
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: StartSessionRequest = await request.json();

        if (!body.feedbackText || body.feedbackText.trim().length === 0) {
            return NextResponse.json(
                { error: '피드백을 입력해 주세요.' },
                { status: 400 }
            );
        }

        const sessionId = generateSessionId();
        const inputRole: InputRole = body.inputRole ?? 'client';
        const jobType = resolveJobType(inputRole, body.jobType);

        if (jobType === 'strategy_to_design_translation') {
            const strategyState = await extractStrategySchema(body.feedbackText, body.context);
            const nextQuestion = strategyState.readinessStatus === 'ready'
                ? null
                : generateStrategyGapQuestion(strategyState);

            const sessionState: SessionState = {
                sessionId,
                jobType,
                originalFeedback: body.feedbackText,
                userContext: body.context,
                strategyArtifactType: strategyState.artifactType,
                strategyState,
                candidates: [],
                eliminated: [],
                answerHistory: [],
                questionCount: 0,
                converged: !nextQuestion,
                detailQuestionCount: 0,
                detailFocusHistory: [],
                pendingRefinement: false,
                inputRole,
            };

            const response: StartSessionResponse = {
                sessionId,
                sessionState,
                nextQuestion: nextQuestion ?? undefined,
                converged: !nextQuestion,
                result: nextQuestion
                    ? undefined
                    : strategyState.readinessStatus === 'ready'
                        ? {
                            kind: 'strategy_ready',
                            summary: strategyState.summary ?? '',
                            strategyState,
                        } satisfies StrategyReadyResult
                        : {
                            kind: 'strategy_gap',
                            summary: strategyState.summary ?? '',
                            strategyState,
                        } satisfies StrategyGapResult,
                debugState: nextQuestion
                    ? { questionSource: 'deterministic' }
                    : { resultSource: 'hybrid' },
                usedFallback: false,
            };

            return NextResponse.json(response);
        }

        const feedbackForAnalysis = inputRole === 'strategist'
            ? buildStrategistInput(body.feedbackText, body.context)
            : body.feedbackText;

        let analysis: LLMInitialAnalysis;
        let usedFallback = false;

        try {
            const llmPromise = analyzeClientFeedback(feedbackForAnalysis, body.context, inputRole);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
            );

            analysis = await Promise.race([llmPromise, timeoutPromise]);
            console.info('[LLM] session/start succeeded', { sessionId, timeoutMs: LLM_TIMEOUT_MS });
        } catch (error) {
            usedFallback = true;
            console.warn('[LLM] session/start fallback', {
                sessionId,
                timeoutMs: LLM_TIMEOUT_MS,
                reason: error instanceof Error ? error.message : String(error),
            });

            const triggerResult = matchTrigger(body.feedbackText);
            const staticState = createInitialState(triggerResult.candidateBranches, body.context);
            const firstQuestion = getNextQuestion(staticState);

            analysis = {
                feedbackType: triggerResult.trigger?.type ?? 'ambiguous',
                axis: triggerResult.trigger?.axis ?? '미정',
                intentInterpretation: triggerResult.trigger
                    ? `클라이언트는 "${body.feedbackText}"라는 표현으로 ${triggerResult.trigger.axis} 축의 방향 차이를 더 분명하게 설명하려고 합니다.`
                    : `클라이언트는 "${body.feedbackText}"라는 표현으로 현재 시안의 방향성을 더 분명하게 설명하려고 합니다.`,
                uncertainAspects: [
                    triggerResult.trigger?.axis || '어떤 방향 차이가 가장 중요한지',
                ],
                candidates: staticState.remainingCandidates,
                eliminated: [],
                question:
                    firstQuestion?.text ??
                    triggerResult.trigger?.entryQuestion ??
                    '어떤 방향으로 조정하면 좋을지 조금만 더 설명해 주세요.',
                options:
                    firstQuestion?.options.map((option) => ({
                        label: option.label,
                        direction: option.branchIds.join(','),
                    })) ?? [],
            };
        }

        const sessionState: SessionState = {
            sessionId,
            jobType,
            originalFeedback: body.feedbackText,
            feedbackType: analysis.feedbackType,
            intentInterpretation: analysis.intentInterpretation,
            uncertainAspects: analysis.uncertainAspects,
            userContext: body.context,
            candidates: analysis.candidates,
            eliminated: analysis.eliminated,
            answerHistory: [],
            questionCount: 0,
            converged: false,
            detailQuestionCount: 0,
            detailFocusHistory: [],
            pendingRefinement: false,
            inputRole,
        };

        const response: StartSessionResponse = {
            sessionId,
            initialAnalysis: analysis,
            sessionState,
            nextQuestion: buildClientQuestion(analysis),
            converged: false,
            debugState: {
                questionSource: usedFallback ? 'fallback' : 'language_model',
            },
            usedFallback,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] session/start error:', error);
        return NextResponse.json(
            { error: '세션 시작 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
