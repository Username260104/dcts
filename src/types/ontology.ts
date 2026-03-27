export type InputRole = 'client' | 'strategist';
export type JobType = 'client_feedback_interpretation' | 'strategy_to_design_translation';
export type StrategyArtifactType =
    | 'positioning'
    | 'brand_platform'
    | 'brand_architecture'
    | 'experience_principles'
    | 'campaign_or_creative_brief_seed'
    | 'identity_refresh_scope';
export type ReadinessStatus = 'ready' | 'needs_clarification' | 'blocked';
export type BriefKind = 'interpretation_brief' | 'translation_brief' | 'gap_memo';
export type DebugSourceKind = 'language_model' | 'fallback' | 'deterministic' | 'hybrid';
export type StrategyQuestionKind =
    | 'strategy_gap'
    | 'strategy_contradiction'
    | 'strategy_quality'
    | 'strategy_choice'
    | 'strategy_tradeoff'
    | 'strategy_scope'
    | 'strategy_fill';
export type WorkflowQuestionKind = 'interpretation' | 'detail' | StrategyQuestionKind;
export type StrategyQuestionOperationMode = 'set' | 'append' | 'clarify';

export type TriggerType = 'directional' | 'negative' | 'ambiguous';

export interface Trigger {
    id: number;
    expression: string;
    type: TriggerType;
    axis: string;
    candidateBranches: string[];
    coExpressions: string[];
    riskLevel: number;
    entryQuestion: string;
}

export interface Branch {
    adjective: string;
    branchId: string;
    branchLabel: string;
    descriptionDesigner: string;
    descriptionClient: string;
    confusableBranches: string[];
    distinctionKey: string;
    contrastQuestion: string;
    antiSignals: string[];
    excludedTokens: string[];
    references: string[];
    descriptionStrategy: string;
    positioningContext: string;
    competitiveImplication: string;
}

export interface DesignToken {
    branchId: string;
    branchLabel: string;
    colorDirection: string;
    typographyDirection: string;
    layoutDirection: string;
    imageDirection: string;
    textureDirection: string;
    neverDo: string;
}

export type QuestionBreadth = 'wide' | 'narrow' | 'micro';

export interface ContextOption {
    label: string;
    boost: string[];
    suppress: string[];
    effect: string;
    questionBreadth?: QuestionBreadth;
    warnDirectionChange?: boolean;
}

export interface ContextVariables {
    industry: Record<string, ContextOption>;
    pricePosition: Record<string, ContextOption>;
    projectStage: Record<string, ContextOption>;
    targetAge: Record<string, ContextOption>;
}

export interface BriefTemplateItem {
    section: string;
    item: string;
    example: string;
    guide: string;
}

export type QuestionType = 'text_choice' | 'image_ab' | 'negative_confirm' | 'free_text';

export interface QuestionOption {
    label: string;
    branchIds: string[];
    eliminateBranchIds: string[];
}

export interface Question {
    type: QuestionType;
    text: string;
    options: QuestionOption[];
    sourcebranchIds: string[];
}

export interface AnswerRecord {
    questionText: string;
    answerLabel: string;
    eliminatedBranches: string[];
    remainingBranches: string[];
}

export interface QuestionEngineState {
    remainingCandidates: string[];
    eliminated: string[];
    answerHistory: AnswerRecord[];
    confidence: number;
    questionCount: number;
    neitherCount: number;
}

export interface StaticConvergenceResult {
    primaryBranch: string;
    secondaryBranch: string | null;
    eliminatedBranches: string[];
    answerLog: AnswerRecord[];
}

export interface UserContext {
    industry: string;
    pricePosition: string;
    projectStage: string;
    targetAge?: string;
    brandDescription?: string;
    positioningNote?: string;
    additionalContext?: string;
}

export interface ImportedFileMeta {
    fileName: string;
    fileType: string;
    characterCount: number;
    originalCharacterCount: number;
    truncated: boolean;
}

export interface StrategyTranslationSchema {
    businessChallenge?: string;
    audienceContext?: string;
    frameOfReference?: string;
    pointsOfParity?: string[];
    pointsOfDifference?: string[];
    valueProposition?: string;
    reasonsToBelieve?: string[];
    brandPromise?: string;
    personality?: string[];
    principles?: string[];
    equitiesToProtect?: string[];
    mustAmplify?: string[];
    mustAvoid?: string[];
    decisionPriority?: string[];
    tradeOffs?: string[];
    mandatories?: string[];
    noGo?: string[];
    scope?: string;
    scopeNow?: string;
    reviewCriteria?: string[];
    openRisks?: string[];
    openQuestionsForDesign?: string[];
}

export type StrategyFieldKey = keyof StrategyTranslationSchema;

export interface StrategyReadinessChecks {
    complete: boolean;
    specific: boolean;
    coherent: boolean;
    actionable: boolean;
    completeNotes: string[];
    specificNotes: string[];
    coherentNotes: string[];
    actionableNotes: string[];
}

export interface StrategyDiagnosis {
    handoffPremise: string;
    coreTension: string;
    decisionFrame: string[];
    prioritizedGaps: string[];
    creativeImplications: string[];
    surfaceImplications: string[];
    workingAssumptions: string[];
}

export interface StrategyBranchMapping {
    recommendedBranchIds: string[];
    avoidedBranchIds: string[];
    rationale: string;
    confidence: number;
}

export interface StrategyState {
    artifactType?: StrategyArtifactType;
    schema: StrategyTranslationSchema;
    readinessStatus: ReadinessStatus;
    missingFields: StrategyFieldKey[];
    weakFields: StrategyFieldKey[];
    contradictions: string[];
    askedFields: Array<StrategyFieldKey | 'artifactType'>;
    askedFieldCounts?: Partial<Record<StrategyFieldKey | 'artifactType', number>>;
    lastAskedField?: StrategyFieldKey | 'artifactType';
    summary?: string;
    branchMapping?: StrategyBranchMapping;
    readinessChecks: StrategyReadinessChecks;
    diagnosis: StrategyDiagnosis;
}

export interface WorkflowQuestionMeta {
    lane: JobType;
    targetField?: StrategyFieldKey | 'artifactType';
    questionKind?: WorkflowQuestionKind;
    operationMode?: StrategyQuestionOperationMode;
    suggestedValues?: string[];
    fallbackToFreeText?: boolean;
}

export interface WorkflowQuestion {
    question: string;
    options: LLMQuestionOption[];
    type?: QuestionType;
    meta?: WorkflowQuestionMeta;
}

export interface ClientConvergenceResult {
    kind: 'client_interpretation';
    primaryBranch: string;
    secondaryBranch: string | null;
    reasoning: string;
}

export interface StrategyReadyResult {
    kind: 'strategy_ready';
    summary: string;
    strategyState: StrategyState;
}

export interface StrategyGapResult {
    kind: 'strategy_gap';
    summary: string;
    strategyState: StrategyState;
}

export type WorkflowConvergenceResult =
    | ClientConvergenceResult
    | StrategyReadyResult
    | StrategyGapResult;

export interface StrategyTranslationBrief {
    strategicPremise: string;
    confirmedInputs: string[];
    workingAssumptions: string[];
    coreTension: string;
    audienceAndContext: string;
    frameOfReference: string;
    pointsOfParity: string[];
    pointsOfDifference: string[];
    valueProposition: string;
    reasonsToBelieve: string[];
    equitiesToProtect: string[];
    mustAmplify: string[];
    mustAvoid: string[];
    decisionPriority: string[];
    tradeOffs: string[];
    principlesForDesign: string[];
    mandatories: string[];
    noGo: string[];
    scope: string;
    scopeNow: string;
    decisionFrame: string[];
    creativeImplications: string[];
    surfaceImplications: string[];
    reviewCriteria: string[];
    openRisks: string[];
    openQuestionsForDesign: string[];
    recommendedDirections: string[];
    avoidedDirections: string[];
    designerChecklist: string[];
    mappingRationale?: string;
}

export interface StrategyGapMemo {
    currentUnderstanding: string[];
    missingCriteria: string[];
    weakCriteria: string[];
    priorityGaps: string[];
    contradictions: string[];
    blockingReason: string;
    nextQuestions: string[];
}

export type SessionStep = 'role' | 'entry' | 'context' | 'questions' | 'confirm' | 'brief';

export interface BriefOutput {
    briefKind: BriefKind;
    jobType: JobType;
    originalFeedback: string;
    userContext: UserContext;
    generatedAt: string;
    inputRole: InputRole;
    feedbackType?: TriggerType;
    clientSummary?: string;
    clientAntiSummary?: string;
    primaryBranch?: Branch | null;
    secondaryBranch?: Branch | null;
    eliminatedBranches?: Branch[];
    interpretationRationale?: string;
    designTokens?: DesignToken | null;
    neverDoList?: string[];
    confusionWarnings?: string[];
    references?: string[];
    antiReferences?: string[];
    decisionTrail?: BriefDecisionStep[];
    strategySummary?: string;
    strategyPositioningContext?: string;
    strategyPersuasionGuide?: string;
    strategyTranslation?: StrategyTranslationBrief;
    gapMemo?: StrategyGapMemo;
}

export interface LLMQuestionOption {
    label: string;
    direction: string;
}

export interface LLMInitialAnalysis {
    feedbackType: TriggerType;
    axis: string;
    intentInterpretation: string;
    uncertainAspects: string[];
    candidates: string[];
    eliminated: string[];
    question: string;
    options: LLMQuestionOption[];
}

export interface LLMFollowUpResponse {
    eliminatedNow: string[];
    eliminationReason: string;
    candidates: string[];
    converged: boolean;
    intentInterpretation?: string;
    uncertainAspects?: string[];
    question?: string;
    options?: LLMQuestionOption[];
    type?: QuestionType;
    detailFocus?: string;
    primaryBranch?: string;
    secondaryBranch?: string | null;
    reasoning?: string;
}

export interface LLMBriefResponse {
    clientSummary?: string;
    clientAntiSummary?: string;
    designerSummary?: string;
    adjustmentNotes?: string;
    confusionWarnings?: string[];
    strategySummary?: string;
    strategyPositioningContext?: string;
    strategyPersuasionGuide?: string;
}

export interface SessionState {
    sessionId: string;
    jobType: JobType;
    originalFeedback: string;
    feedbackType?: TriggerType;
    intentInterpretation?: string;
    uncertainAspects?: string[];
    userContext: UserContext;
    strategyArtifactType?: StrategyArtifactType;
    strategyState?: StrategyState;
    candidates: string[];
    eliminated: string[];
    answerHistory: LLMAnswerRecord[];
    questionCount: number;
    converged: boolean;
    primaryBranch?: string;
    secondaryBranch?: string | null;
    reasoning?: string;
    detailQuestionCount?: number;
    detailFocusHistory?: string[];
    pendingRefinement?: boolean;
    inputRole: InputRole;
}

export interface LLMAnswerRecord {
    question: string;
    options: LLMQuestionOption[];
    questionMeta?: WorkflowQuestionMeta;
    selectedLabel: string;
    selectedDirection: string;
    nextAction?: 'question' | 'conclusion';
    nextQuestion?: string;
    nextOptions?: LLMQuestionOption[];
    nextQuestionMeta?: WorkflowQuestionMeta;
    nextReason?: string;
}

export interface BriefDecisionStep {
    question: string;
    selectedOption: string;
    availableOptions: string[];
    nextAction: 'question' | 'conclusion';
    nextPrompt?: string;
    nextOptions?: string[];
    nextReason: string;
}

export interface WorkflowDebugState {
    questionSource?: DebugSourceKind;
    resultSource?: DebugSourceKind;
    briefSource?: DebugSourceKind;
}

export interface StartSessionRequest {
    feedbackText: string;
    context: UserContext;
    inputRole: InputRole;
    jobType?: JobType;
}

export interface StartSessionResponse {
    sessionId: string;
    sessionState: SessionState;
    initialAnalysis?: LLMInitialAnalysis;
    nextQuestion?: WorkflowQuestion;
    converged: boolean;
    result?: WorkflowConvergenceResult;
    debugState?: WorkflowDebugState;
    usedFallback?: boolean;
}

export interface RefineFeedbackRequest {
    feedbackText: string;
    context: UserContext;
}

export interface RefineFeedbackResponse {
    refinedText: string;
}

export interface ExtractFileResponse extends ImportedFileMeta {
    text: string;
}

export interface SubmitAnswerRequest {
    selectedLabel: string;
    selectedDirection: string;
    currentQuestion?: string;
    currentOptions?: LLMQuestionOption[];
    currentQuestionMeta?: WorkflowQuestionMeta;
}

export interface SubmitAnswerResponse {
    sessionState: SessionState;
    nextQuestion?: WorkflowQuestion;
    converged: boolean;
    result?: WorkflowConvergenceResult;
    debugState?: WorkflowDebugState;
    usedFallback?: boolean;
}

export interface RefineSessionResponse {
    sessionState: SessionState;
    nextQuestion?: WorkflowQuestion;
    converged?: boolean;
    result?: WorkflowConvergenceResult;
    debugState?: WorkflowDebugState;
    usedFallback: boolean;
}

export interface GenerateBriefRequest {
    sessionState: SessionState;
}

export interface GenerateBriefResponse {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
    debugState?: WorkflowDebugState;
}
