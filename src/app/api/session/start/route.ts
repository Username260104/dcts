import { NextRequest, NextResponse } from 'next/server';
import { analyzeInitialFeedback } from '@/lib/llmOrchestrator';
import { matchTrigger } from '@/lib/triggerMatcher';
import { createInitialState, getNextQuestion } from '@/lib/questionEngine';
import type {
    StartSessionRequest,
    StartSessionResponse,
    SessionState,
    LLMInitialAnalysis,
} from '@/types/ontology';

// 세션 ID 생성 (nanoid 대신 간단한 UUID)
function generateSessionId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// LLM 타임아웃 (5초)
const LLM_TIMEOUT_MS = 5000;

export async function POST(request: NextRequest) {
    try {
        const body: StartSessionRequest = await request.json();

        if (!body.feedbackText || body.feedbackText.trim().length === 0) {
            return NextResponse.json(
                { error: '피드백 텍스트를 입력해주세요.' },
                { status: 400 }
            );
        }

        const sessionId = generateSessionId();

        // LLM 호출 (타임아웃 포함)
        let analysis: LLMInitialAnalysis;
        let usedFallback = false;

        try {
            const llmPromise = analyzeInitialFeedback(body.feedbackText, body.context);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
            );

            analysis = await Promise.race([llmPromise, timeoutPromise]);
        } catch {
            // LLM 실패 시 정적 트리 fallback
            usedFallback = true;
            const triggerResult = matchTrigger(body.feedbackText);
            const candidateBranches = triggerResult.candidateBranches;

            // 정적 엔진으로 첫 질문 생성
            const staticState = createInitialState(candidateBranches, body.context);
            const firstQuestion = getNextQuestion(staticState);

            analysis = {
                feedbackType: triggerResult.trigger?.type ?? 'ambiguous',
                axis: triggerResult.trigger?.axis ?? '미정',
                candidates: candidateBranches,
                eliminated: [],
                question: firstQuestion?.text ?? triggerResult.trigger?.entryQuestion ?? '어떤 방향으로 수정하고 싶으세요?',
                options: firstQuestion?.options.map((opt) => ({
                    label: opt.label,
                    direction: opt.branchIds.join(','),
                })) ?? [],
            };
        }

        // 세션 상태 구성
        const sessionState: SessionState = {
            sessionId,
            originalFeedback: body.feedbackText,
            feedbackType: analysis.feedbackType,
            userContext: body.context,
            candidates: analysis.candidates,
            eliminated: analysis.eliminated,
            answerHistory: [],
            questionCount: 0,
            converged: false,
        };

        const response: StartSessionResponse & { usedFallback: boolean } = {
            sessionId,
            initialAnalysis: analysis,
            sessionState,
            usedFallback,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] session/start 에러:', error);
        return NextResponse.json(
            { error: '세션 시작 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
