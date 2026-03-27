import type { StrategyState, UserContext } from '@/types/ontology';

export type StrategyClarificationField =
    | 'mustAmplify'
    | 'mustAvoid'
    | 'decisionPriority'
    | 'scopeNow'
    | 'reviewCriteria';

export const STRATEGY_DIRECT_INPUT_LABEL = '직접 적기';
export const STRATEGY_UNCLEAR_CHOICE_LABEL = '아직 판단 못 함';

const FIELD_DEFAULTS: Record<StrategyClarificationField, string[]> = {
    mustAmplify: ['브랜드 신뢰감', '선명한 존재감', '친근한 온도감'],
    mustAvoid: ['차갑고 병원 같은 인상', '거리감 있는 럭셔리 인상', '너무 대중적이고 가벼운 인상'],
    decisionPriority: ['브랜드 신뢰 유지', '새로운 인상 강화', '정보 전달 명확성'],
    scopeNow: ['패키지 전면', '웹 첫 화면', '상세페이지 핵심 구간'],
    reviewCriteria: ['첫 인상에서 방향이 바로 읽히는가', '기존 고객에게 이질감이 과하지 않은가', '채널 간 톤이 일관되게 유지되는가'],
};

function unique(values: Array<string | undefined | null>): string[] {
    return [...new Set(
        values
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value))
    )];
}

function splitSeedText(value: string | undefined): string[] {
    if (!value) {
        return [];
    }

    return value
        .split(/\r?\n|,|;|\/|->|>/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeChoiceText(value: string): string | null {
    const normalized = value
        .replace(/\s+/g, ' ')
        .replace(/[.!?]+$/g, '')
        .trim();

    if (normalized.length < 3) {
        return null;
    }

    const firstClause = normalized
        .split(/[()]/)
        .map((item) => item.trim())
        .find(Boolean) ?? normalized;

    if (firstClause.length > 32) {
        return null;
    }

    return firstClause;
}

function collectNormalized(values: Array<string | undefined | null>): string[] {
    return unique(
        values.flatMap((value) => splitSeedText(value ?? undefined))
    )
        .map((value) => normalizeChoiceText(value))
        .filter((value): value is string => Boolean(value));
}

function buildDecisionPriorityDefaults(strategyState: StrategyState): string[] {
    const schema = strategyState.schema;
    const equity = schema.equitiesToProtect?.[0]?.trim();
    const amplify = schema.mustAmplify?.[0]?.trim();
    const review = schema.reviewCriteria?.[0]?.trim();

    return unique([
        equity ? `${equity} 유지` : undefined,
        amplify ? `${amplify} 강화` : undefined,
        review ? `${review} 우선` : undefined,
        ...FIELD_DEFAULTS.decisionPriority,
    ]);
}

function buildScopeDefaults(strategyState: StrategyState, userContext?: UserContext): string[] {
    const source = [
        strategyState.schema.scopeNow,
        strategyState.schema.scope,
        userContext?.additionalContext,
        userContext?.projectStage,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return unique([
        /패키지|package|packaging/.test(source) ? '패키지 전면' : undefined,
        /상세|detail|pdp/.test(source) ? '상세페이지 핵심 구간' : undefined,
        /web|웹|사이트|landing/.test(source) ? '웹 첫 화면' : undefined,
        /로고|identity|심볼/.test(source) ? '로고 또는 핵심 아이덴티티' : undefined,
        ...FIELD_DEFAULTS.scopeNow,
    ]);
}

function buildReviewDefaults(strategyState: StrategyState): string[] {
    const schema = strategyState.schema;
    const amplify = schema.mustAmplify?.[0]?.trim();
    const difference = schema.pointsOfDifference?.[0]?.trim();
    const equity = schema.equitiesToProtect?.[0]?.trim();

    return unique([
        amplify ? `${amplify}가 첫 인상에서 바로 읽히는가` : undefined,
        difference ? `${difference} 차이가 분명히 느껴지는가` : undefined,
        equity ? `${equity}가 낯설게 흔들리지 않는가` : undefined,
        ...FIELD_DEFAULTS.reviewCriteria,
    ]);
}

export function getStrategyClarificationChoices(
    field: StrategyClarificationField,
    strategyState: StrategyState,
    userContext?: UserContext
): string[] {
    const schema = strategyState.schema;

    const dynamicCandidates = (() => {
        switch (field) {
            case 'mustAmplify':
                return collectNormalized([
                    ...(schema.mustAmplify ?? []),
                    ...(schema.pointsOfDifference ?? []),
                    ...(schema.personality ?? []),
                ]);
            case 'mustAvoid':
                return collectNormalized([
                    ...(schema.mustAvoid ?? []),
                    ...(schema.noGo ?? []),
                    ...(schema.openRisks ?? []),
                ]);
            case 'decisionPriority':
                return collectNormalized([
                    ...(schema.decisionPriority ?? []),
                    ...(schema.tradeOffs ?? []),
                    ...(schema.equitiesToProtect ?? []),
                    ...(schema.mustAmplify ?? []),
                ]);
            case 'scopeNow':
                return collectNormalized([
                    schema.scopeNow,
                    schema.scope,
                    userContext?.additionalContext,
                ]);
            case 'reviewCriteria':
                return collectNormalized([
                    ...(schema.reviewCriteria ?? []),
                    ...(strategyState.diagnosis.decisionFrame ?? []),
                    ...(strategyState.diagnosis.workingAssumptions ?? []),
                ]);
            default:
                return [];
        }
    })();

    const fallbackCandidates = (() => {
        switch (field) {
            case 'decisionPriority':
                return buildDecisionPriorityDefaults(strategyState);
            case 'scopeNow':
                return buildScopeDefaults(strategyState, userContext);
            case 'reviewCriteria':
                return buildReviewDefaults(strategyState);
            default:
                return FIELD_DEFAULTS[field];
        }
    })();

    return unique([...dynamicCandidates, ...fallbackCandidates]).slice(0, 3);
}
