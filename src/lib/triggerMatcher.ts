import triggers from '@/data/triggers.json';
import branches from '@/data/branches.json';
import type { Trigger, Branch } from '@/types/ontology';

const triggerData = triggers as Trigger[];
const branchData = branches as Branch[];

// 트리거 매칭 결과
export interface MatchResult {
    matched: boolean;
    trigger: Trigger | null;
    candidateBranches: string[];
    matchType: 'exact' | 'partial' | 'fallback';
}

// 형용사 키워드 목록 (부분 매칭용)
const ADJECTIVE_KEYWORDS: Record<string, number[]> = {};

// 트리거 데이터에서 키워드 인덱스 구축
triggerData.forEach((t) => {
    // 표현에서 핵심 키워드 추출 (조사/어미 제거)
    const keywords = extractKeywords(t.expression);
    keywords.forEach((kw) => {
        if (!ADJECTIVE_KEYWORDS[kw]) {
            ADJECTIVE_KEYWORDS[kw] = [];
        }
        ADJECTIVE_KEYWORDS[kw].push(t.id);
    });
});

// 한국어 텍스트에서 핵심 키워드 추출
function extractKeywords(text: string): string[] {
    // 조사, 어미, 일반 동사 등 불용어 제거
    const stopWords = [
        '좀', '더', '해주세요', '해줘', '으로', '으로요', '이요',
        '했으면', '좋겠어요', '좋겠어', '보여요', '보여', '같아요',
        '느낌', '느낌으로', '있는', '없는', '너무', '뭔가', '그냥',
        '인가요', '인가', '이었으면', '거', '것', '게', '하게',
        '있게', '없어요', '해요', '이에요', '예요'
    ];

    // 공백으로 분리 후 불용어 제거, 2글자 이상만
    const words = text.replace(/[.,!?]/g, '').split(/\s+/);
    return words
        .filter((w) => w.length >= 2 && !stopWords.includes(w))
        .map((w) => w.replace(/(하게|스럽게|적으로|스러운|다운|적인)$/, ''));
}

// 정확 매칭: 트리거 표현과 직접 비교
function exactMatch(input: string): Trigger | null {
    const normalized = input.trim().replace(/\s+/g, ' ');

    // 완전 일치
    const exact = triggerData.find(
        (t) => t.expression === normalized
    );
    if (exact) return exact;

    // 표현 포함 여부 (입력이 트리거 표현을 포함하거나 그 반대)
    return triggerData.find(
        (t) =>
            normalized.includes(t.expression) ||
            t.expression.includes(normalized)
    ) ?? null;
}

// 부분 매칭: 키워드 기반 유사도
function partialMatch(input: string): Trigger | null {
    const inputKeywords = extractKeywords(input);
    if (inputKeywords.length === 0) return null;

    // 각 트리거별 매칭 점수 계산
    const scores: { trigger: Trigger; score: number }[] = [];

    triggerData.forEach((t) => {
        let score = 0;
        const triggerKeywords = extractKeywords(t.expression);

        // 키워드 직접 매칭
        inputKeywords.forEach((ik) => {
            triggerKeywords.forEach((tk) => {
                if (ik === tk) score += 3;
                else if (ik.includes(tk) || tk.includes(ik)) score += 2;
            });
        });

        // 동반 표현 매칭
        t.coExpressions.forEach((co) => {
            if (input.includes(co.replace(/"/g, ''))) {
                score += 2;
            }
        });

        if (score > 0) {
            scores.push({ trigger: t, score });
        }
    });

    if (scores.length === 0) return null;

    // 최고 점수 트리거 반환
    scores.sort((a, b) => b.score - a.score);
    return scores[0].trigger;
}

// 메인 매칭 함수
export function matchTrigger(input: string): MatchResult {
    if (!input || input.trim().length === 0) {
        return { matched: false, trigger: null, candidateBranches: [], matchType: 'fallback' };
    }

    // 1단계: 정확 매칭
    const exactResult = exactMatch(input);
    if (exactResult) {
        return {
            matched: true,
            trigger: exactResult,
            candidateBranches: exactResult.candidateBranches,
            matchType: 'exact',
        };
    }

    // 2단계: 부분 매칭
    const partialResult = partialMatch(input);
    if (partialResult) {
        return {
            matched: true,
            trigger: partialResult,
            candidateBranches: partialResult.candidateBranches,
            matchType: 'partial',
        };
    }

    // 3단계: 매칭 실패 → 모호형 처리 (PRD: 넓은 범위 A/B)
    // 전체 37개 분기를 후보로 반환하여 질문 엔진이 좁혀나가도록 함
    return {
        matched: false,
        trigger: null,
        candidateBranches: branchData.map((b) => b.branchId),
        matchType: 'fallback',
    };
}

// 빈출 트리거 표현 목록 반환 (진입 화면 칩/태그용)
export function getFrequentTriggers(): Trigger[] {
    // 위험도가 높은 순 + 방향형 우선으로 정렬하여 상위 8개 반환
    return [...triggerData]
        .sort((a, b) => {
            if (a.type === 'directional' && b.type !== 'directional') return -1;
            if (a.type !== 'directional' && b.type === 'directional') return 1;
            return b.riskLevel - a.riskLevel;
        })
        .slice(0, 8);
}

// 전체 트리거 목록 반환
export function getAllTriggers(): Trigger[] {
    return triggerData;
}
