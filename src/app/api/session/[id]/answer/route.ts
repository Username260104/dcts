import { NextRequest, NextResponse } from 'next/server';
import { DETAIL_QUESTION_TARGET } from '@/lib/constants';
import { generateDetailQuestion, generateFollowUp } from '@/lib/llmOrchestrator';
import { createQuestionPayload, reconstructQuestionState } from '@/lib/sessionFlow';
import {
    getBranchById,
    getNextQuestion,
    getResult,
    isConverged,
    submitAnswer as submitStaticAnswer,
} from '@/lib/questionEngine';
import type {
    LLMAnswerRecord,
    LLMFollowUpResponse,
    SessionState,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
} from '@/types/ontology';

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? '15000');
const DETAIL_FOCUS_SEQUENCE = ['color', 'typography', 'layout', 'imagery', 'texture'] as const;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
    );

    return Promise.race([promise, timeoutPromise]);
}

function shouldAskDetailQuestion(sessionState: SessionState, followUp: LLMFollowUpResponse): boolean {
    const detailQuestionCount = sessionState.detailQuestionCount ?? 0;
    return Boolean(
        followUp.converged &&
        followUp.primaryBranch &&
        detailQuestionCount < DETAIL_QUESTION_TARGET
    );
}

function getNextDetailFocus(sessionState: SessionState): string {
    const usedFocuses = sessionState.detailFocusHistory ?? [];
    return DETAIL_FOCUS_SEQUENCE.find((focus) => !usedFocuses.includes(focus)) ?? 'layout';
}

function createStaticDetailFollowUp(sessionState: SessionState): LLMFollowUpResponse {
    const primaryBranch = sessionState.primaryBranch
        ? getBranchById(sessionState.primaryBranch)
        : null;
    const nextFocus = getNextDetailFocus(sessionState);

    if (!primaryBranch) {
        throw new Error('Primary branch is required for detail fallback');
    }

    if (nextFocus === 'color') {
        return {
            eliminatedNow: [],
            eliminationReason: 'detail refinement',
            candidates: sessionState.candidates,
            converged: false,
            type: 'text_choice',
            detailFocus: 'color',
            question: '지금 방향을 유지한다면 색감은 어느 쪽이 더 맞을까요?',
            options: [
                { label: '채도는 절제하고 톤을 정돈하는 쪽이 좋아요.', direction: 'detail:color-restrained' },
                { label: '색 대비를 조금 더 살려서 인상을 남기는 쪽이 좋아요.', direction: 'detail:color-contrast' },
                { label: '아직은 잘 모르겠어요.', direction: 'detail:unclear' },
            ],
            primaryBranch: sessionState.primaryBranch,
            secondaryBranch: sessionState.secondaryBranch ?? null,
            reasoning: sessionState.reasoning,
        };
    }

    if (nextFocus === 'typography') {
        return {
            eliminatedNow: [],
            eliminationReason: 'detail refinement',
            candidates: sessionState.candidates,
            converged: false,
            type: 'text_choice',
            detailFocus: 'typography',
            question: '문구가 보이는 방식은 어느 쪽이 더 어울릴까요?',
            options: [
                { label: '차분하고 정돈된 글자 느낌이 좋아요.', direction: 'detail:type-refined' },
                { label: '조금 더 존재감 있고 인상이 남는 글자 느낌이 좋아요.', direction: 'detail:type-expressive' },
                { label: '아직은 잘 모르겠어요.', direction: 'detail:unclear' },
            ],
            primaryBranch: sessionState.primaryBranch,
            secondaryBranch: sessionState.secondaryBranch ?? null,
            reasoning: sessionState.reasoning,
        };
    }

    if (nextFocus === 'layout') {
        return {
            eliminatedNow: [],
            eliminationReason: 'detail refinement',
            candidates: sessionState.candidates,
            converged: false,
            type: 'text_choice',
            detailFocus: 'layout',
            question: '화면 구성은 어느 쪽이 더 맞을까요?',
            options: [
                { label: '여백을 두고 숨 쉬는 느낌이 있었으면 해요.', direction: 'detail:layout-airy' },
                { label: '정보가 조금 더 또렷하게 잡히는 구성이 좋아요.', direction: 'detail:layout-structured' },
                { label: '아직은 잘 모르겠어요.', direction: 'detail:unclear' },
            ],
            primaryBranch: sessionState.primaryBranch,
            secondaryBranch: sessionState.secondaryBranch ?? null,
            reasoning: sessionState.reasoning,
        };
    }

    if (nextFocus === 'imagery') {
        return {
            eliminatedNow: [],
            eliminationReason: 'detail refinement',
            candidates: sessionState.candidates,
            converged: false,
            type: 'text_choice',
            detailFocus: 'imagery',
            question: '사진이나 그래픽 무드는 어느 쪽이 더 가까울까요?',
            options: [
                { label: '조용하고 절제된 분위기가 좋아요.', direction: 'detail:image-calm' },
                { label: '조금 더 생생하고 존재감 있는 분위기가 좋아요.', direction: 'detail:image-vivid' },
                { label: '아직은 잘 모르겠어요.', direction: 'detail:unclear' },
            ],
            primaryBranch: sessionState.primaryBranch,
            secondaryBranch: sessionState.secondaryBranch ?? null,
            reasoning: sessionState.reasoning,
        };
    }

    return {
        eliminatedNow: [],
        eliminationReason: 'detail refinement',
        candidates: sessionState.candidates,
        converged: false,
        type: 'text_choice',
        detailFocus: 'texture',
        question: `${primaryBranch.branchLabel} 방향에서 마감감은 어느 쪽이 더 어울릴까요?`,
        options: [
            { label: '매끈하고 정제된 마감이 좋아요.', direction: 'detail:texture-clean' },
            { label: '조금 더 촉감이나 재질감이 느껴져도 좋아요.', direction: 'detail:texture-tactile' },
            { label: '아직은 잘 모르겠어요.', direction: 'detail:unclear' },
        ],
        primaryBranch: sessionState.primaryBranch,
        secondaryBranch: sessionState.secondaryBranch ?? null,
        reasoning: sessionState.reasoning,
    };
}

function appendDetailTracking(
    sessionState: SessionState,
    followUp: LLMFollowUpResponse,
    previousCount: number
): SessionState {
    if (followUp.converged || !followUp.question || !followUp.options) {
        return sessionState;
    }

    if (!sessionState.primaryBranch || previousCount >= DETAIL_QUESTION_TARGET) {
        return sessionState;
    }

    const nextFocus = followUp.detailFocus ?? getNextDetailFocus(sessionState);
    const detailFocusHistory = sessionState.detailFocusHistory ?? [];

    return {
        ...sessionState,
        detailQuestionCount: previousCount + 1,
        detailFocusHistory: detailFocusHistory.includes(nextFocus)
            ? detailFocusHistory
            : [...detailFocusHistory, nextFocus],
    };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;
        const body = await request.json() as SubmitAnswerRequest & { sessionState: SessionState };

        if (!body.sessionState) {
            return NextResponse.json(
                { error: '?紐꾨??怨밴묶揶쎛 ?袁⑹뒄??몃빍??' },
                { status: 400 }
            );
        }

        const newRecord: LLMAnswerRecord = {
            question: body.currentQuestion ?? '',
            options: body.currentOptions ?? [],
            selectedLabel: body.selectedLabel,
            selectedDirection: body.selectedDirection,
        };

        const updatedState: SessionState = {
            ...body.sessionState,
            answerHistory: [...body.sessionState.answerHistory, newRecord],
            questionCount: body.sessionState.questionCount + 1,
            detailQuestionCount: body.sessionState.detailQuestionCount ?? 0,
            detailFocusHistory: body.sessionState.detailFocusHistory ?? [],
            pendingRefinement: false,
        };

        let followUp: LLMFollowUpResponse;
        let usedFallback = false;

        try {
            if (
                updatedState.primaryBranch &&
                (updatedState.detailQuestionCount ?? 0) >= DETAIL_QUESTION_TARGET
            ) {
                followUp = {
                    eliminatedNow: [],
                    eliminationReason: 'detail refinement complete',
                    candidates: updatedState.candidates,
                    converged: true,
                    primaryBranch: updatedState.primaryBranch,
                    secondaryBranch: updatedState.secondaryBranch ?? null,
                    reasoning: updatedState.reasoning || '',
                };
            } else if (updatedState.primaryBranch) {
                followUp = await withTimeout(generateDetailQuestion(updatedState));
            } else {
                followUp = await withTimeout(generateFollowUp(updatedState));
            }

            console.info('[LLM] session/answer succeeded', {
                sessionId,
                timeoutMs: LLM_TIMEOUT_MS,
                questionCount: updatedState.questionCount,
            });
        } catch (error) {
            usedFallback = true;
            console.warn('[LLM] session/answer fallback', {
                sessionId,
                timeoutMs: LLM_TIMEOUT_MS,
                questionCount: updatedState.questionCount,
                reason: error instanceof Error ? error.message : String(error),
            });

            if (
                updatedState.primaryBranch &&
                (updatedState.detailQuestionCount ?? 0) < DETAIL_QUESTION_TARGET
            ) {
                followUp = createStaticDetailFollowUp(updatedState);
            } else {
                const reconstructed = reconstructQuestionState(updatedState);
                const currentQuestion = getNextQuestion({
                    ...reconstructed,
                    questionCount: Math.max(reconstructed.questionCount - 1, 0),
                });

                let postAnswerState = reconstructed;

                if (currentQuestion) {
                    const selectedIndex = currentQuestion.options.findIndex(
                        (option) => option.label === body.selectedLabel
                    );

                    if (selectedIndex >= 0) {
                        postAnswerState = submitStaticAnswer(reconstructed, currentQuestion, selectedIndex);
                    }
                }

                const nextQuestion = getNextQuestion(postAnswerState);

                if (!nextQuestion || isConverged(postAnswerState)) {
                    const result = getResult(postAnswerState);
                    followUp = {
                        eliminatedNow: postAnswerState.eliminated.filter(
                            (id) => !updatedState.eliminated.includes(id)
                        ),
                        eliminationReason: '?類ㅼ읅 筌욌뜄揆 ?遺우춭 野껉퀗???낅빍??',
                        candidates: postAnswerState.remainingCandidates,
                        converged: true,
                        primaryBranch: result.primaryBranch || postAnswerState.remainingCandidates[0],
                        secondaryBranch: result.secondaryBranch,
                        reasoning: '?類ㅼ읅 筌욌뜄揆 ?遺우춭??곗쨮 野껉퀗?든몴??類ㅼ젟??됰뮸??덈뼄.',
                    };
                } else {
                    followUp = {
                        eliminatedNow: postAnswerState.eliminated.filter(
                            (id) => !updatedState.eliminated.includes(id)
                        ),
                        eliminationReason: '',
                        candidates: postAnswerState.remainingCandidates,
                        converged: false,
                        ...createQuestionPayload(nextQuestion),
                    };
                }
            }
        }

        let finalState: SessionState = {
            ...updatedState,
            candidates: followUp.candidates,
            eliminated: [
                ...updatedState.eliminated,
                ...followUp.eliminatedNow.filter((id) => !updatedState.eliminated.includes(id)),
            ],
            converged: followUp.converged,
            primaryBranch: followUp.primaryBranch ?? updatedState.primaryBranch,
            secondaryBranch: followUp.secondaryBranch ?? updatedState.secondaryBranch,
            reasoning: followUp.reasoning ?? updatedState.reasoning,
        };

        if (shouldAskDetailQuestion(finalState, followUp)) {
            finalState = {
                ...finalState,
                converged: false,
                primaryBranch: followUp.primaryBranch,
                secondaryBranch: followUp.secondaryBranch,
                reasoning: followUp.reasoning,
            };

            try {
                followUp = await withTimeout(generateDetailQuestion(finalState));
            } catch {
                usedFallback = true;
                followUp = createStaticDetailFollowUp(finalState);
            }

            finalState = appendDetailTracking(
                {
                    ...finalState,
                    converged: false,
                },
                followUp,
                finalState.detailQuestionCount ?? 0
            );
        } else {
            finalState = appendDetailTracking(
                finalState,
                followUp,
                updatedState.detailQuestionCount ?? 0
            );
        }

        const response: SubmitAnswerResponse & { usedFallback: boolean } = {
            sessionState: finalState,
            converged: followUp.converged,
            usedFallback,
        };

        if (!followUp.converged && followUp.question && followUp.options) {
            response.nextQuestion = {
                question: followUp.question,
                options: followUp.options,
                type: followUp.options.length === 0 ? 'free_text' : followUp.type,
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
        console.error('[API] session/answer error:', error);
        return NextResponse.json(
            { error: '??? 筌ｌ꼶??餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' },
            { status: 500 }
        );
    }
}
