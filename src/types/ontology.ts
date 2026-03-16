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

export interface ConvergenceResult {
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
}

export type SessionStep = 'entry' | 'context' | 'questions' | 'confirm' | 'brief';

export interface BriefOutput {
    originalFeedback: string;
    feedbackType: TriggerType;
    userContext: UserContext;
    generatedAt: string;
    clientSummary: string;
    clientAntiSummary: string;
    primaryBranch: Branch;
    secondaryBranch: Branch | null;
    eliminatedBranches: Branch[];
    interpretationRationale: string;
    designTokens: DesignToken;
    neverDoList: string[];
    confusionWarnings: string[];
    references: string[];
    antiReferences: string[];
    decisionTrail: BriefDecisionStep[];
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
    clientSummary: string;
    clientAntiSummary: string;
    designerSummary: string;
    adjustmentNotes: string;
    confusionWarnings: string[];
}

export interface SessionState {
    sessionId: string;
    originalFeedback: string;
    feedbackType?: TriggerType;
    intentInterpretation?: string;
    uncertainAspects?: string[];
    userContext: UserContext;
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
}

export interface LLMAnswerRecord {
    question: string;
    options: LLMQuestionOption[];
    selectedLabel: string;
    selectedDirection: string;
    nextAction?: 'question' | 'conclusion';
    nextQuestion?: string;
    nextOptions?: LLMQuestionOption[];
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

export interface StartSessionRequest {
    feedbackText: string;
    context: UserContext;
}

export interface StartSessionResponse {
    sessionId: string;
    initialAnalysis: LLMInitialAnalysis;
    sessionState: SessionState;
}

export interface RefineFeedbackRequest {
    feedbackText: string;
    context: UserContext;
}

export interface RefineFeedbackResponse {
    refinedText: string;
}

export interface SubmitAnswerRequest {
    selectedLabel: string;
    selectedDirection: string;
    currentQuestion?: string;
    currentOptions?: LLMQuestionOption[];
}

export interface SubmitAnswerResponse {
    sessionState: SessionState;
    nextQuestion?: {
        question: string;
        options: LLMQuestionOption[];
        type?: QuestionType;
    };
    converged: boolean;
    result?: {
        primaryBranch: string;
        secondaryBranch: string | null;
        reasoning: string;
    };
}

export interface RefineSessionResponse {
    sessionState: SessionState;
    nextQuestion?: {
        question: string;
        options: LLMQuestionOption[];
        type?: QuestionType;
    };
    usedFallback: boolean;
}

export interface GenerateBriefRequest {
    sessionState: SessionState;
}

export interface GenerateBriefResponse {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
}
