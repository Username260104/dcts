import Anthropic from '@anthropic-ai/sdk';
import branches from '@/data/branches.json';
import context from '@/data/context.json';
import tokens from '@/data/tokens.json';
import type {
    Branch,
    ContextVariables,
    DesignToken,
    InputRole,
    LLMBriefResponse,
    LLMFollowUpResponse,
    LLMInitialAnalysis,
    LLMQuestionOption,
    ReadinessStatus,
    RefineFeedbackResponse,
    SessionState,
    StrategyArtifactType,
    StrategyBranchMapping,
    StrategyFieldKey,
    StrategyQuestionOperationMode,
    StrategyGapMemo,
    StrategyReadinessChecks,
    StrategyState,
    StrategyTranslationBrief,
    StrategyTranslationSchema,
    UserContext,
    WorkflowQuestion,
} from '@/types/ontology';
import { MAX_QUESTIONS, STRATEGY_FIELD_REPEAT_LIMIT } from './constants';
import {
    getStrategyRule,
    STRATEGY_ARTIFACT_LABELS,
    STRATEGY_FIELD_LABELS,
} from './strategyArtifacts';
import {
    getStrategyClarificationChoices,
    STRATEGY_DIRECT_INPUT_LABEL,
    STRATEGY_UNCLEAR_CHOICE_LABEL,
    type StrategyClarificationField,
} from './strategyChoiceLibrary';
import {
    buildDeterministicGapMemo,
    buildDeterministicStrategyBrief,
    buildStrategyDiagnosis,
    rankStrategyFieldsByRisk,
} from './strategyPipeline';
import { hasPerceptionRiskSignal } from './strategyGuardrails';

const branchData = branches as Branch[];
const ctxData = context as ContextVariables;
const tokenData = tokens as DesignToken[];
const DETAIL_FOCUSES = ['color', 'typography', 'layout', 'imagery', 'texture'] as const;
type DetailFocus = (typeof DETAIL_FOCUSES)[number];
const UNCLEAR_OPTION_LABEL = '잘 모르겠어요';
const STRATEGY_CORE_CLARIFICATION_FIELDS: StrategyClarificationField[] = [
    'decisionPriority',
    'mustAvoid',
    'mustAmplify',
    'scopeNow',
    'reviewCriteria',
];
const STRATEGY_LIST_FIELDS: StrategyFieldKey[] = [
    'pointsOfParity',
    'pointsOfDifference',
    'reasonsToBelieve',
    'personality',
    'principles',
    'equitiesToProtect',
    'mustAmplify',
    'mustAvoid',
    'decisionPriority',
    'tradeOffs',
    'mandatories',
    'noGo',
    'reviewCriteria',
    'openRisks',
    'openQuestionsForDesign',
];

type LLMProvider = 'anthropic' | 'gemini';

type GeminiGenerateContentResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message?: string;
    };
};

function getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();

    if (provider === 'gemini') return 'gemini';
    if (provider === 'anthropic') return 'anthropic';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    return 'anthropic';
}

function getAnthropicClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
}

function getAnthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
}

function getGeminiModel(): string {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

function compressBranches(candidateIds?: string[]): string {
    const target = candidateIds
        ? branchData.filter((branch) => candidateIds.includes(branch.branchId))
        : branchData;

    return JSON.stringify(
        target.map((branch) => ({
            id: branch.branchId,
            label: branch.branchLabel,
            adjective: branch.adjective,
            descriptionDesigner: branch.descriptionDesigner,
            descriptionClient: branch.descriptionClient,
            confusable: branch.confusableBranches,
            distinctionKey: branch.distinctionKey,
            contrastQuestion: branch.contrastQuestion,
            antiSignals: branch.antiSignals,
            references: branch.references,
        }))
    );
}

function buildFreeformContextPrompt(userContext: UserContext): string {
    const parts: string[] = [];

    if (userContext.brandDescription) {
        parts.push(`Brand: ${userContext.brandDescription}`);
    }
    if (userContext.positioningNote) {
        parts.push(`Positioning: ${userContext.positioningNote}`);
    }
    if (userContext.additionalContext) {
        parts.push(`Additional context: ${userContext.additionalContext}`);
    }

    if (userContext.projectStage && ctxData.projectStage[userContext.projectStage]) {
        const option = ctxData.projectStage[userContext.projectStage];
        parts.push(`Project stage: ${userContext.projectStage} (boost: ${option.boost.join(',')}, suppress: ${option.suppress.join(',')})`);
    }

    if (parts.length === 0) {
        return compressContext(userContext);
    }

    return `Freeform context from strategist:\n${parts.join('\n')}\n\nUse this context to infer which branches to boost/suppress. Do not require exact category matches.`;
}

function compressContext(userContext: UserContext): string {
    const result: Record<string, { boost: string[]; suppress: string[] }> = {};

    if (userContext.industry && ctxData.industry[userContext.industry]) {
        const option = ctxData.industry[userContext.industry];
        result.industry = { boost: option.boost, suppress: option.suppress };
    }
    if (userContext.pricePosition && ctxData.pricePosition[userContext.pricePosition]) {
        const option = ctxData.pricePosition[userContext.pricePosition];
        result.pricePosition = { boost: option.boost, suppress: option.suppress };
    }
    if (userContext.projectStage && ctxData.projectStage[userContext.projectStage]) {
        const option = ctxData.projectStage[userContext.projectStage];
        result.projectStage = { boost: option.boost, suppress: option.suppress };
    }
    if (userContext.targetAge && ctxData.targetAge[userContext.targetAge]) {
        const option = ctxData.targetAge[userContext.targetAge];
        result.targetAge = { boost: option.boost, suppress: option.suppress };
    }

    return JSON.stringify(result);
}

const BASE_SYSTEM_PROMPT = `You are DCTS, a question engine for translating vague client design feedback into a concrete direction.

Rules:
- Ask in plain Korean suitable for non-designers.
- Do not use design jargon in questions or options.
- Ask one question at a time.
- Always frame questions relative to the current proposal.
- First infer what the client likely means before mapping to ontology branches.
- Make each question sound like it understood the client's feedback, not like it is exposing internal branch labels.
- Keep the total question count to ${MAX_QUESTIONS} or fewer.
- Prefer questions that resolve the most important remaining uncertainty while still helping narrow the candidate branches.
- Output JSON only, with no markdown fences or extra prose.
- Never invent branches outside the provided ontology.

If the feedback mixes multiple qualities, you may reflect that in primary/secondary interpretation, but still stay within the provided branch IDs.`;

function parseJSON<T>(text: string): T {
    let cleaned = text.trim();

    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }

    return JSON.parse(cleaned.trim()) as T;
}

function validateBranchIds(ids: string[]): string[] {
    const validIds = branchData.map((branch) => branch.branchId);
    return ids.filter((id) => validIds.includes(id));
}

function normalizeText(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizeUncertainAspects(values: string[] | undefined, fallbackAxis: string): string[] {
    const normalized = (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3);

    if (normalized.length > 0) {
        return normalized;
    }

    return fallbackAxis.trim() ? [fallbackAxis.trim()] : ['어떤 방향 차이가 가장 중요한지'];
}

function splitDirection(direction: string): string[] {
    return direction
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function sanitizeQuestionOptions(
    options: LLMQuestionOption[] | undefined,
    allowedBranchIds: string[],
    mode: 'branch' | 'detail'
): LLMQuestionOption[] {
    const sanitized = (options ?? [])
        .map((option) => {
            const label = option.label?.trim();
            const direction = option.direction?.trim() ?? '';

            if (!label) return null;

            if (mode === 'detail') {
                if (direction === '' || direction.startsWith('detail:')) {
                    return { label, direction };
                }

                return null;
            }

            if (direction === '') {
                return { label, direction };
            }

            const validDirectionIds = validateBranchIds(splitDirection(direction))
                .filter((id) => allowedBranchIds.includes(id));

            if (validDirectionIds.length === 0) {
                return null;
            }

            return {
                label,
                direction: validDirectionIds.join(','),
            };
        })
        .filter((option): option is LLMQuestionOption => option !== null);

    if (sanitized.some((option) => option.direction === '')) {
        return sanitized;
    }

    return [
        ...sanitized.slice(0, 2),
        { label: UNCLEAR_OPTION_LABEL, direction: '' },
    ];
}

function normalizeDetailFocus(detailFocus: string | undefined): DetailFocus {
    if (detailFocus && DETAIL_FOCUSES.includes(detailFocus as DetailFocus)) {
        return detailFocus as DetailFocus;
    }

    return 'layout';
}

function splitStrategyList(value: string): string[] {
    return value
        .split(/\r?\n|,|;|\/+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeStrategySchema(
    schema: StrategyTranslationSchema | undefined
): StrategyTranslationSchema {
    const normalized: Partial<StrategyTranslationSchema> = { ...(schema ?? {}) };

    STRATEGY_LIST_FIELDS.forEach((field) => {
        const value = normalized[field];

        if (Array.isArray(value)) {
            const cleaned = value
                .map((item) => item.trim())
                .filter(Boolean);

            (normalized as Record<StrategyFieldKey, string[] | string | undefined>)[field] = cleaned;
        }
    });

    return normalized as StrategyTranslationSchema;
}

function isStrategyFieldMissing(
    schema: StrategyTranslationSchema,
    field: StrategyFieldKey
): boolean {
    const value = schema[field];

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    return !value || value.trim().length === 0;
}

function buildStrategyStateSummary(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema
): string {
    const lines: string[] = [];
    const readableLines: string[] = [];

    if (artifactType) {
        readableLines.push(`${STRATEGY_ARTIFACT_LABELS[artifactType]} 기준으로 정리 중입니다.`);
    }

    if (schema.businessChallenge) {
        readableLines.push(`이번 차수의 핵심 과제는 ${schema.businessChallenge}입니다.`);
    }

    if (schema.pointsOfDifference?.length) {
        readableLines.push(`차별화 포인트는 ${schema.pointsOfDifference.join(', ')}입니다.`);
    }

    if (schema.equitiesToProtect?.length) {
        readableLines.push(`지켜야 할 자산은 ${schema.equitiesToProtect.join(', ')}입니다.`);
    }

    if (readableLines.length > 0) {
        return readableLines.join(' ').trim();
    }

    if (artifactType) {
        lines.push(`${STRATEGY_ARTIFACT_LABELS[artifactType]} 기준으로 정리 중입니다.`);
    }

    if (schema.businessChallenge) {
        lines.push(`핵심 과제는 ${schema.businessChallenge}입니다.`);
    }

    if (schema.pointsOfDifference?.length) {
        lines.push(`반드시 달라 보여야 하는 축은 ${schema.pointsOfDifference.join(', ')}입니다.`);
    }

    if (schema.equitiesToProtect?.length) {
        lines.push(`지켜야 할 자산은 ${schema.equitiesToProtect.join(', ')}입니다.`);
    }

    return lines.join(' ').trim();
}

function normalizeComparableText(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericStrategyText(value: string): boolean {
    const normalized = normalizeComparableText(value);

    if (normalized.length <= 2) {
        return true;
    }

    return [
        /^(느낌|무드|방향|감성|세련|고급|깔끔|트렌디|브랜드다움)$/,
        /^(좋게|잘)$/,
        /^(세련되게|고급스럽게|깔끔하게|트렌디하게|감성적으로|브랜드답게)$/,
    ].some((pattern) => pattern.test(normalized));
}

function detectWeakStrategyFields(schema: StrategyTranslationSchema): StrategyFieldKey[] {
    const weakFields = new Set<StrategyFieldKey>();
    const shortStringRules: Array<[StrategyFieldKey, number]> = [
        ['businessChallenge', 18],
        ['audienceContext', 18],
        ['frameOfReference', 12],
        ['valueProposition', 14],
        ['brandPromise', 12],
        ['scopeNow', 12],
    ];

    shortStringRules.forEach(([field, minLength]) => {
        const value = schema[field];
        if (typeof value === 'string' && value.trim()) {
            if (value.trim().length < minLength || isGenericStrategyText(value)) {
                weakFields.add(field);
            }
        }
    });

    if (!schema.scopeNow && typeof schema.scope === 'string' && schema.scope.trim()) {
        if (schema.scope.trim().length < 12 || isGenericStrategyText(schema.scope)) {
            weakFields.add('scope');
        }
    }

    const listRules: Array<[StrategyFieldKey, number, number]> = [
        ['pointsOfDifference', 2, 6],
        ['reasonsToBelieve', 1, 6],
        ['principles', 2, 6],
        ['equitiesToProtect', 1, 6],
        ['mustAmplify', 2, 4],
        ['mustAvoid', 1, 6],
        ['decisionPriority', 1, 8],
        ['tradeOffs', 1, 8],
        ['mandatories', 1, 6],
        ['noGo', 1, 6],
        ['reviewCriteria', 2, 6],
        ['openQuestionsForDesign', 1, 8],
    ];

    listRules.forEach(([field, minItems, minItemLength]) => {
        const value = schema[field];
        if (!Array.isArray(value) || value.length === 0) {
            return;
        }

        const meaningfulItems = value.filter((item) => (
            item.trim().length >= minItemLength && !isGenericStrategyText(item)
        ));

        if (meaningfulItems.length < minItems) {
            weakFields.add(field);
        }
    });

    return [...weakFields];
}

function evaluateStrategyActionability(schema: StrategyTranslationSchema): {
    actionable: boolean;
    notes: string[];
} {
    const notes: string[] = [];

    if (!(schema.mustAmplify?.length || schema.principles?.length || schema.mandatories?.length)) {
        notes.push('무엇을 더 밀어야 하는지에 대한 지시가 아직 약합니다.');
    }

    if (!(schema.mustAvoid?.length || schema.noGo?.length)) {
        notes.push('어디서 멈춰야 하는지에 대한 금지선이 비어 있습니다.');
    }

    if (!(schema.scopeNow?.trim() || schema.scope?.trim())) {
        notes.push('이번 차수에서 실제로 바꿀 범위가 분명하지 않습니다.');
    }

    if (!(schema.reviewCriteria?.length && schema.reviewCriteria.length >= 2)) {
        notes.push('디자인 리뷰 때 확인할 성공 기준이 충분히 구체적이지 않습니다.');
    }

    return {
        actionable: notes.length === 0,
        notes: notes.length > 0
            ? notes
            : ['디자이너가 바로 판단에 사용할 기준이 준비되어 있습니다.'],
    };
}

function buildStrategyReadinessChecks(
    missingFields: StrategyFieldKey[],
    weakFields: StrategyFieldKey[],
    contradictions: string[],
    actionableNotes: string[]
): StrategyReadinessChecks {
    const actionable = actionableNotes.length === 1 &&
        actionableNotes[0] === '디자이너가 바로 판단에 사용할 기준이 준비되어 있습니다.';

    return {
        complete: missingFields.length === 0,
        specific: weakFields.length === 0,
        coherent: contradictions.length === 0,
        actionable,
        completeNotes: missingFields.length > 0
            ? [`아직 비어 있는 핵심 항목: ${missingFields.map((field) => STRATEGY_FIELD_LABELS[field]).join(', ')}`]
            : ['필수 handoff 정보가 채워져 있습니다.'],
        specificNotes: weakFields.length > 0
            ? [`더 구체화가 필요한 항목: ${weakFields.map((field) => STRATEGY_FIELD_LABELS[field]).join(', ')}`]
            : ['핵심 표현이 디자이너가 해석 가능한 수준으로 구체적입니다.'],
        coherentNotes: contradictions.length > 0
            ? contradictions
            : ['상충되는 지시가 크게 보이지 않습니다.'],
        actionableNotes,
    };
}

function detectStrategyContradictions(schema: StrategyTranslationSchema): string[] {
    const contradictions: string[] = [];
    const allText = [
        schema.businessChallenge,
        schema.valueProposition,
        schema.brandPromise,
        schema.scope,
        schema.scopeNow,
        ...(schema.pointsOfDifference ?? []),
        ...(schema.mustAmplify ?? []),
        ...(schema.mustAvoid ?? []),
        ...(schema.noGo ?? []),
    ]
        .filter(Boolean)
        .join(' ');

    const amplify = new Set((schema.mustAmplify ?? []).map(normalizeComparableText));
    const avoid = new Set((schema.mustAvoid ?? []).map(normalizeComparableText));
    const overlap = [...amplify].filter((item) => avoid.has(item));

    if (overlap.length > 0) {
        contradictions.push(`강화해야 할 인상과 피해야 할 방향이 겹칩니다: ${overlap.join(', ')}`);
    }

    if (
        /프리미엄/.test(allText) &&
        /(저가|가성비|최저가)/.test(allText)
    ) {
        contradictions.push('프리미엄 강화와 저가/가성비 중심 요구가 동시에 들어 있어 우선순위 확인이 필요합니다.');
    }

    if (
        schema.scope?.includes('로고 변경') &&
        /(불가|제외|어렵)/.test(schema.scope) &&
        /(전면|완전|재정의|새롭게)/.test(allText)
    ) {
        contradictions.push('로고 변경이 제한된 상태에서 전면 재정의 수준의 변화가 동시에 요구되고 있습니다.');
    }

    return contradictions;
}

function inferStrategyArtifactType(feedbackText: string): StrategyArtifactType | undefined {
    const lowered = feedbackText.toLowerCase();

    if (/(architecture|endorse|house of brands|branded house|아키텍처|서브브랜드|마스터브랜드)/i.test(lowered)) {
        return 'brand_architecture';
    }

    if (/(principle|experience|ux principle|원칙|경험 원칙|디자인 원칙)/i.test(lowered)) {
        return 'experience_principles';
    }

    if (/(campaign|creative brief|smp|캠페인|크리에이티브 브리프)/i.test(lowered)) {
        return 'campaign_or_creative_brief_seed';
    }

    if (/(refresh|identity|rebrand|리프레시|리브랜딩|아이덴티티)/i.test(lowered)) {
        return 'identity_refresh_scope';
    }

    if (/(platform|promise|brand platform|브랜드 플랫폼|브랜드 약속)/i.test(lowered)) {
        return 'brand_platform';
    }

    if (feedbackText.trim().length > 0) {
        return 'positioning';
    }

    return undefined;
}

function heuristicStrategySchema(
    feedbackText: string,
    userContext: UserContext
): {
    artifactType?: StrategyArtifactType;
    schema: StrategyTranslationSchema;
    summary: string;
} {
    const artifactType = inferStrategyArtifactType(feedbackText);
    const schema: StrategyTranslationSchema = {};

    if (feedbackText.trim()) {
        schema.businessChallenge = feedbackText.trim().split('\n')[0].slice(0, 120);
    }

    if (userContext.brandDescription || userContext.positioningNote || userContext.additionalContext) {
        schema.audienceContext = [
            userContext.brandDescription,
            userContext.positioningNote,
            userContext.additionalContext,
        ]
            .filter(Boolean)
            .join(' / ');
    }

    if (userContext.projectStage) {
        schema.scope = `${userContext.projectStage} 기준의 조정`;
    }

    if (userContext.projectStage && !schema.scopeNow) {
        schema.scopeNow = `${userContext.projectStage} 기준에서 우선 조정할 범위`;
    }

    return {
        artifactType,
        schema,
        summary: buildStrategyStateSummary(artifactType, schema),
    };
}

function buildStrategySnapshot(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema,
    userContext?: UserContext
): string {
    const parts: string[] = [];

    if (artifactType) {
        parts.push(`Artifact: ${STRATEGY_ARTIFACT_LABELS[artifactType]}`);
    }

    (
        [
            'businessChallenge',
            'audienceContext',
            'frameOfReference',
            'valueProposition',
            'brandPromise',
            'scope',
            'scopeNow',
        ] satisfies StrategyFieldKey[]
    ).forEach((field) => {
        const value = schema[field];
        if (typeof value === 'string' && value.trim()) {
            parts.push(`${STRATEGY_FIELD_LABELS[field]}: ${value.trim()}`);
        }
    });

    STRATEGY_LIST_FIELDS.forEach((field) => {
        const values = schema[field];
        if (Array.isArray(values) && values.length > 0) {
            parts.push(`${STRATEGY_FIELD_LABELS[field]}: ${values.join(', ')}`);
        }
    });

    if (userContext?.brandDescription) {
        parts.push(`Brand: ${userContext.brandDescription}`);
    }

    return parts.join('\n');
}

function normalizeStrategyFieldValue(
    field: StrategyFieldKey,
    rawValue: string
): StrategyTranslationSchema[StrategyFieldKey] {
    if (STRATEGY_LIST_FIELDS.includes(field)) {
        return splitStrategyList(rawValue);
    }

    return rawValue.trim();
}

function scoreBranchesFromStrategyText(
    recommendedText: string,
    avoidedText = ''
): StrategyBranchMapping {
    const tokens = recommendedText
        .split(/[\s,./()'"!?[\]{}:;]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length >= 2);
    const avoidedTokens = avoidedText
        .split(/[\s,./()'"!?[\]{}:;]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length >= 2);

    const scored = branchData
        .map((branch) => {
            const haystack = [
                branch.branchLabel,
                branch.adjective,
                branch.descriptionDesigner,
                branch.descriptionClient,
                branch.descriptionStrategy,
                branch.positioningContext,
                branch.competitiveImplication,
            ]
                .join(' ')
                .toLowerCase();

            const score = tokens.reduce((sum, token) => (
                haystack.includes(token) ? sum + 1 : sum
            ), 0);
            const avoidScore = avoidedTokens.reduce((sum, token) => (
                haystack.includes(token) ? sum + 1 : sum
            ), 0);

            return { branchId: branch.branchId, score, avoidScore };
        })
        .filter((item) => item.score > 0 || item.avoidScore > 0);

    const recommended = scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    const avoided = scored
        .filter((item) => item.avoidScore > 0)
        .sort((a, b) => b.avoidScore - a.avoidScore);

    const recommendedBranchIds = recommended.slice(0, 3).map((item) => item.branchId);
    const avoidedBranchIds = avoided
        .map((item) => item.branchId)
        .filter((branchId) => !recommendedBranchIds.includes(branchId))
        .slice(0, 2);

    return {
        recommendedBranchIds,
        avoidedBranchIds,
        rationale: recommended.length > 0 || avoided.length > 0
            ? avoidedBranchIds.length > 0
                ? '강화해야 할 기준과 피해야 할 기준을 분리해 시각 방향을 매핑했습니다.'
                : '전략 문장과 브랜치 설명 간의 공통 키워드를 기준으로 시각 방향을 매핑했습니다.'
            : '전략 기준과 직접 맞닿는 브랜치를 충분히 찾지 못했습니다.',
        confidence: recommended.length > 0 ? Math.min(0.8, 0.35 + recommended[0].score * 0.05) : 0.2,
    };
}

function getNextStrategyTargetField(
    strategyState: StrategyState
): StrategyFieldKey | 'artifactType' | null {
    if (!strategyState.artifactType) {
        return 'artifactType';
    }

    const rankedMissingFields = rankStrategyFieldsByRisk(
        strategyState.missingFields,
        strategyState.artifactType
    );

    return rankedMissingFields[0] ?? null;
}

function getNextStrategyWeakField(strategyState: StrategyState): StrategyFieldKey | null {
    if (!strategyState.artifactType) {
        return null;
    }

    const rankedWeakFields = rankStrategyFieldsByRisk(
        strategyState.weakFields.filter(
            (field) => !strategyState.missingFields.includes(field)
        ),
        strategyState.artifactType
    );

    return rankedWeakFields[0] ?? null;
}

function buildStrategyFieldQuestion(field: StrategyFieldKey): string {
    switch (field) {
        case 'businessChallenge':
            return '이번 작업에서 실제로 움직여야 하는 문제를 한 문장으로 적어 주세요. 인지도, 프리미엄 인식, 신뢰 회복, 내부 정렬처럼 가장 중요한 과제를 중심으로요.';
        case 'audienceContext':
            return '이번 변화가 누구의 어떤 상황에서 인식 전환을 만들어야 하는지 적어 주세요. 핵심 타깃과 맥락을 함께 알려 주세요.';
        case 'frameOfReference':
            return '이 브랜드가 실제로 어떤 시장 프레임 안에서 비교되는지 적어 주세요. 디자이너가 어떤 카테고리 규칙을 먼저 이해해야 하나요?';
        case 'pointsOfParity':
            return '카테고리 안에서 기본적으로 갖춰 보여야 하는 기대치를 적어 주세요. 없으면 왜 기본값을 깨도 되는지도 함께 적어 주세요.';
        case 'pointsOfDifference':
            return '경쟁사와 반드시 달라 보여야 하는 차별 축을 적어 주세요. 기능, 태도, 세계관, 서비스 경험, 문화적 코드 중 무엇이 1순위인가요?';
        case 'valueProposition':
            return '이 브랜드가 고객에게 제공하는 핵심 가치 제안을 한두 문장으로 적어 주세요.';
        case 'reasonsToBelieve':
            return '그 약속을 믿게 만드는 근거를 적어 주세요. 제품력, 기술, 운영 방식, 헤리티지, 커뮤니티 등 무엇이 있나요?';
        case 'brandPromise':
            return '브랜드가 일관되게 약속해야 하는 경험이나 인식 한 줄을 적어 주세요.';
        case 'personality':
            return '브랜드가 어떤 성격으로 인식되길 원하는지 3개 안팎의 단어로 적어 주세요.';
        case 'principles':
            return '시안을 평가할 때 기준이 될 디자인 원칙을 3~5개 정도 적어 주세요. 취향이 아니라 판단 기준이 되도록 적어 주세요.';
        case 'equitiesToProtect':
            return '이번 작업에서 절대 잃으면 안 되는 자산을 적어 주세요. 식별 자산이든 인식 자산이든 모두 포함 가능합니다.';
        case 'mandatories':
            return '반드시 반영되어야 하는 요소를 적어 주세요. 채널, 카피 톤, 구조, 운영 제약도 포함 가능합니다.';
        case 'noGo':
            return '이번 작업에서 절대 가면 안 되는 방향이나 금지 요소를 적어 주세요.';
        case 'scope':
            return '이번 차수에서 실제로 바꿀 수 있는 범위와 바꿀 수 없는 범위를 적어 주세요.';
        case 'reviewCriteria':
            return '시안을 볼 때 성공 판정을 무엇으로 내릴지 적어 주세요. “더 좋아 보이는가” 말고 어떤 인식 변화가 보여야 하나요?';
        case 'openRisks':
            return '아직 합의되지 않았거나 리뷰 시점에 문제가 될 수 있는 리스크가 있다면 적어 주세요.';
        default:
            return `${STRATEGY_FIELD_LABELS[field]}에 해당하는 내용을 적어 주세요.`;
    }
}

function buildHandoffStrategyQuestion(field: StrategyFieldKey): string {
    switch (field) {
        case 'businessChallenge':
            return '이번 차수에서 실제로 해결해야 하는 문제를 한두 문장으로 적어 주세요. 인지도, 프리미엄 인식, 신뢰 회복, 전환 개선처럼 무엇이 핵심 과제인지가 보여야 합니다.';
        case 'audienceContext':
            return '이번 변화가 누구에게 어떤 상황에서 의미 있게 인식되어야 하는지 적어 주세요. 타깃과 사용 맥락이 함께 보이면 좋습니다.';
        case 'frameOfReference':
            return '이 브랜드가 실제로 어떤 시장 프레임 안에서 비교되는지 적어 주세요. 디자이너가 어떤 카테고리 규칙을 먼저 이해해야 하는지가 보여야 합니다.';
        case 'pointsOfParity':
            return '카테고리 안에서 기본적으로 갖춰 보여야 하는 기대값을 적어 주세요. 이것이 없으면 기본 신뢰를 잃는 요소가 무엇인지도 포함해 주세요.';
        case 'pointsOfDifference':
            return '경쟁사와 달라 보이게 해야 하는 차별화 포인트를 2개 이상 적어 주세요. 기능, 태도, 관계 방식, 문화 코드 중 무엇이 핵심인지 드러나면 좋습니다.';
        case 'valueProposition':
            return '이 브랜드가 고객에게 주는 핵심 가치 제안을 한두 문장으로 적어 주세요.';
        case 'reasonsToBelieve':
            return '그 가치 제안을 믿게 만드는 근거를 적어 주세요. 제품 기술, 운영 방식, 역사, 커뮤니티 등 무엇이든 가능합니다.';
        case 'brandPromise':
            return '브랜드가 일관되게 약속해야 하는 경험이나 인식의 수준을 적어 주세요.';
        case 'personality':
            return '브랜드가 어떤 성격으로 인식되길 원하는지 3개 안팎의 표현으로 적어 주세요.';
        case 'principles':
            return '시안 판단의 기준이 되는 디자인 원칙을 3~5개 정도 적어 주세요. 취향이 아니라 의사결정 기준이어야 합니다.';
        case 'equitiesToProtect':
            return '이번 작업에서 절대 잃으면 안 되는 브랜드 자산을 적어 주세요. 식별 자산과 인식 자산 모두 포함 가능합니다.';
        case 'mustAmplify':
            return '이번 차수에서 더 강하게 보여야 하는 인상이나 신호를 2개 이상 적어 주세요.';
        case 'mustAvoid':
            return '이번 차수에서 피해야 하는 방향이나 오해받기 쉬운 인상을 적어 주세요.';
        case 'decisionPriority':
            return '판단이 충돌할 때 이번 차수에서 무엇을 먼저 지킬지 적어 주세요. 신뢰 유지, 새로운 인상 강화, 정보 전달 명확성처럼 바로 고를 수 있는 우선순위면 좋습니다.';
        case 'tradeOffs':
            return '이번 작업에서 감수할 수 있는 것과 감수할 수 없는 트레이드오프를 적어 주세요.';
        case 'mandatories':
            return '반드시 반영되어야 하는 요소를 적어 주세요. 채널, 카피, 구조, 운영 제약 등도 포함 가능합니다.';
        case 'noGo':
            return '이번 작업에서 절대 가면 안 되는 방향이나 금지 요소를 적어 주세요.';
        case 'scope':
            return '전체 프로젝트 관점에서 바꿀 수 있는 범위와 바꾸지 않을 범위를 적어 주세요.';
        case 'scopeNow':
            return '이번 리뷰에서 먼저 맞춰야 하는 표면이나 구간을 적어 주세요. 패키지 전면, 첫 화면, 상세페이지 핵심 구간처럼 실제 시안 범위가 바로 떠오르면 좋습니다. 이번 차수에서 잠시 뒤로 미루는 범위가 있다면 함께 적어 주세요.';
        case 'reviewCriteria':
            return '리뷰 자리에서 무엇이 먼저 보이면 "됐다"라고 볼 수 있는지 적어 주세요. 예쁘다보다 첫 인상, 기존 고객 반응, 표면 간 일관성처럼 관찰 가능한 기준이면 좋습니다.';
        case 'openRisks':
            return '아직 합의되지 않았거나 리뷰 시점에 문제가 될 수 있는 리스크가 있다면 적어 주세요.';
        case 'openQuestionsForDesign':
            return '디자이너팀과 추가로 확인해야 할 질문이나 판단 보류 지점을 적어 주세요.';
        default:
            return buildStrategyFieldQuestion(field);
    }
}

function buildStrategyQualityQuestion(field: StrategyFieldKey): string {
    switch (field) {
        case 'decisionPriority':
            return '지금 정리된 우선순위가 아직 추상적입니다. 디자이너가 충돌 상황에서 바로 고를 수 있게, 이번 차수에서 무엇을 먼저 지킬지 한 문장으로 더 선명하게 적어 주세요.';
        case 'scopeNow':
            return '지금 범위 표현이 아직 넓습니다. 이번 리뷰에서 먼저 맞춰야 하는 표면이나 구간이 바로 보이도록 더 구체적으로 적어 주세요.';
        case 'reviewCriteria':
            return '지금 리뷰 기준이 아직 추상적입니다. 리뷰 자리에서 무엇이 먼저 보이면 "됐다"라고 볼 수 있는지 관찰 가능한 표현으로 적어 주세요.';
        default:
            return `현재 정리된 ${STRATEGY_FIELD_LABELS[field]}이 다소 추상적입니다. 디자이너가 바로 판단에 쓸 수 있도록 조금 더 구체적으로 적어 주세요.\n${buildHandoffStrategyQuestion(field)}`;
    }
}

async function callAnthropic(systemPrompt: string, userMessage: string): Promise<string> {
    const client = getAnthropicClient();

    const response = await client.messages.create({
        model: getAnthropicModel(),
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Anthropic response did not contain text');
    }

    return textBlock.text;
}

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: userMessage }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    const payload = (await response.json()) as GeminiGenerateContentResponse;

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini request failed with ${response.status}`);
    }

    const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

    if (!text) {
        throw new Error('Gemini response did not contain text');
    }

    return text;
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    if (getProvider() === 'gemini') {
        return callGemini(systemPrompt, userMessage);
    }

    return callAnthropic(systemPrompt, userMessage);
}

export async function analyzeInitialFeedback(
    feedbackText: string,
    userContext: UserContext,
    inputRole: InputRole = 'client'
): Promise<LLMInitialAnalysis> {
    const roleInstruction = inputRole === 'strategist'
        ? `The input comes from a strategist/AE, not a client.
The language is more structured and may include positioning terms.
Treat the input as a professional interpretation, not raw feedback.
You can narrow candidates more aggressively since the input is more precise.`
        : `The input comes from raw client feedback.
The language is vague and emotional.
Ask questions in plain Korean suitable for non-designers.`;

    const contextBlock = inputRole === 'strategist'
        ? buildFreeformContextPrompt(userContext)
        : compressContext(userContext);

    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${roleInstruction}

Ontology branches:
${compressBranches()}

Context weighting:
${contextBlock}`;

    const userMessage = `Client feedback: "${feedbackText}"

Return this JSON exactly:
{
  "feedbackType": "directional" | "negative" | "ambiguous",
  "axis": "string",
  "intentInterpretation": "1-2 sentence Korean paraphrase of what the client seems to mean",
  "uncertainAspects": ["remaining uncertainty 1", "remaining uncertainty 2"],
  "candidates": ["branch ids"],
  "eliminated": ["branch ids"],
  "question": "plain Korean question",
  "options": [
    { "label": "option text", "direction": "branchId or comma-separated branchIds" },
    { "label": "option text", "direction": "branchId or comma-separated branchIds" },
    { "label": "${UNCLEAR_OPTION_LABEL}", "direction": "" }
  ]
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMInitialAnalysis>(rawResponse);
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminated = validateBranchIds(parsed.eliminated);
            parsed.intentInterpretation = normalizeText(
                parsed.intentInterpretation,
                `클라이언트는 "${feedbackText}"라는 표현으로 현재 시안의 방향을 더 분명하게 설명하려고 합니다.`
            );
            parsed.uncertainAspects = normalizeUncertainAspects(parsed.uncertainAspects, parsed.axis);
            parsed.options = sanitizeQuestionOptions(parsed.options, parsed.candidates, 'branch');
            parsed.question = normalizeText(
                parsed.question,
                '지금 말씀하신 뜻에 더 가까운 쪽이 어느 방향인지 알려주세요.'
            );

            if (parsed.candidates.length === 0 || parsed.options.length < 2) {
                throw new Error('Initial analysis did not produce enough valid candidates/options');
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Initial LLM analysis failed');
}

export async function refineFeedbackExpression(
    feedbackText: string,
    userContext: UserContext
): Promise<RefineFeedbackResponse> {
    const systemPrompt = `You expand client feedback into a more specific Korean expression for a design feedback intake flow.

Rules:
- Preserve the client's original intent.
- Do not add intent that the client did not write or imply.
- Make the emotional direction more explicit only when it is already implied.
- Do not use design jargon.
- Limit the output to 1 or 2 plain Korean sentences.
- Refer to the ontology and context internally, but never expose branch labels, IDs, or ontology structure.
- Return JSON only.`;

    const userMessage = `Original feedback: "${feedbackText}"

Ontology reference:
${compressBranches()}

Context weighting:
${compressContext(userContext)}

Return JSON:
{
  "refinedText": "one refined Korean expression"
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<RefineFeedbackResponse>(rawResponse);
            parsed.refinedText = parsed.refinedText.trim();

            if (!parsed.refinedText) {
                throw new Error('Refined feedback is empty');
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Feedback refinement failed');
}

export async function generateFollowUp(
    sessionState: SessionState
): Promise<LLMFollowUpResponse> {
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

Candidate branches:
${compressBranches(sessionState.candidates)}

Context weighting:
${compressContext(sessionState.userContext)}`;

    const history = sessionState.answerHistory
        .map(
            (answer, index) =>
                `Q${index + 1}: "${answer.question}" -> "${answer.selectedLabel}" (${answer.selectedDirection || 'none'})`
        )
        .join('\n');

    const userMessage = `Session state
- Original feedback: "${sessionState.originalFeedback}"
- Current interpretation: "${sessionState.intentInterpretation ?? '아직 정리되지 않음'}"
- Remaining uncertainty: [${(sessionState.uncertainAspects ?? []).join(', ')}]
- History:
${history || '(none)'}
- Remaining candidates: [${sessionState.candidates.join(', ')}]
- Eliminated: [${sessionState.eliminated.join(', ')}]
- Question count: ${sessionState.questionCount}/${MAX_QUESTIONS}

Return JSON:
{
  "eliminatedNow": ["branch ids"],
  "eliminationReason": "string",
  "candidates": ["branch ids"],
  "converged": true | false,
  "intentInterpretation": "updated Korean interpretation",
  "uncertainAspects": ["remaining uncertainty 1", "remaining uncertainty 2"],
  "question": "plain Korean question if not converged",
  "options": [
    { "label": "option text", "direction": "branch id(s)" },
    { "label": "option text", "direction": "branch id(s)" },
    { "label": "${UNCLEAR_OPTION_LABEL}", "direction": "" }
  ],
  "primaryBranch": "branch id if converged",
  "secondaryBranch": "branch id or null if converged",
  "reasoning": "string if converged"
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMFollowUpResponse>(rawResponse);
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminatedNow = validateBranchIds(parsed.eliminatedNow);
            parsed.intentInterpretation = normalizeText(
                parsed.intentInterpretation,
                sessionState.intentInterpretation ?? '클라이언트 의도 해석이 아직 충분히 정리되지 않았습니다.'
            );
            parsed.uncertainAspects = normalizeUncertainAspects(
                parsed.uncertainAspects,
                sessionState.uncertainAspects?.[0] ?? '어떤 방향 차이가 더 중요한지'
            );

            if (parsed.primaryBranch) {
                const validated = validateBranchIds([parsed.primaryBranch]);
                parsed.primaryBranch = validated[0] || parsed.candidates[0];
            }

            if (parsed.secondaryBranch) {
                const validated = validateBranchIds([parsed.secondaryBranch]);
                parsed.secondaryBranch = validated[0] ?? null;
            }

            if (!parsed.converged) {
                parsed.options = sanitizeQuestionOptions(parsed.options, parsed.candidates, 'branch');
                parsed.question = normalizeText(
                    parsed.question,
                    '지금 말씀하신 뜻을 더 정확히 이해하려면 어느 쪽에 더 가까운지 알려주세요.'
                );

                if (parsed.candidates.length === 0 || (parsed.options?.length ?? 0) < 2) {
                    throw new Error('Follow-up generation did not produce enough valid candidates/options');
                }
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Follow-up LLM generation failed');
}

export async function generateDetailQuestion(
    sessionState: SessionState
): Promise<LLMFollowUpResponse> {
    const primaryBranch = sessionState.primaryBranch
        ? branchData.find((branch) => branch.branchId === sessionState.primaryBranch)
        : null;
    const secondaryBranch = sessionState.secondaryBranch
        ? branchData.find((branch) => branch.branchId === sessionState.secondaryBranch)
        : null;
    const primaryToken = sessionState.primaryBranch
        ? tokenData.find((token) => token.branchId === sessionState.primaryBranch)
        : null;

    if (!primaryBranch) {
        throw new Error('Primary branch is required for detail questions');
    }

    const history = sessionState.answerHistory
        .map((answer, index) => `Q${index + 1}: "${answer.question}" -> "${answer.selectedLabel}"`)
        .join('\n');
    const usedDetailFocuses = sessionState.detailFocusHistory ?? [];
    const remainingDetailFocuses = DETAIL_FOCUSES
        .filter((focus) => !usedDetailFocuses.includes(focus));

    const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are now in the detail refinement phase.
- The ontology branch has already been selected.
- Do not ask branch-selection questions again.
- Ask an execution-level question that sharpens the brief.
- Choose exactly one detail focus from: color, typography, layout, imagery, texture.
- Prefer a focus that has not been asked yet.
- Keep it in plain Korean.
- Return converged=false with one question until enough detail is collected.`;

    const userMessage = `Current resolved direction
- Original feedback: "${sessionState.originalFeedback}"
- Current interpretation: "${sessionState.intentInterpretation ?? '아직 정리되지 않음'}"
- Primary branch: ${primaryBranch.branchId} (${primaryBranch.branchLabel})
- Secondary branch: ${secondaryBranch ? `${secondaryBranch.branchId} (${secondaryBranch.branchLabel})` : 'none'}
- Detail questions already asked: ${sessionState.detailQuestionCount ?? 0}
- Used detail focuses: ${usedDetailFocuses.join(', ') || 'none'}
- Preferred remaining detail focuses: ${remainingDetailFocuses.join(', ') || 'none'}
- Full history:
${history || '(none)'}

Primary design token:
${primaryToken ? JSON.stringify(primaryToken) : 'none'}

Return JSON:
{
  "eliminatedNow": [],
  "eliminationReason": "detail refinement",
  "candidates": ["${primaryBranch.branchId}"${secondaryBranch ? `, "${secondaryBranch.branchId}"` : ''}],
  "converged": false,
  "detailFocus": "color | typography | layout | imagery | texture",
  "question": "plain Korean question",
  "options": [
    { "label": "option text", "direction": "detail:option-a" },
    { "label": "option text", "direction": "detail:option-b" },
    { "label": "${UNCLEAR_OPTION_LABEL}", "direction": "detail:unclear" }
  ]
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMFollowUpResponse>(rawResponse);
            const normalizedDetailFocus = normalizeDetailFocus(parsed.detailFocus);
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminatedNow = [];
            parsed.converged = false;
            parsed.detailFocus = remainingDetailFocuses.includes(normalizedDetailFocus)
                ? normalizedDetailFocus
                : remainingDetailFocuses[0] || 'layout';
            parsed.options = sanitizeQuestionOptions(parsed.options, [], 'detail');
            parsed.question = normalizeText(
                parsed.question,
                '이 방향을 더 구체화하려면 어떤 느낌으로 다듬는 게 좋을까요?'
            );

            if ((parsed.options?.length ?? 0) < 2) {
                throw new Error('Detail question generation did not produce enough valid options');
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Detail question generation failed');
}

export async function generateBriefSummary(
    sessionState: SessionState
): Promise<LLMBriefResponse> {
    const primaryBranch = branchData.find((branch) => branch.branchId === sessionState.primaryBranch);
    const secondaryBranch = sessionState.secondaryBranch
        ? branchData.find((branch) => branch.branchId === sessionState.secondaryBranch)
        : null;
    const primaryToken = tokenData.find((token) => token.branchId === sessionState.primaryBranch);
    const eliminatedBranches = sessionState.eliminated
        .map((id) => branchData.find((branch) => branch.branchId === id))
        .filter(Boolean);

    const systemPrompt = `You are generating a final DCTS brief summary.

Return JSON only.
- clientSummary: plain Korean, 2-3 sentences. For client confirmation.
- clientAntiSummary: plain Korean, 1-2 sentences.
- designerSummary: concise designer-facing reasoning.
- adjustmentNotes: concise notes reflecting the chosen branch, context, and execution details captured in later refinement answers.
- confusionWarnings: array of short warnings.
- strategySummary: 2-3 sentences in Korean. Why this direction makes sense from a brand strategy perspective. Include positioning logic and competitive differentiation rationale.
- strategyPositioningContext: 1-2 sentences in Korean. How this direction fits the brand's market position and target audience.
- strategyPersuasionGuide: 1-2 sentences in Korean. How to explain this direction to the client if they have concerns.`;

    const history = sessionState.answerHistory
        .map((answer, index) => `Q${index + 1}: "${answer.question}" -> "${answer.selectedLabel}"`)
        .join('\n');

    const userMessage = `Final session result
- Original feedback: "${sessionState.originalFeedback}"
- Interpretation: "${sessionState.intentInterpretation ?? 'none'}"
- Primary branch: ${primaryBranch ? `${primaryBranch.branchId} (${primaryBranch.branchLabel}) ${primaryBranch.descriptionDesigner}` : 'none'}
- Secondary branch: ${secondaryBranch ? `${secondaryBranch.branchId} (${secondaryBranch.branchLabel})` : 'none'}
- Eliminated branches: ${eliminatedBranches.map((branch) => branch ? `${branch.branchId}(${branch.branchLabel})` : '').join(', ') || 'none'}
- Reasoning: ${sessionState.reasoning || 'none'}
- Primary branch strategy: ${primaryBranch ? primaryBranch.descriptionStrategy : 'none'}
- Positioning context: ${primaryBranch ? primaryBranch.positioningContext : 'none'}
- Competitive implication: ${primaryBranch ? primaryBranch.competitiveImplication : 'none'}
- Detail focuses covered: ${(sessionState.detailFocusHistory ?? []).join(', ') || 'none'}
- History:
${history || '(none)'}

Primary design token:
${primaryToken ? JSON.stringify(primaryToken) : 'none'}

Confusable branches:
${primaryBranch
        ? primaryBranch.confusableBranches
            .map((id) => {
                const branch = branchData.find((candidate) => candidate.branchId === id);
                return branch ? `${branch.branchId}(${branch.branchLabel}): ${primaryBranch.distinctionKey}` : '';
            })
            .filter(Boolean)
            .join('\n')
        : 'none'}

Return JSON:
{
  "clientSummary": "string",
  "clientAntiSummary": "string",
  "designerSummary": "string",
  "adjustmentNotes": "string",
  "confusionWarnings": ["string"],
  "strategySummary": "string",
  "strategyPositioningContext": "string",
  "strategyPersuasionGuide": "string"
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            return parseJSON<LLMBriefResponse>(rawResponse);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Brief summary generation failed');
}

function coerceStrategyArtifactType(value: string | null | undefined): StrategyArtifactType | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    const normalized = trimmed.toLowerCase();
    const artifactIds = Object.keys(STRATEGY_ARTIFACT_LABELS) as StrategyArtifactType[];

    if (artifactIds.includes(normalized as StrategyArtifactType)) {
        return normalized as StrategyArtifactType;
    }

    return artifactIds.find((artifactType) => (
        STRATEGY_ARTIFACT_LABELS[artifactType] === trimmed
    ));
}

function mergeStrategyFieldValue(
    schema: StrategyTranslationSchema,
    field: StrategyFieldKey,
    rawValue: string
): StrategyTranslationSchema {
    const nextValue = normalizeStrategyFieldValue(field, rawValue);

    if (Array.isArray(nextValue)) {
        const existing = Array.isArray(schema[field]) ? schema[field] as string[] : [];
        return {
            ...schema,
            [field]: [...new Set([...existing, ...nextValue])],
        };
    }

    return {
        ...schema,
        [field]: nextValue,
    };
}

function setStrategyFieldValue(
    schema: StrategyTranslationSchema,
    field: StrategyFieldKey,
    rawValue: string
): StrategyTranslationSchema {
    const nextValue = normalizeStrategyFieldValue(field, rawValue);

    return {
        ...schema,
        [field]: nextValue,
    };
}

type StrategyDirectionOperation = 'set' | 'append' | 'fallback' | 'noop';

type ParsedStrategyDirection = {
    operation: StrategyDirectionOperation;
    field: StrategyFieldKey | 'artifactType';
    value: string;
};

function createStrategyDirection(
    operation: StrategyDirectionOperation,
    field: StrategyFieldKey | 'artifactType',
    value: string
): string {
    return `${operation}|${field}|${value}`;
}

export function parseStrategyDirectionOperation(
    direction: string
): ParsedStrategyDirection | null {
    if (!direction.includes('|')) {
        return null;
    }

    const firstPipeIndex = direction.indexOf('|');
    const secondPipeIndex = direction.indexOf('|', firstPipeIndex + 1);

    if (firstPipeIndex <= 0 || secondPipeIndex <= firstPipeIndex + 1) {
        return null;
    }

    const operation = direction.slice(0, firstPipeIndex) as StrategyDirectionOperation;
    const field = direction.slice(firstPipeIndex + 1, secondPipeIndex) as StrategyFieldKey | 'artifactType';
    const value = direction.slice(secondPipeIndex + 1);

    if (!['set', 'append', 'fallback', 'noop'].includes(operation)) {
        return null;
    }

    return {
        operation,
        field,
        value,
    };
}

function getStrategyAskedFieldCount(
    strategyState: StrategyState,
    field: StrategyFieldKey | 'artifactType'
): number {
    return strategyState.askedFieldCounts?.[field] ?? 0;
}

function getNextAskedFieldCounts(
    strategyState: StrategyState,
    field: StrategyFieldKey | 'artifactType'
): Partial<Record<StrategyFieldKey | 'artifactType', number>> {
    return {
        ...(strategyState.askedFieldCounts ?? {}),
        [field]: getStrategyAskedFieldCount(strategyState, field) + 1,
    };
}

function needsCoreStrategyClarification(
    strategyState: StrategyState,
    field: StrategyClarificationField
): boolean {
    if (field === 'decisionPriority' && strategyState.contradictions.length > 0) {
        return true;
    }

    if (field === 'mustAvoid') {
        const hasAvoidSignal = hasPerceptionRiskSignal({
            mustAvoid: strategyState.schema.mustAvoid,
            noGo: strategyState.schema.noGo,
        });

        if (!hasAvoidSignal) {
            return true;
        }
    }

    if (field === 'scopeNow' && !strategyState.schema.scopeNow?.trim()) {
        return true;
    }

    return strategyState.missingFields.includes(field) || strategyState.weakFields.includes(field);
}

function getStrategyClarificationOperationMode(
    field: StrategyClarificationField
): StrategyQuestionOperationMode {
    if (field === 'scopeNow' || field === 'decisionPriority') {
        return 'set';
    }

    return 'append';
}

function getStrategyClarificationQuestionKind(
    field: StrategyClarificationField
): 'strategy_choice' | 'strategy_tradeoff' | 'strategy_scope' {
    if (field === 'decisionPriority') {
        return 'strategy_tradeoff';
    }

    if (field === 'scopeNow') {
        return 'strategy_scope';
    }

    return 'strategy_choice';
}

function buildStrategyClarificationQuestionText(
    field: StrategyClarificationField,
    strategyState: StrategyState
): string {
    switch (field) {
        case 'mustAmplify':
            return '이번 차수에서 디자이너가 가장 먼저 더 강하게 보여줘야 하는 인상은 무엇인가요?';
        case 'mustAvoid':
            return '이번 방향이 어떤 인상으로 읽히면 가장 곤란한가요?';
        case 'decisionPriority':
            return strategyState.contradictions.length > 0
                ? `지금 전략 문장 안에 우선순위 충돌이 보입니다.\n${strategyState.contradictions[0]}\n이번 시안에서 둘 다 다 가져가기 어렵다면 무엇을 먼저 지켜야 하나요?`
                : '이번 시안에서 둘 다 다 가져가기 어렵다면 무엇을 먼저 지켜야 하나요?';
        case 'scopeNow':
            return '이번 리뷰에서 먼저 맞춰야 하는 표면은 어디인가요?';
        case 'reviewCriteria':
            return '리뷰 자리에서 무엇이 먼저 보이면 "됐다"라고 볼 수 있나요?';
        default:
            return buildHandoffStrategyQuestion(field);
    }
}

function buildStrategyOptionDirection(
    field: StrategyClarificationField,
    value: string
): string {
    return createStrategyDirection(
        getStrategyClarificationOperationMode(field) === 'set' ? 'set' : 'append',
        field,
        value
    );
}

function buildStrategyClarificationQuestion(
    field: StrategyClarificationField,
    strategyState: StrategyState,
    userContext?: UserContext
): WorkflowQuestion {
    const suggestedValues = getStrategyClarificationChoices(field, strategyState, userContext);

    return {
        question: buildStrategyClarificationQuestionText(field, strategyState),
        type: 'text_choice',
        options: [
            ...suggestedValues.map((value) => ({
                label: value,
                direction: buildStrategyOptionDirection(field, value),
            })),
            {
                label: STRATEGY_UNCLEAR_CHOICE_LABEL,
                direction: createStrategyDirection('noop', field, 'unclear'),
            },
            {
                label: STRATEGY_DIRECT_INPUT_LABEL,
                direction: createStrategyDirection('fallback', field, 'free_text'),
            },
        ],
        meta: {
            lane: 'strategy_to_design_translation',
            targetField: field,
            questionKind: getStrategyClarificationQuestionKind(field),
            operationMode: getStrategyClarificationOperationMode(field),
            suggestedValues,
            fallbackToFreeText: true,
        },
    };
}

export function buildStrategyFillQuestion(
    field: StrategyFieldKey,
    strategyState?: StrategyState
): WorkflowQuestion {
    const needsGapPrompt = strategyState
        ? strategyState.missingFields.includes(field)
            || (field === 'scopeNow' && !strategyState.schema.scopeNow?.trim())
        : false;
    const question = field === 'decisionPriority' && strategyState?.contradictions.length
        ? `우선순위 충돌을 해소하려면 이번 시안에서 둘 다 다 가져가기 어렵더라도 무엇을 먼저 지키는지 한 문장으로 적어 주세요.\n${strategyState.contradictions[0]}`
        : needsGapPrompt
            ? buildHandoffStrategyQuestion(field)
            : buildStrategyQualityQuestion(field);

    return {
        question,
        options: [],
        type: 'free_text',
        meta: {
            lane: 'strategy_to_design_translation',
            targetField: field,
            questionKind: 'strategy_fill',
            operationMode: field === 'scopeNow' || field === 'decisionPriority' ? 'set' : 'append',
        },
    };
}

function getNextCoreClarificationField(
    strategyState: StrategyState
): StrategyClarificationField | null {
    return STRATEGY_CORE_CLARIFICATION_FIELDS.find((field) => (
        needsCoreStrategyClarification(strategyState, field)
        && getStrategyAskedFieldCount(strategyState, field) < STRATEGY_FIELD_REPEAT_LIMIT
    )) ?? null;
}

function evaluateStrategyReadiness(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema,
    contradictions: string[]
): {
    readinessStatus: ReadinessStatus;
    missingFields: StrategyFieldKey[];
    weakFields: StrategyFieldKey[];
    readinessChecks: StrategyReadinessChecks;
} {
    const weakFields = detectWeakStrategyFields(schema);
    const actionability = evaluateStrategyActionability(schema);

    if (!artifactType) {
        const baseChecks = buildStrategyReadinessChecks(
            [],
            weakFields,
            contradictions,
            actionability.notes
        );
        const readinessChecks: StrategyReadinessChecks = {
            ...baseChecks,
            complete: false,
            completeNotes: ['산출물 유형이 아직 정해지지 않았습니다.'],
        };

        return {
            readinessStatus: 'needs_clarification',
            missingFields: [],
            weakFields,
            readinessChecks,
        };
    }

    const rule = getStrategyRule(artifactType);
    const missingFields = rule.requiredFields.filter((field) => isStrategyFieldMissing(schema, field));
    const readinessChecks = buildStrategyReadinessChecks(
        missingFields,
        weakFields,
        contradictions,
        actionability.notes
    );

    if (
        readinessChecks.complete &&
        readinessChecks.specific &&
        readinessChecks.coherent &&
        readinessChecks.actionable
    ) {
        return {
            readinessStatus: 'ready',
            missingFields,
            weakFields,
            readinessChecks,
        };
    }

    if (!readinessChecks.coherent) {
        return {
            readinessStatus: 'blocked',
            missingFields,
            weakFields,
            readinessChecks,
        };
    }

    if (missingFields.length >= 3) {
        return {
            readinessStatus: 'blocked',
            missingFields,
            weakFields,
            readinessChecks,
        };
    }

    return {
        readinessStatus: 'needs_clarification',
        missingFields,
        weakFields,
        readinessChecks,
    };
}

function buildStrategyState(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema,
    previousState?: StrategyState,
    userContext?: UserContext
): StrategyState {
    const normalizedSchema = normalizeStrategySchema(schema);
    const contradictions = detectStrategyContradictions(normalizedSchema);
    const readiness = evaluateStrategyReadiness(artifactType, normalizedSchema, contradictions);
    const diagnosis = buildStrategyDiagnosis(
        artifactType,
        normalizedSchema,
        readiness.missingFields,
        readiness.weakFields,
        contradictions,
        userContext
    );
    const summary = diagnosis.handoffPremise || buildStrategyStateSummary(artifactType, normalizedSchema);

    return {
        artifactType,
        schema: normalizedSchema,
        readinessStatus: readiness.readinessStatus,
        missingFields: readiness.missingFields,
        weakFields: readiness.weakFields,
        contradictions,
        askedFields: previousState?.askedFields ?? [],
        askedFieldCounts: previousState?.askedFieldCounts ?? {},
        lastAskedField: previousState?.lastAskedField,
        summary,
        branchMapping: previousState?.branchMapping,
        readinessChecks: readiness.readinessChecks,
        diagnosis,
    };
}

export function buildStrategyStateFromSchema(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema,
    userContext?: UserContext
): StrategyState {
    return buildStrategyState(artifactType, schema, undefined, userContext);
}

function buildStrategyArtifactQuestion(): WorkflowQuestion {
    return {
        question: '지금 정리하려는 전략 산출물은 무엇에 가장 가깝나요?',
        type: 'text_choice',
        options: (
            Object.entries(STRATEGY_ARTIFACT_LABELS) as Array<[StrategyArtifactType, string]>
        ).map(([artifactType, label]) => ({
            label,
            direction: artifactType,
        })),
        meta: {
            lane: 'strategy_to_design_translation',
            targetField: 'artifactType',
            questionKind: 'strategy_gap',
        },
    };
}

function buildReadableStrategyArtifactQuestion(): WorkflowQuestion {
    return buildStrategyArtifactQuestion();
}

function buildReadableStrategyContradictionQuestion(
    strategyState: StrategyState,
    userContext?: UserContext
): WorkflowQuestion {
    const question = buildStrategyClarificationQuestion('decisionPriority', strategyState, userContext);
    const questionMeta = question.meta ?? {
        lane: 'strategy_to_design_translation' as const,
        targetField: 'decisionPriority' as const,
        questionKind: 'strategy_tradeoff' as const,
        operationMode: 'set' as const,
        suggestedValues: [],
        fallbackToFreeText: true,
    };

    return {
        ...question,
        meta: {
            ...questionMeta,
            questionKind: 'strategy_contradiction',
        },
    };
}

function formatStrategyBranches(
    branchIds: string[],
    variant: 'recommended' | 'avoided'
): string[] {
    return branchIds
        .map((branchId) => branchData.find((branch) => branch.branchId === branchId))
        .filter((branch): branch is Branch => branch !== undefined)
        .map((branch) => (
            variant === 'recommended'
                ? `${branch.branchLabel}: ${branch.descriptionStrategy || branch.descriptionDesigner}`
                : `${branch.branchLabel}: ${branch.distinctionKey}`
        ));
}

export async function extractStrategySchema(
    feedbackText: string,
    userContext: UserContext
): Promise<StrategyState> {
    const heuristic = heuristicStrategySchema(feedbackText, userContext);
    const systemPrompt = `You extract strategy-to-design inputs into a structured schema.

Rules:
- Read the input as strategy handoff material, not raw client emotion.
- Do not invent missing facts. Leave fields empty when they are not present.
- Prefer concise Korean phrases for values.
- Return JSON only.

Return this JSON exactly:
{
  "artifactType": "positioning" | "brand_platform" | "brand_architecture" | "experience_principles" | "campaign_or_creative_brief_seed" | "identity_refresh_scope" | null,
  "summary": "1-2 sentence Korean summary",
  "schema": {
    "businessChallenge": "string or empty",
    "audienceContext": "string or empty",
    "frameOfReference": "string or empty",
    "pointsOfParity": ["string"],
    "pointsOfDifference": ["string"],
    "valueProposition": "string or empty",
    "reasonsToBelieve": ["string"],
    "brandPromise": "string or empty",
    "personality": ["string"],
    "principles": ["string"],
    "equitiesToProtect": ["string"],
    "mustAmplify": ["string"],
    "mustAvoid": ["string"],
    "decisionPriority": ["string"],
    "tradeOffs": ["string"],
    "mandatories": ["string"],
    "noGo": ["string"],
    "scope": "string or empty",
    "scopeNow": "string or empty",
    "reviewCriteria": ["string"],
    "openRisks": ["string"],
    "openQuestionsForDesign": ["string"]
  }
}`;

    const userMessage = `Strategy input:
${feedbackText}

Context:
${buildFreeformContextPrompt(userContext)}`;

    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<{
                artifactType?: string | null;
                summary?: string;
                schema?: StrategyTranslationSchema;
            }>(rawResponse);

            const artifactType = coerceStrategyArtifactType(parsed.artifactType) ?? heuristic.artifactType;
            const strategyState = buildStrategyState(
                artifactType,
                {
                    ...heuristic.schema,
                    ...(parsed.schema ?? {}),
                },
                undefined,
                userContext
            );

            return {
                ...strategyState,
                summary: normalizeText(parsed.summary, strategyState.summary ?? ''),
            };
        } catch {
            if (attempt < maxRetries) continue;
        }
    }

    return buildStrategyState(heuristic.artifactType, heuristic.schema, undefined, userContext);
}

export function mergeStrategyAnswerIntoState(
    strategyState: StrategyState,
    questionMeta: WorkflowQuestion['meta'] | undefined,
    answerLabel: string,
    selectedDirection: string,
    userContext?: UserContext
): StrategyState {
    const targetField = questionMeta?.targetField;
    const nextAskedFields = targetField
        ? [...new Set([...strategyState.askedFields, targetField])]
        : strategyState.askedFields;
    const nextAskedFieldCounts = targetField
        ? getNextAskedFieldCounts(strategyState, targetField)
        : (strategyState.askedFieldCounts ?? {});
    const parsedDirection = parseStrategyDirectionOperation(selectedDirection);

    if (!targetField) {
        return {
            ...strategyState,
            askedFields: nextAskedFields,
            askedFieldCounts: nextAskedFieldCounts,
        };
    }

    if (targetField === 'artifactType') {
        const artifactType = coerceStrategyArtifactType(selectedDirection || answerLabel) ?? strategyState.artifactType;
        return {
            ...buildStrategyState(artifactType, strategyState.schema, strategyState, userContext),
            askedFields: nextAskedFields,
            askedFieldCounts: nextAskedFieldCounts,
            lastAskedField: targetField,
        };
    }

    const mergedSchema = (() => {
        if (parsedDirection && parsedDirection.field === targetField) {
            if (parsedDirection.operation === 'fallback' || parsedDirection.operation === 'noop') {
                return strategyState.schema;
            }

            if (parsedDirection.operation === 'set') {
                return setStrategyFieldValue(strategyState.schema, targetField, parsedDirection.value);
            }

            return mergeStrategyFieldValue(strategyState.schema, targetField, parsedDirection.value);
        }

        if (questionMeta?.operationMode === 'set') {
            return setStrategyFieldValue(strategyState.schema, targetField, answerLabel);
        }

        return mergeStrategyFieldValue(strategyState.schema, targetField, answerLabel);
    })();

    return {
        ...buildStrategyState(strategyState.artifactType, mergedSchema, strategyState, userContext),
        askedFields: nextAskedFields,
        askedFieldCounts: nextAskedFieldCounts,
        lastAskedField: targetField,
    };
}

export function generateStrategyGapQuestion(
    strategyState: StrategyState,
    userContext?: UserContext
): WorkflowQuestion | null {
    if (!strategyState.artifactType) {
        return buildReadableStrategyArtifactQuestion();
    }

    if (
        strategyState.contradictions.length > 0
        && getStrategyAskedFieldCount(strategyState, 'decisionPriority') < STRATEGY_FIELD_REPEAT_LIMIT
    ) {
        return getStrategyAskedFieldCount(strategyState, 'decisionPriority') === 0
            ? buildReadableStrategyContradictionQuestion(strategyState, userContext)
            : buildStrategyFillQuestion('decisionPriority', strategyState);
    }

    const coreField = getNextCoreClarificationField(strategyState);
    if (coreField) {
        return getStrategyAskedFieldCount(strategyState, coreField) === 0
            ? buildStrategyClarificationQuestion(coreField, strategyState, userContext)
            : buildStrategyFillQuestion(coreField, strategyState);
    }

    const targetField = getNextStrategyTargetField(strategyState);

    if (
        targetField
        && targetField !== 'artifactType'
        && !STRATEGY_CORE_CLARIFICATION_FIELDS.includes(targetField as StrategyClarificationField)
        && getStrategyAskedFieldCount(strategyState, targetField) === 0
    ) {
        return buildStrategyFillQuestion(targetField, strategyState);
    }

    const weakField = getNextStrategyWeakField(strategyState);
    if (
        weakField
        && !STRATEGY_CORE_CLARIFICATION_FIELDS.includes(weakField as StrategyClarificationField)
        && getStrategyAskedFieldCount(strategyState, weakField) === 0
    ) {
        return buildStrategyFillQuestion(weakField, strategyState);
    }

    return null;
}

export function mapStrategySchemaToBranches(
    strategyState: StrategyState,
    userContext?: UserContext
): StrategyBranchMapping {
    const recommendedSnapshot = buildStrategySnapshot(
        strategyState.artifactType,
        {
            ...strategyState.schema,
            mustAvoid: [],
            noGo: [],
        },
        userContext
    );
    const avoidedSnapshot = [
        ...(strategyState.schema.mustAvoid ?? []),
        ...(strategyState.schema.noGo ?? []),
        ...(strategyState.schema.tradeOffs ?? []).filter((item) => /피하|지양|제외|넘어가지/.test(item)),
    ].join(' ');

    return scoreBranchesFromStrategyText(recommendedSnapshot, avoidedSnapshot);
}

export function generateGapMemo(strategyState: StrategyState): StrategyGapMemo {
    return buildDeterministicGapMemo(strategyState);
}

export function generateDesignTranslationBrief(
    strategyState: StrategyState,
    userContext?: UserContext,
    originalFeedback = ''
): StrategyTranslationBrief {
    const branchMapping = strategyState.branchMapping
        ?? mapStrategySchemaToBranches(strategyState, userContext);

    return buildDeterministicStrategyBrief(
        strategyState,
        userContext,
        originalFeedback,
        {
            recommendedDirections: formatStrategyBranches(
                branchMapping.recommendedBranchIds,
                'recommended'
            ),
            avoidedDirections: formatStrategyBranches(
                branchMapping.avoidedBranchIds,
                'avoided'
            ),
            mappingRationale: branchMapping.rationale,
        }
    );
}

export const analyzeClientFeedback = analyzeInitialFeedback;
export const generateClientFollowUp = generateFollowUp;
export const generateClientDetailQuestion = generateDetailQuestion;
export const generateInterpretationBrief = generateBriefSummary;
