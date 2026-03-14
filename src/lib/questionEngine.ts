import branches from '@/data/branches.json';
import contextData from '@/data/context.json';
import type {
    Branch,
    ContextVariables,
    UserContext,
    QuestionEngineState,
    ConvergenceResult,
    Question,
    AnswerRecord,
} from '@/types/ontology';
import {
    MAX_QUESTIONS,
    CONVERGENCE_THRESHOLD,
    NEITHER_TO_IMAGE_AB,
    NEITHER_TO_FREE_TEXT,
    BOOST_WEIGHT,
    SUPPRESS_WEIGHT,
} from './constants';

const branchData = branches as Branch[];
const ctxData = contextData as ContextVariables;

// 분기 ID로 Branch 객체 조회
export function getBranchById(id: string): Branch | undefined {
    return branchData.find((b) => b.branchId === id);
}

// 맥락 변수 기반 후보 분기 정렬 (boost/suppress 적용)
function applyCcontextWeights(
    candidateIds: string[],
    userContext: UserContext
): string[] {
    const scores: Record<string, number> = {};
    candidateIds.forEach((id) => { scores[id] = 0; });

    // 각 맥락 변수별 가중치 적용
    const applyWeight = (variableMap: Record<string, { boost: string[]; suppress: string[] }>, selectedKey: string) => {
        const option = variableMap[selectedKey];
        if (!option) return;
        option.boost.forEach((id) => {
            if (scores[id] !== undefined) scores[id] += BOOST_WEIGHT;
        });
        option.suppress.forEach((id) => {
            if (scores[id] !== undefined) scores[id] += SUPPRESS_WEIGHT;
        });
    };

    if (userContext.industry) applyWeight(ctxData.industry, userContext.industry);
    if (userContext.pricePosition) applyWeight(ctxData.pricePosition, userContext.pricePosition);
    if (userContext.projectStage) applyWeight(ctxData.projectStage, userContext.projectStage);
    if (userContext.targetAge) applyWeight(ctxData.targetAge, userContext.targetAge);

    // 점수 내림차순 정렬
    return [...candidateIds].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
}

// 초기 상태 생성
export function createInitialState(
    candidateBranchIds: string[],
    userContext: UserContext
): QuestionEngineState {
    const sorted = applyCcontextWeights(candidateBranchIds, userContext);
    return {
        remainingCandidates: sorted,
        eliminated: [],
        answerHistory: [],
        confidence: 0,
        questionCount: 0,
        neitherCount: 0,
    };
}

// 두 분기 간 구분이 얼마나 필요한지 점수 계산 (높을수록 구분 필요)
function distinctionNeedScore(a: Branch, b: Branch): number {
    let score = 0;
    // 혼동 분기에 서로 포함되어 있으면 구분 우선
    if (a.confusableBranches.includes(b.branchId)) score += 3;
    if (b.confusableBranches.includes(a.branchId)) score += 3;
    // 같은 형용사 그룹이면 구분 필요
    if (a.adjective === b.adjective) score += 2;
    return score;
}

// 가장 구분이 필요한 분기 쌍 찾기
function findBestContrastPair(candidateIds: string[]): [Branch, Branch] | null {
    if (candidateIds.length < 2) return null;

    let bestPair: [Branch, Branch] | null = null;
    let bestScore = -1;

    for (let i = 0; i < candidateIds.length; i++) {
        for (let j = i + 1; j < candidateIds.length; j++) {
            const a = getBranchById(candidateIds[i]);
            const b = getBranchById(candidateIds[j]);
            if (!a || !b) continue;

            const score = distinctionNeedScore(a, b);
            if (score > bestScore) {
                bestScore = score;
                bestPair = [a, b];
            }
        }
    }

    // 점수가 0이어도 상위 2개를 비교
    if (!bestPair) {
        const a = getBranchById(candidateIds[0]);
        const b = getBranchById(candidateIds[1]);
        if (a && b) bestPair = [a, b];
    }

    return bestPair;
}

// 다음 질문 생성
export function getNextQuestion(state: QuestionEngineState): Question | null {
    // 수렴 조건 확인
    if (isConverged(state)) return null;

    // 연속 "둘 다 아닌데요" 3회 → 자유 텍스트
    if (state.neitherCount >= NEITHER_TO_FREE_TEXT) {
        return {
            type: 'free_text',
            text: '직접 설명해주셔도 좋아요. 어떤 느낌을 원하시는지 편하게 적어주세요.',
            options: [],
            sourcebranchIds: state.remainingCandidates,
        };
    }

    const pair = findBestContrastPair(state.remainingCandidates);
    if (!pair) return null;

    const [branchA, branchB] = pair;

    // 연속 "둘 다 아닌데요" 2회 → 이미지 A/B 비교 (MVP에서는 텍스트 기반 설명 비교)
    if (state.neitherCount >= NEITHER_TO_IMAGE_AB) {
        return {
            type: 'image_ab',
            text: '어느 쪽이 더 원하시는 방향에 가까우세요?',
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
                    label: '둘 다 아닌데요',
                    branchIds: [],
                    eliminateBranchIds: [],
                },
            ],
            sourcebranchIds: [branchA.branchId, branchB.branchId],
        };
    }

    // 기본: 텍스트 선택형 (대비 질문 사용)
    // 대비 질문은 branchA에 저장된 contrastQuestion 사용
    const contrastQ = branchA.contrastQuestion;

    // 대비 질문에서 선택지 텍스트 추출 (쉼표 또는 '~인가요' 패턴)
    const optionTexts = extractContrastOptions(contrastQ);

    return {
        type: 'text_choice',
        text: contrastQ,
        options: [
            {
                label: optionTexts[0] || branchA.branchLabel,
                branchIds: [branchA.branchId],
                eliminateBranchIds: [branchB.branchId],
            },
            {
                label: optionTexts[1] || branchB.branchLabel,
                branchIds: [branchB.branchId],
                eliminateBranchIds: [branchA.branchId],
            },
            {
                label: '둘 다 아닌데요',
                branchIds: [],
                eliminateBranchIds: [],
            },
        ],
        sourcebranchIds: [branchA.branchId, branchB.branchId],
    };
}

// 대비 질문에서 두 선택지 텍스트 추출
function extractContrastOptions(question: string): [string, string] {
    // "A인가요, B인가요?" 패턴
    const commaMatch = question.match(/(.+?)(인가요|일까요|건가요),\s*(.+?)(인가요|일까요|건가요)\??/);
    if (commaMatch) {
        return [commaMatch[1].trim(), commaMatch[3].trim()];
    }

    // "A인가요? B인가요?" 패턴
    const questionMarkMatch = question.match(/(.+?)(인가요|일까요|건가요)\??\s*(.+?)(인가요|일까요|건가요)\??/);
    if (questionMarkMatch) {
        return [questionMarkMatch[1].trim(), questionMarkMatch[3].trim()];
    }

    return ['', ''];
}

// 답변 제출 → 상태 갱신
export function submitAnswer(
    state: QuestionEngineState,
    question: Question,
    selectedOptionIndex: number
): QuestionEngineState {
    const option = question.options[selectedOptionIndex];
    const isNeither = option.label === '둘 다 아닌데요';

    // 새로운 배제 목록
    const newEliminated = [...state.eliminated];
    let newRemaining = [...state.remainingCandidates];

    if (!isNeither) {
        // 선택한 방향의 반대 분기 제거
        option.eliminateBranchIds.forEach((id) => {
            if (!newEliminated.includes(id)) {
                newEliminated.push(id);
            }
            newRemaining = newRemaining.filter((cid) => cid !== id);
        });

        // 선택한 분기의 안티 시그널로 추가 배제
        option.branchIds.forEach((selectedId) => {
            const selectedBranch = getBranchById(selectedId);
            if (!selectedBranch) return;

            // 남은 후보 중 선택된 분기의 adjective/label이 antiSignals에 포함되면 제거
            newRemaining = newRemaining.filter((cid) => {
                if (option.branchIds.includes(cid)) return true; // 선택된 분기 유지
                const candidate = getBranchById(cid);
                if (!candidate) return true;
                const hasConflict = candidate.antiSignals.some(
                    (signal) =>
                        selectedBranch.adjective.includes(signal) ||
                        selectedBranch.branchLabel.includes(signal)
                );
                if (hasConflict) {
                    if (!newEliminated.includes(cid)) {
                        newEliminated.push(cid);
                    }
                    return false;
                }
                return true;
            });
        });
    } else {
        // "둘 다 아닌데요" — 현재 비교 쌍을 끝으로 이동하여 다른 축 전환
        const sourceIds = question.sourcebranchIds;
        const nonSource = newRemaining.filter((id) => !sourceIds.includes(id));
        const source = newRemaining.filter((id) => sourceIds.includes(id));
        newRemaining = [...nonSource, ...source];
    }

    // 응답 이력 기록
    const record: AnswerRecord = {
        questionText: question.text,
        answerLabel: option.label,
        eliminatedBranches: option.eliminateBranchIds,
        remainingBranches: newRemaining,
    };

    // 신뢰도 계산 (남은 후보 비율 기반)
    const totalBranches = state.remainingCandidates.length + state.eliminated.length;
    const confidence = totalBranches > 0
        ? 1 - (newRemaining.length / totalBranches)
        : 0;

    return {
        remainingCandidates: newRemaining,
        eliminated: newEliminated,
        answerHistory: [...state.answerHistory, record],
        confidence,
        questionCount: state.questionCount + 1,
        neitherCount: isNeither ? state.neitherCount + 1 : 0,
    };
}

// 수렴 여부 판정
export function isConverged(state: QuestionEngineState): boolean {
    // 남은 후보가 수렴 임계값 이하
    if (state.remainingCandidates.length <= CONVERGENCE_THRESHOLD) return true;
    // 최대 질문 수 도달
    if (state.questionCount >= MAX_QUESTIONS) return true;
    // 연속 2회 같은 방향 선택 (마지막 2개 응답이 동일 분기 방향)
    if (state.answerHistory.length >= 2) {
        const last = state.answerHistory[state.answerHistory.length - 1];
        const prev = state.answerHistory[state.answerHistory.length - 2];
        if (
            last.answerLabel !== '둘 다 아닌데요' &&
            prev.answerLabel !== '둘 다 아닌데요' &&
            last.remainingBranches.length === prev.remainingBranches.length &&
            last.remainingBranches.every((id) => prev.remainingBranches.includes(id))
        ) {
            return true;
        }
    }
    return false;
}

// 최종 수렴 결과
export function getResult(state: QuestionEngineState): ConvergenceResult {
    const remaining = state.remainingCandidates;

    return {
        primaryBranch: remaining[0] || '',
        secondaryBranch: remaining.length > 1 ? remaining[1] : null,
        eliminatedBranches: state.eliminated,
        answerLog: state.answerHistory,
    };
}
