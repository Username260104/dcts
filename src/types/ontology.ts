// 피드백 표현 유형
export type TriggerType = 'directional' | 'negative' | 'ambiguous';

// 시트 1: 피드백 트리거
export interface Trigger {
    id: number;
    expression: string;          // 클라이언트 원문 표현
    type: TriggerType;           // 방향형 / 부정형 / 모호형
    axis: string;                // 내포된 감성 축
    candidateBranches: string[]; // 연결 분기 후보군 (분기 ID 배열)
    coExpressions: string[];     // 자주 동반되는 표현
    riskLevel: number;           // 해석 위험도 (1~5)
    entryQuestion: string;       // 시스템 진입 질문 (클라이언트용)
}

// 시트 2: 해석 분기 + 안티 패턴
export interface Branch {
    adjective: string;           // 감성 형용사
    branchId: string;            // 분기 ID (예: LUX-A)
    branchLabel: string;         // 분기 라벨 (예: 올드머니 클래식)
    descriptionDesigner: string; // 디자이너용 설명
    descriptionClient: string;   // 클라이언트용 설명 (비전문가 언어)
    confusableBranches: string[];// 혼동 분기 ID 배열
    distinctionKey: string;      // 핵심 구분 축
    contrastQuestion: string;    // 대비 질문 (클라이언트용)
    antiSignals: string[];       // 안티 신호 (이 말이 나오면 이 분기 아님)
    excludedTokens: string[];    // 배제 토큰
    references: string[];        // 대표 레퍼런스 브랜드
}

// 시트 3: 디자인 토큰 (조정 방향)
export interface DesignToken {
    branchId: string;
    branchLabel: string;
    colorDirection: string;      // 컬러 조정 방향
    typographyDirection: string; // 서체 조정 방향
    layoutDirection: string;     // 레이아웃 조정 방향
    imageDirection: string;      // 이미지/사진 조정 방향
    textureDirection: string;    // 질감/텍스처 조정 방향
    neverDo: string;             // 절대 하지 말 것
}

// 시트 4: 맥락 변수 — 개별 옵션
export type QuestionBreadth = 'wide' | 'narrow' | 'micro';

export interface ContextOption {
    label: string;               // 선택지 라벨
    boost: string[];             // 가중치 올릴 분기 ID 배열
    suppress: string[];          // 가중치 낮출 분기 ID 배열
    effect: string;              // 시스템 영향 원문
    questionBreadth?: QuestionBreadth; // projectStage 전용
    warnDirectionChange?: boolean;     // 3차 이상 수정 경고
}

// 시트 4: 맥락 변수 전체 구조
export interface ContextVariables {
    industry: Record<string, ContextOption>;
    pricePosition: Record<string, ContextOption>;
    projectStage: Record<string, ContextOption>;
    targetAge: Record<string, ContextOption>;
}

// 시트 5: 브리프 템플릿 항목
export interface BriefTemplateItem {
    section: string;
    item: string;
    example: string;
    guide: string;
}

// --- 질문 엔진 관련 타입 ---

// 질문 유형
export type QuestionType = 'text_choice' | 'image_ab' | 'negative_confirm' | 'free_text';

// 질문 선택지
export interface QuestionOption {
    label: string;               // 선택지 텍스트
    branchIds: string[];         // 이 선택 시 유지할 분기 ID
    eliminateBranchIds: string[];// 이 선택 시 배제할 분기 ID
}

// 질문
export interface Question {
    type: QuestionType;
    text: string;                // 질문 텍스트
    options: QuestionOption[];
    sourcebranchIds: string[];   // 이 질문이 비교하는 분기 쌍
}

// 질문-응답 이력
export interface AnswerRecord {
    questionText: string;
    answerLabel: string;
    eliminatedBranches: string[];
    remainingBranches: string[];
}

// 질문 엔진 상태
export interface QuestionEngineState {
    remainingCandidates: string[];
    eliminated: string[];
    answerHistory: AnswerRecord[];
    confidence: number;          // 0~1
    questionCount: number;
    neitherCount: number;        // 연속 "둘 다 아닌데요" 횟수
}

// 질문 엔진 수렴 결과
export interface ConvergenceResult {
    primaryBranch: string;       // 최종 1순위 분기 ID
    secondaryBranch: string | null; // 2순위 참조 분기 ID
    eliminatedBranches: string[];
    answerLog: AnswerRecord[];
}

// --- 세션 관련 타입 ---

// 사용자가 선택한 맥락 정보
export interface UserContext {
    industry: string;
    pricePosition: string;
    projectStage: string;
    targetAge?: string;
}

// 세션 단계
export type SessionStep = 'entry' | 'context' | 'questions' | 'confirm' | 'brief';

// --- 브리프 출력 타입 ---

export interface BriefOutput {
    // A. 원문 피드백
    originalFeedback: string;
    feedbackType: TriggerType;
    userContext: UserContext;
    generatedAt: string;

    // B. 해석 요약 (클라이언트 확인용)
    clientSummary: string;
    clientAntiSummary: string;

    // C. 해석 요약 (디자이너용)
    primaryBranch: Branch;
    secondaryBranch: Branch | null;
    eliminatedBranches: Branch[];
    interpretationRationale: string;

    // D. 핵심 조정 포인트
    designTokens: DesignToken;

    // E. 절대 하지 말 것
    neverDoList: string[];
    confusionWarnings: string[];

    // F. 레퍼런스
    references: string[];
    antiReferences: string[];
}

// --- Phase 2: LLM Orchestrator 관련 타입 ---

// LLM 질문 선택지 (동적 생성)
export interface LLMQuestionOption {
    label: string;               // 선택지 텍스트 (비전문가 언어)
    direction: string;           // 연관 분기 ID (콤마 구분 가능)
}

// LLM 초기 분석 응답
export interface LLMInitialAnalysis {
    feedbackType: TriggerType;
    axis: string;                // 관련 감성 축
    candidates: string[];        // 초기 후보 분기 ID 배열
    eliminated: string[];        // 초기 배제 분기 ID 배열
    question: string;            // 첫 번째 질문 (클라이언트용)
    options: LLMQuestionOption[];
}

// LLM 후속 질문 응답
export interface LLMFollowUpResponse {
    eliminatedNow: string[];     // 이번 답변으로 배제할 분기 ID
    eliminationReason: string;   // 배제 이유
    candidates: string[];        // 갱신된 후보 분기 ID 배열
    converged: boolean;          // 수렴 여부
    // 수렴 아닌 경우
    question?: string;
    options?: LLMQuestionOption[];
    // 수렴인 경우
    primaryBranch?: string;
    secondaryBranch?: string | null;
    reasoning?: string;          // 최종 판정 근거
}

// LLM 브리프 생성 응답
export interface LLMBriefResponse {
    clientSummary: string;       // 클라이언트 확인용 해석 요약 (비전문가 언어)
    clientAntiSummary: string;   // "이건 아닌" 방향 요약
    designerSummary: string;     // 디자이너용 해석 요약 (전문 용어)
    adjustmentNotes: string;     // 조정 포인트 요약 (맥락 반영)
    confusionWarnings: string[]; // 혼동 경고
}

// 세션 상태 (API 전달용)
export interface SessionState {
    sessionId: string;
    originalFeedback: string;
    feedbackType?: TriggerType;  // LLM 초기 분석에서 결정된 피드백 유형
    userContext: UserContext;
    candidates: string[];        // 현재 남은 후보 분기 ID
    eliminated: string[];        // 배제된 분기 ID
    answerHistory: LLMAnswerRecord[];
    questionCount: number;
    converged: boolean;
    // 수렴 결과
    primaryBranch?: string;
    secondaryBranch?: string | null;
    reasoning?: string;
}

// LLM용 질문-응답 이력
export interface LLMAnswerRecord {
    question: string;
    options: LLMQuestionOption[];
    selectedLabel: string;       // 클라이언트가 선택한 선택지
    selectedDirection: string;   // 선택한 방향의 분기 ID
}

// API 요청/응답 타입

// POST /api/session/start
export interface StartSessionRequest {
    feedbackText: string;
    context: UserContext;
}

export interface StartSessionResponse {
    sessionId: string;
    initialAnalysis: LLMInitialAnalysis;
    sessionState: SessionState;
}

// POST /api/session/[id]/answer
export interface SubmitAnswerRequest {
    selectedLabel: string;
    selectedDirection: string;
    currentQuestion?: string;        // 현재 질문 텍스트 (이력 기록용)
    currentOptions?: LLMQuestionOption[]; // 현재 질문 선택지
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

// POST /api/brief/[id]/generate
export interface GenerateBriefRequest {
    sessionState: SessionState;
}

export interface GenerateBriefResponse {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
}
