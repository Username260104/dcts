import type { StrategyArtifactType, StrategyState, UserContext } from '@/types/ontology';
import {
    looksLikeOperationalConstraint,
    partitionStrategyGuardrails,
} from './strategyGuardrails';

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

const ARTIFACT_FIELD_DEFAULTS: Partial<Record<StrategyArtifactType, Partial<Record<StrategyClarificationField, string[]>>>> = {
    positioning: {
        mustAmplify: ['브랜드 신뢰감', '차별적 존재감', '접근 가능한 전문성'],
        mustAvoid: ['과장된 광고 인상', '차갑고 거리감 있는 인상', '너무 대중적이고 가벼운 인상'],
        decisionPriority: ['브랜드 신뢰 유지', '차별적 인상 강화', '이해하기 쉬운 명료함'],
        scopeNow: ['웹 첫 화면', '앱/웹 핵심 진입 화면', '상세페이지 핵심 구간'],
        reviewCriteria: ['첫 인상에서 의도한 인식이 읽히는가', '경쟁 대비 차이가 분명한가', '사용자가 낯설지 않게 받아들이는가'],
    },
    brand_platform: {
        mustAmplify: ['브랜드 약속의 선명함', '일관된 태도', '신뢰 가능한 근거'],
        mustAvoid: ['좋은 말만 많은 추상적 톤', '카테고리 어디서나 볼 법한 인상', '실행과 동떨어진 선언적 톤'],
        decisionPriority: ['브랜드 약속의 선명함', '일관된 원칙 유지', '설득 근거의 명확화'],
        scopeNow: ['대표 소개 화면', '핵심 메시지 구조', '브랜드 설명 핵심 구간'],
        reviewCriteria: ['브랜드 약속이 한 줄로 읽히는가', '원칙이 시각 판단으로 이어지는가', '근거가 추상적으로 붕 뜨지 않는가'],
    },
    brand_architecture: {
        mustAmplify: ['체계 이해 용이성', '마스터브랜드 신뢰감', '라인업 구분감'],
        mustAvoid: ['브랜드 체계가 분리돼 보이는 인상', '위계가 더 복잡해 보이는 인상', '새로워졌지만 알아보기 어려운 인상'],
        decisionPriority: ['마스터브랜드 신뢰 유지', '제품군 이해 용이성 확보', '새로운 체계감 강화'],
        scopeNow: ['제품군 구조 표기 체계', '패키지 계층 표현', '온보딩/가이드 핵심 페이지'],
        reviewCriteria: ['제품군 위계가 더 빨리 이해되는가', '마스터브랜드 인식이 유지되는가', '라인업 체계가 하나의 시스템처럼 보이는가'],
    },
    experience_principles: {
        mustAmplify: ['사용 흐름의 명확성', '심리적 안심감', '부담 없는 직관성'],
        mustAvoid: ['멋있지만 쓰기 어려운 인상', '기능보다 장식이 먼저 보이는 인상', '차갑고 무정한 서비스 인상'],
        decisionPriority: ['이해하기 쉬운 흐름', '심리적 안심감', '일관된 경험 원칙'],
        scopeNow: ['핵심 진입 화면', '대표 전환 흐름', '주요 인터랙션 패턴'],
        reviewCriteria: ['사용자가 다음 행동을 바로 이해하는가', '경험 원칙이 실제 화면에서 읽히는가', '부담감보다 안심감이 먼저 느껴지는가'],
    },
    campaign_or_creative_brief_seed: {
        mustAmplify: ['즉시 체감되는 핵심 가치', '감정적 몰입감', '행동을 유도하는 선명함'],
        mustAvoid: ['기능 자랑처럼 보이는 톤', '광고 과장만 강한 인상', '메시지보다 연출만 남는 인상'],
        decisionPriority: ['사용자 체감 가치 전달', '첫 노출 임팩트 확보', '제품력 신뢰 연결'],
        scopeNow: ['키비주얼 메인 컷', '랜딩 첫 화면', '영상 핵심 컷'],
        reviewCriteria: ['첫 노출에서 핵심 감정이 읽히는가', '메시지와 비주얼이 한 방향으로 묶이는가', '제품력 신뢰가 뒤따라오는가'],
    },
    identity_refresh_scope: {
        mustAmplify: ['익숙한 신뢰감', '정제된 세련미', '브랜드 존재감'],
        mustAvoid: ['기존 고객에게 낯선 인상', '차갑고 병원 같은 인상', '거리감 있는 과시적 럭셔리 인상'],
        decisionPriority: ['기존 신뢰 유지', '세련된 인상 강화', '과잉 연출 회피'],
        scopeNow: ['패키지 전면', '대표 키비주얼', '핵심 아이덴티티 요소'],
        reviewCriteria: ['기존 자산이 지워지지 않는가', '새 인상이 더 선명해졌는가', '여러 표면에서 같은 톤이 유지되는가'],
    },
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

function buildChoiceKey(value: string): string {
    return value
        .replace(/\s+/g, '')
        .replace(/(유지|강화|확보|명확성|감|성|화|인상|톤|가치|기준|우선|구분감|존재감)$/g, '')
        .toLowerCase();
}

function dedupeChoiceCandidates(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        const key = buildChoiceKey(value);
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(value);
    }

    return result;
}

function getArtifactDefaults(
    field: StrategyClarificationField,
    artifactType?: StrategyArtifactType
): string[] {
    return artifactType
        ? ARTIFACT_FIELD_DEFAULTS[artifactType]?.[field] ?? []
        : [];
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
        ...getArtifactDefaults('decisionPriority', strategyState.artifactType),
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
        ...getArtifactDefaults('scopeNow', strategyState.artifactType),
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
        ...getArtifactDefaults('reviewCriteria', strategyState.artifactType),
        ...FIELD_DEFAULTS.reviewCriteria,
    ]);
}

export function getStrategyClarificationChoices(
    field: StrategyClarificationField,
    strategyState: StrategyState,
    userContext?: UserContext
): string[] {
    const schema = strategyState.schema;
    const guardrails = partitionStrategyGuardrails({
        mustAvoid: schema.mustAvoid,
        noGo: schema.noGo,
    });

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
                    ...guardrails.perceptionRisks,
                    ...(schema.tradeOffs ?? []).filter((value) => /안 된다|피하|넘어가|과잉|읽히면/.test(value)),
                    ...(schema.openRisks ?? []).filter((value) => !looksLikeOperationalConstraint(value)),
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
                return [
                    ...getArtifactDefaults(field, strategyState.artifactType),
                    ...FIELD_DEFAULTS[field],
                ];
        }
    })();

    return dedupeChoiceCandidates(unique([...dynamicCandidates, ...fallbackCandidates])).slice(0, 3);
}
