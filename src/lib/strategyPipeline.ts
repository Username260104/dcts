import type {
    StrategyArtifactType,
    StrategyDiagnosis,
    StrategyFieldKey,
    StrategyGapMemo,
    StrategyState,
    StrategyTranslationBrief,
    StrategyTranslationSchema,
    UserContext,
} from '@/types/ontology';
import {
    getStrategyRule,
    STRATEGY_ARTIFACT_LABELS,
    STRATEGY_FIELD_LABELS,
} from './strategyArtifacts';

type StrategyDirectionCopy = Pick<
    StrategyTranslationBrief,
    'recommendedDirections' | 'avoidedDirections' | 'mappingRationale'
>;

const FIELD_RISK_PRIORITY: StrategyFieldKey[] = [
    'businessChallenge',
    'equitiesToProtect',
    'mustAmplify',
    'mustAvoid',
    'reviewCriteria',
    'decisionPriority',
    'tradeOffs',
    'scopeNow',
    'mandatories',
    'openQuestionsForDesign',
    'audienceContext',
    'frameOfReference',
    'valueProposition',
    'pointsOfDifference',
    'reasonsToBelieve',
    'principles',
    'pointsOfParity',
    'brandPromise',
    'personality',
    'scope',
    'noGo',
    'openRisks',
];

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
    return [...new Set(
        values
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value))
    )];
}

function takeMeaningful(values: string[] | undefined, limit = 2): string[] {
    return (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, limit);
}

function truncate(value: string, maxLength = 160): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function stripTrailingPunctuation(value: string): string {
    return value.trim().replace(/[.!?。．]+$/u, '');
}

function normalizeFragment(value: string): string {
    return stripTrailingPunctuation(value).replace(/\s+/g, ' ').trim();
}

function hasFinalConsonant(text: string): boolean {
    const normalized = normalizeFragment(text);
    const lastChar = [...normalized].reverse().find((char) => /[가-힣A-Za-z0-9]/.test(char));

    if (!lastChar) {
        return false;
    }

    if (/[가-힣]/.test(lastChar)) {
        const code = lastChar.charCodeAt(0) - 0xac00;
        return code % 28 !== 0;
    }

    return /[0-9bcdfghjklmnpqrstvwxyz]/i.test(lastChar);
}

function getParticle(text: string, kind: 'subject' | 'and'): string {
    const hasBatchim = hasFinalConsonant(text);

    if (kind === 'and') {
        return hasBatchim ? '과' : '와';
    }

    return hasBatchim ? '이' : '가';
}

function joinReadableItems(values: string[] | undefined, limit = 2): string {
    const items = takeMeaningful(values, limit).map(normalizeFragment);

    if (items.length === 0) {
        return '';
    }

    if (items.length === 1) {
        return items[0];
    }

    if (items.length === 2) {
        return `${items[0]}${getParticle(items[0], 'and')} ${items[1]}`;
    }

    return `${items.slice(0, -1).join(', ')}, ${items.at(-1)}`;
}

function supplementList(base: string[] | undefined, fallback: string[], minLength = 2): string[] {
    const cleanedBase = uniqueNonEmpty(base ?? []);

    if (cleanedBase.length >= minLength) {
        return cleanedBase;
    }

    return uniqueNonEmpty([...cleanedBase, ...fallback]);
}

function buildAudienceFallback(userContext?: UserContext): string {
    const parts = [
        userContext?.targetAge ? `${userContext.targetAge} 중심 타깃` : '',
        userContext?.industry ? `${userContext.industry} 카테고리` : '',
        userContext?.brandDescription ? truncate(userContext.brandDescription, 80) : '',
    ].filter(Boolean);

    return parts.length > 0
        ? parts.join(' / ')
        : '핵심 타깃과 사용 맥락 보강이 필요합니다.';
}

function buildReviewFallback(schema: StrategyTranslationSchema): string[] {
    const derived = uniqueNonEmpty([
        takeMeaningful(schema.mustAmplify, 1)[0]
            ? `${normalizeFragment(takeMeaningful(schema.mustAmplify, 1)[0])}${getParticle(takeMeaningful(schema.mustAmplify, 1)[0], 'subject')} 첫 인상에서 바로 읽히는가`
            : null,
        takeMeaningful(schema.pointsOfDifference, 1)[0]
            ? `${normalizeFragment(takeMeaningful(schema.pointsOfDifference, 1)[0])} 차별점이 분명히 드러나는가`
            : null,
        takeMeaningful(schema.equitiesToProtect, 1)[0]
            ? `${normalizeFragment(takeMeaningful(schema.equitiesToProtect, 1)[0])} 자산이 지워지지 않았는가`
            : null,
    ]);

    return derived.length > 0
        ? derived
        : ['전략에서 의도한 인식 변화가 실제 시안에서 읽히는가'];
}

function buildPrioritySentence(priorities: string[] | undefined): string | undefined {
    const items = takeMeaningful(priorities, 3);
    if (items.length === 0) {
        return undefined;
    }

    if (items.length === 1) {
        return `충돌 시 ${items[0]}를 우선합니다.`;
    }

    return `충돌 시 ${items.join(' -> ')} 순으로 우선합니다.`;
}

function buildHandoffPremise(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema,
    userContext?: UserContext
): string {
    if (schema.businessChallenge && schema.audienceContext && schema.valueProposition) {
        return `이번 차수의 핵심 과제는 ${stripTrailingPunctuation(schema.businessChallenge)}. 이를 위해 ${stripTrailingPunctuation(schema.audienceContext)} 맥락에서 "${stripTrailingPunctuation(schema.valueProposition)}"라는 가치가 분명히 읽혀야 합니다.`;
    }

    if (schema.businessChallenge && (schema.mustAmplify?.length ?? 0) > 0) {
        return `이번 차수의 핵심 과제는 ${stripTrailingPunctuation(schema.businessChallenge)}. 결과물은 ${takeMeaningful(schema.mustAmplify, 2).join(', ')} 인상을 더 분명히 만들어야 합니다.`;
    }

    if (schema.businessChallenge) {
        return `이번 차수의 핵심 과제는 ${stripTrailingPunctuation(schema.businessChallenge)}.`;
    }

    if (schema.valueProposition) {
        return `이번 handoff의 핵심은 ${stripTrailingPunctuation(schema.valueProposition)}을 디자인 판단 기준으로 번역하는 것입니다.`;
    }

    if (artifactType) {
        return `${STRATEGY_ARTIFACT_LABELS[artifactType]} 기준의 handoff 정리가 더 필요합니다.`;
    }

    return `전략 입력을 ${buildAudienceFallback(userContext)} 기준의 handoff 문장으로 다시 고정해야 합니다.`;
}

function buildCoreTension(schema: StrategyTranslationSchema): string {
    const tradeOff = takeMeaningful(schema.tradeOffs, 1)[0];
    const avoid = takeMeaningful(schema.mustAvoid ?? schema.noGo, 1)[0];

    if (tradeOff) {
        return avoid
            ? `${normalizeFragment(tradeOff)}. 동시에 ${normalizeFragment(avoid)}처럼 읽히면 안 됩니다.`
            : normalizeFragment(tradeOff);
    }

    const amplify = takeMeaningful(schema.mustAmplify, 1)[0];

    if (amplify && avoid) {
        return `${amplify}는 강화하되 ${avoid}처럼 읽히면 안 됩니다.`;
    }

    const priority = takeMeaningful(schema.decisionPriority, 1)[0];
    const review = takeMeaningful(schema.reviewCriteria, 1)[0];

    if (priority && review) {
        return `${priority}를 우선하면서 ${review}로 검증해야 합니다.`;
    }

    if (amplify) {
        return `${amplify}가 더 강해져야 하지만 과잉 연출로 넘어가지는 않아야 합니다.`;
    }

    return '강조할 인상과 회피할 인상 사이의 우선순위를 더 분명히 해야 합니다.';
}

function buildDecisionFrame(schema: StrategyTranslationSchema): string[] {
    const reviewChecks = takeMeaningful(schema.reviewCriteria, 2).map(normalizeFragment);
    const avoids = takeMeaningful(schema.mustAvoid ?? schema.noGo, 2).map(normalizeFragment);

    return uniqueNonEmpty([
        buildPrioritySentence(schema.decisionPriority),
        reviewChecks.length > 0
            ? `리뷰에서는 다음을 먼저 확인합니다: ${reviewChecks.join(' / ')}.`
            : buildReviewFallback(schema)[0],
        schema.scopeNow?.trim()
            ? `이번 차수에서 먼저 맞출 범위는 다음입니다: ${normalizeFragment(schema.scopeNow)}.`
            : schema.scope?.trim()
                ? `현재 판단은 ${normalizeFragment(schema.scope)} 범위를 기준으로 합니다.`
                : '이번 차수 범위를 먼저 고정해야 합니다.',
        avoids.length > 0
            ? `다음처럼 읽히는 안은 제외합니다: ${avoids.join(' / ')}.`
            : null,
    ]);
}

function buildCreativeImplications(schema: StrategyTranslationSchema): string[] {
    const amplify = joinReadableItems(schema.mustAmplify, 2);
    const difference = joinReadableItems(schema.pointsOfDifference, 2);
    const equities = joinReadableItems(schema.equitiesToProtect, 2);
    const mandatories = takeMeaningful(schema.mandatories, 2).map(normalizeFragment);
    const principles = takeMeaningful(schema.principles, 2).map(normalizeFragment);

    return uniqueNonEmpty([
        amplify
            ? `첫 인상과 대표 화면에서 ${amplify}${getParticle(amplify, 'subject')} 즉시 읽혀야 합니다.`
            : null,
        difference
            ? `경쟁 대비 ${difference} 차이가 시각적으로 드러나야 합니다.`
            : null,
        equities
            ? `기존 ${equities} 자산은 지워지지 않아야 합니다.`
            : null,
        mandatories.length > 0
            ? `실행 단계에서는 다음 요소를 빠뜨리면 안 됩니다: ${mandatories.join(' / ')}.`
            : null,
        principles.length > 0
            ? `디자인 판단은 다음 원칙을 따라야 합니다: ${principles.join(' / ')}.`
            : null,
    ]);
}

function detectSurfaceTargets(schema: StrategyTranslationSchema, userContext?: UserContext): string[] {
    const source = [
        schema.scope,
        schema.scopeNow,
        ...(schema.mandatories ?? []),
        ...(schema.openQuestionsForDesign ?? []),
        userContext?.additionalContext,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const targets: string[] = [];

    if (/(패키지|package|packaging)/.test(source)) targets.push('packaging');
    if (/(상세|detail|상세페이지|pdp)/.test(source)) targets.push('detail');
    if (/(웹|web|홈페이지|landing|랜딩|사이트)/.test(source)) targets.push('web');
    if (/(로고|아이덴티티|identity|symbol)/.test(source)) targets.push('identity');
    if (/(캠페인|campaign|콘텐츠|content|광고)/.test(source)) targets.push('campaign');

    return targets;
}

function buildSurfaceImplications(
    schema: StrategyTranslationSchema,
    userContext?: UserContext
): string[] {
    const targets = detectSurfaceTargets(schema, userContext);
    const amplify = joinReadableItems(schema.mustAmplify, 2);
    const reasons = joinReadableItems(schema.reasonsToBelieve, 2);
    const equities = joinReadableItems(schema.equitiesToProtect, 2);
    const value = schema.valueProposition?.trim() ? normalizeFragment(schema.valueProposition) : '';
    const implications: string[] = [];

    if (targets.includes('packaging')) {
        implications.push(
            `패키지 전면에서는 ${amplify || value || '핵심 인상'}이 한눈에 읽혀야 합니다.`
        );
    }

    if (targets.includes('detail')) {
        implications.push(
            `상세페이지에서는 ${reasons || value || '핵심 설득 근거'}가 정보 구조 안에서 자연스럽게 강화돼야 합니다.`
        );
    }

    if (targets.includes('web')) {
        implications.push(
            `첫 화면과 주요 랜딩 구간에서는 ${amplify || '핵심 인상'}이 먼저 읽히고, 이후에 ${reasons || '설득 근거'}가 따라와야 합니다.`
        );
    }

    if (targets.includes('identity')) {
        implications.push(
            `아이덴티티 요소는 ${equities || '기존 자산'}을 유지하면서도 ${amplify || '새 인상'}이 더 분명히 느껴지도록 조정해야 합니다.`
        );
    }

    if (targets.includes('campaign')) {
        implications.push(
            `캠페인 메시지와 비주얼은 ${value || '핵심 가치 제안'}을 중심으로 한 방향으로 묶여야 합니다.`
        );
    }

    return implications.length > 0
        ? implications
        : uniqueNonEmpty([
            `첫 화면과 대표 시각물에서 ${amplify || '핵심 인상'}이 먼저 읽혀야 합니다.`,
            `정보 구조와 설명 요소에서는 ${reasons || value || '핵심 설득 포인트'}가 분명히 보강돼야 합니다.`,
            equities ? `확장 적용 시에도 ${equities} 자산은 유지돼야 합니다.` : null,
        ]);
}

function buildWorkingAssumptions(
    schema: StrategyTranslationSchema,
    userContext?: UserContext
): string[] {
    return uniqueNonEmpty([
        !schema.audienceContext && userContext?.targetAge
            ? `핵심 타깃은 ${userContext.targetAge} 중심으로 가정합니다.`
            : null,
        !schema.frameOfReference && userContext?.industry
            ? `비교 프레임은 ${userContext.industry} 카테고리 경쟁 구도로 가정합니다.`
            : null,
        !schema.scopeNow && schema.scope
            ? '이번 차수 범위는 전체 범위 중 현재 언급된 영역을 우선 검토하는 것으로 가정합니다.'
            : null,
        !(schema.reviewCriteria?.length)
            ? '성공 기준은 인식 변화와 차별화 읽힘 여부 중심으로 가정합니다.'
            : null,
    ]);
}

export function rankStrategyFieldsByRisk(
    fields: StrategyFieldKey[],
    artifactType?: StrategyArtifactType
): StrategyFieldKey[] {
    const rule = getStrategyRule(artifactType);
    const preferredOrder = new Map(
        rule.preferredQuestionOrder
            .filter((field): field is StrategyFieldKey => field !== 'artifactType')
            .map((field, index) => [field, index])
    );

    return [...new Set(fields)].sort((left, right) => {
        const leftRisk = FIELD_RISK_PRIORITY.indexOf(left);
        const rightRisk = FIELD_RISK_PRIORITY.indexOf(right);
        const normalizedLeftRisk = leftRisk === -1 ? Number.MAX_SAFE_INTEGER : leftRisk;
        const normalizedRightRisk = rightRisk === -1 ? Number.MAX_SAFE_INTEGER : rightRisk;

        if (normalizedLeftRisk !== normalizedRightRisk) {
            return normalizedLeftRisk - normalizedRightRisk;
        }

        return (preferredOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (preferredOrder.get(right) ?? Number.MAX_SAFE_INTEGER);
    });
}

export function buildStrategyDiagnosis(
    artifactType: StrategyArtifactType | undefined,
    schema: StrategyTranslationSchema,
    missingFields: StrategyFieldKey[],
    weakFields: StrategyFieldKey[],
    contradictions: string[],
    userContext?: UserContext
): StrategyDiagnosis {
    const prioritizedGaps = uniqueNonEmpty([
        ...contradictions.map((item) => `충돌 정리 필요: ${item}`),
        ...rankStrategyFieldsByRisk(missingFields, artifactType).map(
            (field) => `${STRATEGY_FIELD_LABELS[field]} 누락`
        ),
        ...rankStrategyFieldsByRisk(
            weakFields.filter((field) => !missingFields.includes(field)),
            artifactType
        ).map((field) => `${STRATEGY_FIELD_LABELS[field]} 구체화 필요`),
    ]);

    return {
        handoffPremise: buildHandoffPremise(artifactType, schema, userContext),
        coreTension: buildCoreTension(schema),
        decisionFrame: buildDecisionFrame(schema),
        prioritizedGaps,
        creativeImplications: buildCreativeImplications(schema),
        surfaceImplications: buildSurfaceImplications(schema, userContext),
        workingAssumptions: buildWorkingAssumptions(schema, userContext),
    };
}

export function buildStrategyConfirmedInputs(
    strategyState: StrategyState,
    userContext: UserContext | undefined,
    originalFeedback: string
): string[] {
    return uniqueNonEmpty([
        originalFeedback.trim() ? `원문 입력: ${truncate(originalFeedback)}` : null,
        strategyState.artifactType
            ? `산출물 유형: ${STRATEGY_ARTIFACT_LABELS[strategyState.artifactType]}`
            : null,
        strategyState.schema.businessChallenge
            ? `명시된 과제: ${strategyState.schema.businessChallenge}`
            : null,
        strategyState.schema.valueProposition
            ? `명시된 가치 제안: ${strategyState.schema.valueProposition}`
            : null,
        userContext?.brandDescription
            ? `브랜드 설명: ${truncate(userContext.brandDescription, 120)}`
            : null,
        userContext?.positioningNote
            ? `포지셔닝 메모: ${truncate(userContext.positioningNote, 120)}`
            : null,
        userContext?.additionalContext
            ? `추가 맥락: ${truncate(userContext.additionalContext, 120)}`
            : null,
    ]);
}

function buildDesignerChecklist(
    strategyState: StrategyState,
    workingAssumptions: string[]
): string[] {
    const schema = strategyState.schema;
    const amplify = joinReadableItems(schema.mustAmplify, 2);
    const avoids = joinReadableItems(schema.mustAvoid, 2);
    const equities = joinReadableItems(schema.equitiesToProtect, 2);
    const reviewCriteria = takeMeaningful(schema.reviewCriteria, 2).map(normalizeFragment);
    const checklist = uniqueNonEmpty([
        amplify
            ? `${amplify}${getParticle(amplify, 'subject')} 첫 인상에서 읽히는가`
            : null,
        avoids
            ? `${avoids}처럼 오해되지 않는가`
            : null,
        equities
            ? `${equities} 자산이 유지되는가`
            : null,
        reviewCriteria.length > 0
            ? `${reviewCriteria.join(' / ')} 기준을 통과하는가`
            : null,
        (schema.scopeNow ?? schema.scope)?.trim()
            ? `이번 차수 범위(${normalizeFragment(schema.scopeNow ?? schema.scope ?? '')})를 넘는 변경이 섞이지 않았는가`
            : null,
        workingAssumptions.length > 0
            ? `아직 가정으로 남아 있는 항목(${workingAssumptions[0]})을 사실처럼 확정하지 않았는가`
            : null,
    ]);

    return checklist.length > 0
        ? checklist
        : ['전략에서 의도한 인식 변화가 실제 시안에서 읽히는지 점검합니다.'];
}

function mergeList(base: string[], fallback: string[]): string[] {
    const merged = uniqueNonEmpty([...base, ...fallback]);
    return merged;
}

export function buildDeterministicStrategyBrief(
    strategyState: StrategyState,
    userContext: UserContext | undefined,
    originalFeedback: string,
    directionCopy: StrategyDirectionCopy
): StrategyTranslationBrief {
    const diagnosis = strategyState.diagnosis;
    const schema = strategyState.schema;
    const workingAssumptions = diagnosis.workingAssumptions;
    const confirmedInputs = buildStrategyConfirmedInputs(strategyState, userContext, originalFeedback);
    const reviewCriteria = supplementList(schema.reviewCriteria, buildReviewFallback(schema), 2);
    const openQuestions = mergeList(
        schema.openQuestionsForDesign ?? [],
        workingAssumptions[0]
            ? [`다음 가정을 확정할 필요가 있습니다: ${workingAssumptions[0]}`]
            : []
    );

    return repairStrategyTranslationBrief({
        strategicPremise: diagnosis.handoffPremise,
        confirmedInputs,
        workingAssumptions,
        coreTension: diagnosis.coreTension,
        audienceAndContext: schema.audienceContext ?? buildAudienceFallback(userContext),
        frameOfReference: schema.frameOfReference ?? (
            userContext?.industry
                ? `${userContext.industry} 카테고리 경쟁 프레임`
                : '같은 시장 안에서 비교되는 프레임 정의가 더 필요합니다.'
        ),
        pointsOfParity: schema.pointsOfParity ?? [],
        pointsOfDifference: schema.pointsOfDifference ?? [],
        valueProposition: schema.valueProposition ?? '핵심 가치 제안 보강이 필요합니다.',
        reasonsToBelieve: schema.reasonsToBelieve ?? [],
        equitiesToProtect: schema.equitiesToProtect ?? [],
        mustAmplify: schema.mustAmplify ?? [],
        mustAvoid: schema.mustAvoid ?? [],
        decisionPriority: schema.decisionPriority ?? [],
        tradeOffs: schema.tradeOffs ?? [],
        principlesForDesign: schema.principles ?? [],
        mandatories: schema.mandatories ?? [],
        noGo: schema.noGo ?? [],
        scope: schema.scope ?? '전체 변경 범위 보강이 필요합니다.',
        scopeNow: schema.scopeNow ?? schema.scope ?? '이번 차수 범위 정의가 필요합니다.',
        decisionFrame: diagnosis.decisionFrame,
        creativeImplications: diagnosis.creativeImplications,
        surfaceImplications: diagnosis.surfaceImplications,
        reviewCriteria,
        openRisks: mergeList(schema.openRisks ?? [], strategyState.contradictions),
        openQuestionsForDesign: openQuestions,
        recommendedDirections: directionCopy.recommendedDirections,
        avoidedDirections: directionCopy.avoidedDirections,
        designerChecklist: buildDesignerChecklist(strategyState, workingAssumptions),
        mappingRationale: directionCopy.mappingRationale,
    }, strategyState);
}

export function repairStrategyTranslationBrief(
    brief: StrategyTranslationBrief,
    strategyState: StrategyState
): StrategyTranslationBrief {
    const reviewFallback = buildReviewFallback(strategyState.schema);
    const creativeFallback = buildCreativeImplications(strategyState.schema);
    const surfaceFallback = buildSurfaceImplications(strategyState.schema);
    const mustAvoidFallback = strategyState.schema.mustAvoid ?? [];
    const noGoFallback = strategyState.schema.noGo ?? [];
    const workingAssumptions = mergeList(
        brief.workingAssumptions,
        strategyState.diagnosis.workingAssumptions
    );

    const repairedReviewCriteria = supplementList(brief.reviewCriteria, reviewFallback, 2);
    const repairedCreativeImplications = mergeList(
        brief.creativeImplications,
        creativeFallback
    );
    const repairedSurfaceImplications = mergeList(
        brief.surfaceImplications,
        surfaceFallback
    );
    const repairedDecisionFrame = mergeList(
        brief.decisionFrame,
        strategyState.diagnosis.decisionFrame
    );

    const repairedChecklist = mergeList(
        brief.designerChecklist,
        buildDesignerChecklist(strategyState, workingAssumptions)
    );

    return {
        ...brief,
        confirmedInputs: mergeList(
            brief.confirmedInputs,
            buildStrategyConfirmedInputs(strategyState, undefined, '')
        ),
        workingAssumptions,
        coreTension: brief.coreTension.trim() || strategyState.diagnosis.coreTension,
        mustAvoid: mergeList(brief.mustAvoid, mustAvoidFallback),
        noGo: mergeList(brief.noGo, noGoFallback),
        decisionFrame: repairedDecisionFrame,
        creativeImplications: repairedCreativeImplications,
        surfaceImplications: repairedSurfaceImplications,
        reviewCriteria: repairedReviewCriteria,
        openRisks: mergeList(
            brief.openRisks,
            workingAssumptions[0] ? [`가정에 기반한 판단이 남아 있습니다: ${workingAssumptions[0]}`] : []
        ),
        openQuestionsForDesign: mergeList(
            brief.openQuestionsForDesign,
            workingAssumptions[0]
                ? [`아래 가정을 확정할 필요가 있습니다: ${workingAssumptions[0]}`]
                : []
        ),
        designerChecklist: repairedChecklist,
    };
}

export function buildDeterministicGapMemo(strategyState: StrategyState): StrategyGapMemo {
    const currentUnderstanding = uniqueNonEmpty([
        strategyState.diagnosis.handoffPremise,
        strategyState.schema.businessChallenge
            ? `핵심 과제: ${strategyState.schema.businessChallenge}`
            : null,
        takeMeaningful(strategyState.schema.pointsOfDifference, 2).length > 0
            ? `차별화 축: ${takeMeaningful(strategyState.schema.pointsOfDifference, 2).join(', ')}`
            : null,
        takeMeaningful(strategyState.schema.equitiesToProtect, 2).length > 0
            ? `보존 자산: ${takeMeaningful(strategyState.schema.equitiesToProtect, 2).join(', ')}`
            : null,
        strategyState.diagnosis.coreTension
            ? `핵심 긴장: ${strategyState.diagnosis.coreTension}`
            : null,
    ]);

    const nextQuestions = uniqueNonEmpty([
        ...strategyState.diagnosis.prioritizedGaps.slice(0, 3).map((gap) => `${gap}에 대해 더 구체적으로 확인해 주세요.`),
        ...strategyState.diagnosis.workingAssumptions.slice(0, 2).map((assumption) => `${assumption} 이 가정을 사실로 확정해도 되는지 확인해 주세요.`),
    ]);

    return {
        currentUnderstanding,
        missingCriteria: rankStrategyFieldsByRisk(
            strategyState.missingFields,
            strategyState.artifactType
        ).map((field) => STRATEGY_FIELD_LABELS[field]),
        weakCriteria: rankStrategyFieldsByRisk(
            strategyState.weakFields,
            strategyState.artifactType
        ).map((field) => STRATEGY_FIELD_LABELS[field]),
        priorityGaps: strategyState.diagnosis.prioritizedGaps,
        contradictions: strategyState.contradictions,
        blockingReason: strategyState.contradictions.length > 0
            ? '상충하는 요구가 남아 있어 디자인 판단 기준을 고정하기 어렵습니다.'
            : '핵심 handoff 기준은 잡혔지만, 아직 디자이너가 바로 움직일 정도로 충분히 정리되지는 않았습니다.',
        nextQuestions,
    };
}
