import { NextRequest, NextResponse } from 'next/server';
import { analyzeInitialFeedback } from '@/lib/llmOrchestrator';
import { matchTrigger } from '@/lib/triggerMatcher';
import { createInitialState, getNextQuestion } from '@/lib/questionEngine';
import type {
    LLMInitialAnalysis,
    SessionState,
    StartSessionRequest,
    StartSessionResponse,
} from '@/types/ontology';

function generateSessionId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? '15000');

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

        let analysis: LLMInitialAnalysis;
        let usedFallback = false;

        try {
            const llmPromise = analyzeInitialFeedback(body.feedbackText, body.context);
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
                    ? `클라이언트는 "${body.feedbackText}"라는 표현으로 ${triggerResult.trigger.axis} 축의 방향 차이를 더 분명히 하려고 합니다.`
                    : `클라이언트는 "${body.feedbackText}"라는 표현으로 현재 시안의 방향을 더 분명하게 설명하려고 합니다.`,
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
        };

        const response: StartSessionResponse & { usedFallback: boolean } = {
            sessionId,
            initialAnalysis: analysis,
            sessionState,
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
