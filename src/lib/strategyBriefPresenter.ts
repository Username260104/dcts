import type {
    BriefOutput,
    StrategyGapMemo,
    StrategyTranslationBrief,
} from '@/types/ontology';
import { partitionStrategyGuardrails } from './strategyGuardrails';

export type StrategyDisplayTone = 'default' | 'muted' | 'warning' | 'danger' | 'success';

export type StrategyDisplayEntry =
    | {
        kind: 'text';
        label: string;
        value: string;
        tone?: StrategyDisplayTone;
    }
    | {
        kind: 'list';
        label: string;
        values: string[];
        tone?: StrategyDisplayTone;
    };

export interface StrategyDisplaySection {
    title: string;
    description?: string;
    entries: StrategyDisplayEntry[];
}

export interface StrategyDisplayModel {
    sections: StrategyDisplaySection[];
}

function normalizeText(value?: string | null): string | null {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    return normalized ? normalized : null;
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
    return [...new Set(
        values
            .map((value) => normalizeText(value))
            .filter((value): value is string => Boolean(value))
    )];
}

function take(values: Array<string | null | undefined>, limit = 3): string[] {
    return uniqueNonEmpty(values).slice(0, limit);
}

function firstSentence(value?: string | null): string | null {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }

    const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
    return match ? match[1].trim() : normalized;
}

function shorten(value?: string | null, maxLength = 120): string | null {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function splitAvoids(translation: StrategyTranslationBrief): {
    perceptionRisks: string[];
    hardConstraints: string[];
    strategicGuardrails: string[];
} {
    const grouped = partitionStrategyGuardrails({
        mustAvoid: translation.mustAvoid,
        noGo: translation.noGo,
    });

    return {
        perceptionRisks: take(grouped.perceptionRisks, 3),
        hardConstraints: take(grouped.operationalConstraints, 4),
        strategicGuardrails: take(grouped.strategicGuardrails, 3),
    };
}

function formatDirectionLine(value: string): string {
    const normalized = normalizeText(value);
    if (!normalized) {
        return '';
    }

    const [label, ...rest] = normalized.split(':');
    if (rest.length === 0) {
        return normalized;
    }

    const description = shorten(rest.join(':').trim(), 90);
    return description ? `${label.trim()} - ${description}` : label.trim();
}

function normalizeQuestions(values: string[]): string[] {
    return values.map((value) => {
        const missingMatch = value.match(/^(.*)에 대해 더 구체적으로 확인해 주세요\.$/);
        if (missingMatch) {
            return `먼저 ${missingMatch[1].trim()}부터 확정해 주세요.`;
        }

        const assumptionMatch = value.match(/^(.*) 이 가정을 사실로 확정해도 되는지 확인해 주세요\.$/);
        if (assumptionMatch) {
            return `다음 가정을 사실로 확정해도 되는지 확인해 주세요: ${assumptionMatch[1].trim()}`;
        }

        return value;
    });
}

function extractAssumptions(gapMemo: StrategyGapMemo): string[] {
    return take(gapMemo.nextQuestions.flatMap((value) => {
        const match = value.match(/^(.*) 이 가정을 사실로 확정해도 되는지 확인해 주세요\.$/);
        return match ? [match[1].trim()] : [];
    }), 3);
}

function explainGapCriterion(value: string, mode: 'missing' | 'weak'): string {
    if (value.includes('피해야 할 방향')) {
        return mode === 'missing'
            ? '어떤 인상으로 보이면 실패인지가 아직 고정되지 않았습니다.'
            : '피해야 할 인상이 아직 너무 넓거나 추상적입니다.';
    }

    if (value.includes('디자인 평가 기준')) {
        return mode === 'missing'
            ? '리뷰 자리에서 무엇을 보면 통과라고 할지 아직 정해지지 않았습니다.'
            : '리뷰 통과 기준이 아직 시안 판단에 쓰기엔 추상적입니다.';
    }

    if (value.includes('비교되는 시장 프레임')) {
        return '어떤 경쟁 구도와 카테고리 문법을 기준으로 볼지 아직 흐립니다.';
    }

    if (value.includes('차별화 포인트')) {
        return mode === 'missing'
            ? '무엇이 경쟁 대비 달라 보여야 하는지가 아직 비어 있습니다.'
            : '무엇이 달라 보여야 하는지가 아직 충분히 선명하지 않습니다.';
    }

    if (value.includes('이번 차수 범위')) {
        return mode === 'missing'
            ? '이번 차수에서 실제로 어디까지 손대는지 범위가 아직 비어 있습니다.'
            : '이번 차수 범위가 아직 넓거나 흐려서 시안 범위가 흔들릴 수 있습니다.';
    }

    if (value.includes('더 강하게 보여야 할 인상')) {
        return mode === 'missing'
            ? '첫 시안에서 무엇을 더 세게 밀어야 하는지가 아직 비어 있습니다.'
            : '무엇을 먼저 강하게 보여야 하는지가 아직 추상적입니다.';
    }

    if (value.includes('이번 차수의 핵심 과제')) {
        return '이번 수정으로 실제로 무엇을 움직여야 하는지가 아직 추상적입니다.';
    }

    if (value.includes('핵심 가치 제안')) {
        return '결국 어떤 가치가 읽혀야 하는지가 한 문장으로 덜 고정돼 있습니다.';
    }

    return mode === 'missing'
        ? `${value}이 아직 비어 있어 디자이너 해석이 갈릴 수 있습니다.`
        : `${value}이 아직 추상적이라 시안 판단 기준으로 쓰기 어렵습니다.`;
}

function buildGapAmbiguities(gapMemo: StrategyGapMemo): string[] {
    return take([
        ...gapMemo.contradictions.map((value) => `서로 상충하는 지시가 남아 있습니다: ${value}`),
        ...gapMemo.missingCriteria.map((value) => explainGapCriterion(value, 'missing')),
        ...gapMemo.weakCriteria.map((value) => explainGapCriterion(value, 'weak')),
    ], 5);
}

function buildGapRisks(gapMemo: StrategyGapMemo): string[] {
    const allCriteria = `${gapMemo.missingCriteria.join(' ')} ${gapMemo.weakCriteria.join(' ')}`;

    return take([
        gapMemo.contradictions.length > 0
            ? '상반된 요청이 동시에 남아 있어, 한 시안 안에서 방향이 충돌할 가능성이 큽니다.'
            : null,
        allCriteria.includes('피해야 할 방향')
            ? '피해야 할 인상이 고정되지 않아, 디자이너가 잘못된 무드로 과하게 밀 수 있습니다.'
            : null,
        allCriteria.includes('디자인 평가 기준')
            ? '리뷰 통과 기준이 모호해, 시안을 두고도 무엇이 맞는지 합의가 흔들릴 수 있습니다.'
            : null,
        allCriteria.includes('이번 차수 범위')
            ? '이번 차수 범위가 흐려서 수정 범위가 넓어지거나 반대로 지나치게 좁아질 수 있습니다.'
            : null,
        allCriteria.includes('비교되는 시장 프레임') || allCriteria.includes('차별화 포인트')
            ? '경쟁 대비 어디서 달라 보여야 하는지가 흐려, 레퍼런스 방향이 흔들릴 수 있습니다.'
            : null,
        allCriteria.includes('더 강하게 보여야 할 인상') || allCriteria.includes('핵심 가치 제안')
            ? '첫 시안에서 무엇을 밀어야 하는지가 덜 고정돼, 인상 설계가 분산될 수 있습니다.'
            : null,
    ], 4);
}

export function buildStrategyTranslationDisplayModel(
    brief: BriefOutput
): StrategyDisplayModel | null {
    const translation = brief.strategyTranslation;

    if (!translation) {
        return null;
    }

    const { perceptionRisks, hardConstraints, strategicGuardrails } = splitAvoids(translation);
    const reviewCriteria = take(translation.reviewCriteria, 3);
    const mustAmplify = take(translation.mustAmplify, 2);
    const openQuestions = take(translation.openQuestionsForDesign, 3);
    const assumptions = take(translation.workingAssumptions, 3);
    const confirmedInputs = take(translation.confirmedInputs, 5);

    const sections: StrategyDisplaySection[] = [
        {
            title: '이번 시안의 한 줄 미션',
            entries: [
                {
                    kind: 'text',
                    label: '한 줄 미션',
                    value: firstSentence(translation.strategicPremise) ?? translation.strategicPremise,
                },
                {
                    kind: 'text',
                    label: '누구에게 어떤 장면인가',
                    value: translation.audienceAndContext,
                },
                {
                    kind: 'text',
                    label: '핵심 긴장',
                    value: translation.coreTension,
                    tone: 'warning',
                },
                {
                    kind: 'text',
                    label: '이번 차수에서 맞출 범위',
                    value: translation.scopeNow || translation.scope,
                },
            ],
        },
        {
            title: '디자이너가 먼저 붙잡을 판단 기준',
            entries: [
                {
                    kind: 'list',
                    label: '먼저 강해져야 할 것',
                    values: mustAmplify,
                    tone: 'success',
                },
                {
                    kind: 'list',
                    label: '이렇게 보이면 실패',
                    values: perceptionRisks,
                    tone: 'danger',
                },
                {
                    kind: 'list',
                    label: '충돌 시 먼저 지킬 것',
                    values: take(translation.decisionPriority, 3),
                    tone: 'warning',
                },
                {
                    kind: 'list',
                    label: '리뷰 통과 기준',
                    values: reviewCriteria,
                    tone: 'warning',
                },
            ],
        },
        {
            title: '유지해야 할 것과 건드리면 안 되는 것',
            entries: [
                {
                    kind: 'list',
                    label: '지켜야 할 자산',
                    values: take(translation.equitiesToProtect, 3),
                    tone: 'success',
                },
                {
                    kind: 'list',
                    label: '필수 반영 요소',
                    values: take(translation.mandatories, 4),
                },
                {
                    kind: 'list',
                    label: '건드리면 안 되는 것',
                    values: hardConstraints,
                    tone: 'danger',
                },
                {
                    kind: 'list',
                    label: '넘으면 안 되는 전략 선',
                    values: strategicGuardrails,
                    tone: 'warning',
                },
                {
                    kind: 'list',
                    label: '아직 가정으로 두는 것',
                    values: assumptions,
                    tone: 'muted',
                },
            ],
        },
        {
            title: '화면에 어떻게 번역할지',
            entries: [
                {
                    kind: 'list',
                    label: '표면별 적용 메모',
                    values: take(translation.surfaceImplications, 4),
                },
                {
                    kind: 'list',
                    label: '디자이너와 추가로 확인할 질문',
                    values: openQuestions,
                    tone: 'muted',
                },
            ],
        },
        {
            title: '왜 이 방향이 맞는가',
            entries: [
                {
                    kind: 'text',
                    label: '비교 프레임',
                    value: translation.frameOfReference,
                },
                {
                    kind: 'text',
                    label: '핵심 가치 제안',
                    value: translation.valueProposition,
                },
                {
                    kind: 'list',
                    label: '차별화 포인트',
                    values: take(translation.pointsOfDifference, 3),
                },
                {
                    kind: 'list',
                    label: '신뢰 근거',
                    values: take(translation.reasonsToBelieve, 3),
                },
            ],
        },
        {
            title: '참고할 무드와 피할 무드',
            entries: [
                {
                    kind: 'list',
                    label: '참고할 무드',
                    values: take(translation.recommendedDirections.map(formatDirectionLine), 3),
                    tone: 'success',
                },
                {
                    kind: 'list',
                    label: '피할 무드',
                    values: take(translation.avoidedDirections.map(formatDirectionLine), 2),
                    tone: 'danger',
                },
                {
                    kind: 'text',
                    label: '방향 매핑 메모',
                    value: translation.mappingRationale ?? brief.strategyPersuasionGuide ?? '',
                    tone: 'muted',
                },
            ],
        },
    ];

    if (confirmedInputs.length > 0) {
        sections.push({
            title: '입력에서 직접 확인된 내용',
            entries: [
                {
                    kind: 'list',
                    label: '직접 확인된 입력',
                    values: confirmedInputs,
                    tone: 'muted',
                },
            ],
        });
    }

    return {
        sections: sections
            .map((section) => ({
                ...section,
                entries: section.entries.filter((entry) => (
                    entry.kind === 'text'
                        ? Boolean(normalizeText(entry.value))
                        : entry.values.length > 0
                )),
            }))
            .filter((section) => section.entries.length > 0),
    };
}

export function buildStrategyGapDisplayModel(
    brief: BriefOutput
): StrategyDisplayModel | null {
    const gapMemo = brief.gapMemo;

    if (!gapMemo) {
        return null;
    }

    const sections: StrategyDisplaySection[] = [
        {
            title: '현재까지 고정된 판단',
            description: normalizeText(brief.strategySummary) ?? undefined,
            entries: [
                {
                    kind: 'list',
                    label: '지금까지 분명한 것',
                    values: take(gapMemo.currentUnderstanding, 4),
                },
            ],
        },
        {
            title: '아직 헷갈리는 갈림길',
            entries: [
                {
                    kind: 'list',
                    label: '먼저 좁혀야 할 지점',
                    values: buildGapAmbiguities(gapMemo),
                    tone: 'warning',
                },
            ],
        },
        {
            title: '먼저 고정할 기준',
            entries: [
                {
                    kind: 'list',
                    label: '우선 보강 순서',
                    values: take(gapMemo.priorityGaps, 3),
                    tone: 'warning',
                },
            ],
        },
        {
            title: '지금 이 상태로 넘기면 생길 오해',
            entries: [
                {
                    kind: 'list',
                    label: 'handoff 리스크',
                    values: buildGapRisks(gapMemo),
                    tone: 'danger',
                },
                {
                    kind: 'text',
                    label: '왜 바로 handoff 하기 어려운가',
                    value: gapMemo.blockingReason,
                    tone: 'warning',
                },
            ],
        },
        {
            title: '다음에 먼저 확인할 3가지',
            entries: [
                {
                    kind: 'list',
                    label: '우선 확인 질문',
                    values: take(normalizeQuestions(gapMemo.nextQuestions), 3),
                },
            ],
        },
        {
            title: '현재 가정으로 두는 것',
            entries: [
                {
                    kind: 'list',
                    label: '임시 전제',
                    values: extractAssumptions(gapMemo),
                    tone: 'muted',
                },
            ],
        },
    ];

    return {
        sections: sections
            .map((section) => ({
                ...section,
                entries: section.entries.filter((entry) => (
                    entry.kind === 'text'
                        ? Boolean(normalizeText(entry.value))
                        : entry.values.length > 0
                )),
            }))
            .filter((section) => section.description || section.entries.length > 0),
    };
}
