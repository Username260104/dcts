import branches from '@/data/branches.json';
import contextData from '@/data/context.json';
import type {
    AnswerRecord,
    Branch,
    ContextVariables,
    ConvergenceResult,
    Question,
    QuestionEngineState,
    UserContext,
} from '@/types/ontology';
import {
    BOOST_WEIGHT,
    CONVERGENCE_THRESHOLD,
    MAX_QUESTIONS,
    NEITHER_TO_FREE_TEXT,
    NEITHER_TO_IMAGE_AB,
    SUPPRESS_WEIGHT,
} from './constants';

const branchData = branches as Branch[];
const ctxData = contextData as ContextVariables;
const NEITHER_LABEL = '잘 모르겠어요';

export function getBranchById(id: string): Branch | undefined {
    return branchData.find((branch) => branch.branchId === id);
}

function applyContextWeights(candidateIds: string[], userContext: UserContext): string[] {
    const scores: Record<string, number> = {};

    candidateIds.forEach((id) => {
        scores[id] = 0;
    });

    const applyWeight = (
        variableMap: Record<string, { boost: string[]; suppress: string[] }>,
        selectedKey: string
    ) => {
        const option = variableMap[selectedKey];
        if (!option) return;

        option.boost.forEach((id) => {
            if (scores[id] !== undefined) {
                scores[id] += BOOST_WEIGHT;
            }
        });

        option.suppress.forEach((id) => {
            if (scores[id] !== undefined) {
                scores[id] += SUPPRESS_WEIGHT;
            }
        });
    };

    if (userContext.industry) applyWeight(ctxData.industry, userContext.industry);
    if (userContext.pricePosition) applyWeight(ctxData.pricePosition, userContext.pricePosition);
    if (userContext.projectStage) applyWeight(ctxData.projectStage, userContext.projectStage);
    if (userContext.targetAge) applyWeight(ctxData.targetAge, userContext.targetAge);

    return [...candidateIds].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
}

export function createInitialState(
    candidateBranchIds: string[],
    userContext: UserContext
): QuestionEngineState {
    return {
        remainingCandidates: applyContextWeights(candidateBranchIds, userContext),
        eliminated: [],
        answerHistory: [],
        confidence: 0,
        questionCount: 0,
        neitherCount: 0,
    };
}

function distinctionNeedScore(a: Branch, b: Branch): number {
    let score = 0;

    if (a.confusableBranches.includes(b.branchId)) score += 3;
    if (b.confusableBranches.includes(a.branchId)) score += 3;
    if (a.adjective === b.adjective) score += 2;

    return score;
}

function findBestContrastPair(candidateIds: string[]): [Branch, Branch] | null {
    if (candidateIds.length < 2) return null;

    let bestPair: [Branch, Branch] | null = null;
    let bestScore = -1;

    for (let i = 0; i < candidateIds.length; i += 1) {
        for (let j = i + 1; j < candidateIds.length; j += 1) {
            const first = getBranchById(candidateIds[i]);
            const second = getBranchById(candidateIds[j]);

            if (!first || !second) continue;

            const score = distinctionNeedScore(first, second);

            if (score > bestScore) {
                bestScore = score;
                bestPair = [first, second];
            }
        }
    }

    if (!bestPair) {
        const first = getBranchById(candidateIds[0]);
        const second = getBranchById(candidateIds[1]);

        if (first && second) {
            return [first, second];
        }
    }

    return bestPair;
}

function extractContrastOptions(question: string): [string, string] {
    const normalized = question
        .replace(/\s+/g, ' ')
        .replace(/\?/g, '')
        .trim();

    const parts = normalized.split(/,\s*/);
    if (parts.length >= 2) {
        return [parts[0].trim(), parts[1].trim()];
    }

    return ['', ''];
}

function buildQuestion(state: QuestionEngineState): Question | null {
    if (state.neitherCount >= NEITHER_TO_FREE_TEXT) {
        return {
            type: 'free_text',
            text: '직접 표현해 주셔도 좋아요. 어떤 느낌으로 바꾸고 싶은지 편하게 적어 주세요.',
            options: [],
            sourcebranchIds: state.remainingCandidates,
        };
    }

    const pair = findBestContrastPair(state.remainingCandidates);
    if (!pair) return null;

    const [branchA, branchB] = pair;

    if (state.neitherCount >= NEITHER_TO_IMAGE_AB) {
        return {
            type: 'image_ab',
            text: '두 방향 중에서 지금 시안에 더 가까운 쪽은 어느 쪽인가요?',
            options: [
                {
                    label: branchA.descriptionClient,
                    branchIds: [branchA.branchId],
                    eliminateBranchIds: [branchB.branchId],
                },
                {
                    label: branchB.descriptionClient,
                    branchIds: [branchB.branchId],
                    eliminateBranchIds: [branchA.branchId],
                },
                {
                    label: NEITHER_LABEL,
                    branchIds: [],
                    eliminateBranchIds: [],
                },
            ],
            sourcebranchIds: [branchA.branchId, branchB.branchId],
        };
    }

    const contrastQuestion = branchA.contrastQuestion;
    const [optionA, optionB] = extractContrastOptions(contrastQuestion);

    return {
        type: 'text_choice',
        text: contrastQuestion,
        options: [
            {
                label: optionA || branchA.branchLabel,
                branchIds: [branchA.branchId],
                eliminateBranchIds: [branchB.branchId],
            },
            {
                label: optionB || branchB.branchLabel,
                branchIds: [branchB.branchId],
                eliminateBranchIds: [branchA.branchId],
            },
            {
                label: NEITHER_LABEL,
                branchIds: [],
                eliminateBranchIds: [],
            },
        ],
        sourcebranchIds: [branchA.branchId, branchB.branchId],
    };
}

export function getNextQuestion(state: QuestionEngineState): Question | null {
    if (isConverged(state)) return null;
    return buildQuestion(state);
}

export function getRefinementQuestion(state: QuestionEngineState): Question | null {
    return buildQuestion({
        ...state,
        neitherCount: 0,
    });
}

export function submitAnswer(
    state: QuestionEngineState,
    question: Question,
    selectedOptionIndex: number
): QuestionEngineState {
    const option = question.options[selectedOptionIndex];
    const isNeither = option.label === NEITHER_LABEL;

    const eliminated = [...state.eliminated];
    let remaining = [...state.remainingCandidates];

    if (!isNeither) {
        option.eliminateBranchIds.forEach((branchId) => {
            if (!eliminated.includes(branchId)) {
                eliminated.push(branchId);
            }
            remaining = remaining.filter((candidateId) => candidateId !== branchId);
        });

        option.branchIds.forEach((selectedId) => {
            const selectedBranch = getBranchById(selectedId);
            if (!selectedBranch) return;

            remaining = remaining.filter((candidateId) => {
                if (option.branchIds.includes(candidateId)) {
                    return true;
                }

                const candidate = getBranchById(candidateId);
                if (!candidate) {
                    return true;
                }

                const hasConflict = candidate.antiSignals.some(
                    (signal) =>
                        selectedBranch.adjective.includes(signal) ||
                        selectedBranch.branchLabel.includes(signal)
                );

                if (hasConflict) {
                    if (!eliminated.includes(candidateId)) {
                        eliminated.push(candidateId);
                    }
                    return false;
                }

                return true;
            });
        });
    } else {
        const sourceIds = question.sourcebranchIds;
        const nonSource = remaining.filter((id) => !sourceIds.includes(id));
        const source = remaining.filter((id) => sourceIds.includes(id));
        remaining = [...nonSource, ...source];
    }

    const record: AnswerRecord = {
        questionText: question.text,
        answerLabel: option.label,
        eliminatedBranches: option.eliminateBranchIds,
        remainingBranches: remaining,
    };

    const totalBranches = state.remainingCandidates.length + state.eliminated.length;
    const confidence = totalBranches > 0
        ? 1 - remaining.length / totalBranches
        : 0;

    return {
        remainingCandidates: remaining,
        eliminated,
        answerHistory: [...state.answerHistory, record],
        confidence,
        questionCount: state.questionCount + 1,
        neitherCount: isNeither ? state.neitherCount + 1 : 0,
    };
}

export function isConverged(state: QuestionEngineState): boolean {
    if (state.remainingCandidates.length <= CONVERGENCE_THRESHOLD) return true;
    if (state.questionCount >= MAX_QUESTIONS) return true;

    if (state.answerHistory.length >= 2) {
        const last = state.answerHistory[state.answerHistory.length - 1];
        const prev = state.answerHistory[state.answerHistory.length - 2];

        if (
            last.answerLabel !== NEITHER_LABEL &&
            prev.answerLabel !== NEITHER_LABEL &&
            last.remainingBranches.length === prev.remainingBranches.length &&
            last.remainingBranches.every((id) => prev.remainingBranches.includes(id))
        ) {
            return true;
        }
    }

    return false;
}

export function getResult(state: QuestionEngineState): ConvergenceResult {
    return {
        primaryBranch: state.remainingCandidates[0] || '',
        secondaryBranch: state.remainingCandidates.length > 1 ? state.remainingCandidates[1] : null,
        eliminatedBranches: state.eliminated,
        answerLog: state.answerHistory,
    };
}
