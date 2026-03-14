import { NextRequest, NextResponse } from 'next/server';
import { generateFollowUp } from '@/lib/llmOrchestrator';
import { submitAnswer as staticSubmitAnswer, getNextQuestion, isConverged, getResult } from '@/lib/questionEngine';
import type {
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SessionState,
    LLMFollowUpResponse,
    LLMAnswerRecord,
    QuestionEngineState,
} from '@/types/ontology';

// LLM 타임아웃 (5초)
const LLM_TIMEOUT_MS = 5000;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await params;
        const body = await request.json() as SubmitAnswerRequest & { sessionState: SessionState };

        if (!body.sessionState) {
            return NextResponse.json(
                { error: '세션 상태가 필요합니다.' },
                { status: 400 }
            );
        }

        const { sessionState } = body;

        // 현재 답변을 이력에 추가 (ISSUE 4b: 프론트에서 전달받은 질문 텍스트 사용)
        const newRecord: LLMAnswerRecord = {
            question: body.currentQuestion ?? '',
            options: body.currentOptions ?? [],
            selectedLabel: body.selectedLabel,
            selectedDirection: body.selectedDirection,
        };

        const updatedState: SessionState = {
            ...sessionState,
            answerHistory: [...sessionState.answerHistory, newRecord],
            questionCount: sessionState.questionCount + 1,
        };

        // LLM 호출
        let followUp: LLMFollowUpResponse;
        let usedFallback = false;

        try {
            const llmPromise = generateFollowUp(updatedState);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
            );

            followUp = await Promise.race([llmPromise, timeoutPromise]);
        } catch {
            // ISSUE 1 핵심 수정: 기존 세션 상태에서 QuestionEngineState 재구성
            usedFallback = true;

            const reconstructedState: QuestionEngineState = {
                remainingCandidates: updatedState.candidates,
                eliminated: updatedState.eliminated,
                answerHistory: updatedState.answerHistory.map((a) => ({
                    questionText: a.question,
                    answerLabel: a.selectedLabel,
                    eliminatedBranches: [],
                    remainingBranches: updatedState.candidates,
                })),
                confidence: 0,
                questionCount: updatedState.questionCount,
                neitherCount: 0, // fallback 전환 시 보수적으로 리셋
            };

            // 현재 답변을 정적 엔진으로 처리 시도
            const currentQ = getNextQuestion(reconstructedState);
            let postAnswerState = reconstructedState;

            if (currentQ) {
                // 선택한 label과 매칭되는 option 찾기
                const matchedIdx = currentQ.options.findIndex(
                    (opt) => opt.label === body.selectedLabel
                );
                if (matchedIdx >= 0) {
                    postAnswerState = staticSubmitAnswer(reconstructedState, currentQ, matchedIdx);
                }
            }

            // 다음 질문 생성
            const nextQ = getNextQuestion(postAnswerState);
            const converged = isConverged(postAnswerState) || !nextQ;

            if (converged) {
                const result = getResult(postAnswerState);
                followUp = {
                    eliminatedNow: postAnswerState.eliminated.filter(
                        (id) => !updatedState.eliminated.includes(id)
                    ),
                    eliminationReason: 'fallback 수렴',
                    candidates: postAnswerState.remainingCandidates,
                    converged: true,
                    primaryBranch: result.primaryBranch || postAnswerState.remainingCandidates[0],
                    secondaryBranch: result.secondaryBranch,
                    reasoning: '정적 트리 기반 수렴',
                };
            } else {
                followUp = {
                    eliminatedNow: postAnswerState.eliminated.filter(
                        (id) => !updatedState.eliminated.includes(id)
                    ),
                    eliminationReason: '',
                    candidates: postAnswerState.remainingCandidates,
                    converged: false,
                    question: nextQ.text,
                    options: nextQ.options.map((opt) => ({
                        label: opt.label,
                        direction: opt.branchIds.join(','),
                    })),
                };
            }
        }

        // 세션 상태 갱신
        const finalState: SessionState = {
            ...updatedState,
            candidates: followUp.candidates,
            eliminated: [
                ...updatedState.eliminated,
                ...followUp.eliminatedNow,
            ],
            converged: followUp.converged,
            primaryBranch: followUp.primaryBranch,
            secondaryBranch: followUp.secondaryBranch,
            reasoning: followUp.reasoning,
        };

        const response: SubmitAnswerResponse & { usedFallback: boolean } = {
            sessionState: finalState,
            converged: followUp.converged,
            usedFallback,
        };

        if (!followUp.converged && followUp.question && followUp.options) {
            response.nextQuestion = {
                question: followUp.question,
                options: followUp.options,
            };
        }

        if (followUp.converged) {
            response.result = {
                primaryBranch: followUp.primaryBranch || finalState.candidates[0] || '',
                secondaryBranch: followUp.secondaryBranch ?? null,
                reasoning: followUp.reasoning || '',
            };
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] session/answer 에러:', error);
        return NextResponse.json(
            { error: '답변 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
