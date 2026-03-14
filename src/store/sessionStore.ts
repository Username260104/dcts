import { create } from 'zustand';
import type {
    SessionStep,
    UserContext,
    SessionState,
    LLMInitialAnalysis,
    LLMQuestionOption,
    BriefOutput,
    LLMBriefResponse,
    QuestionType,
} from '@/types/ontology';

// 현재 질문 정보
interface CurrentQuestion {
    question: string;
    options: LLMQuestionOption[];
    type?: QuestionType;
}

interface SessionStore {
    // 세션 단계
    step: SessionStep;
    setStep: (step: SessionStep) => void;

    // 사용자 입력
    feedbackText: string;
    setFeedbackText: (text: string) => void;

    // 맥락 변수
    userContext: UserContext;
    setUserContext: (ctx: Partial<UserContext>) => void;

    // 세션 상태 (API에서 받아옴)
    sessionState: SessionState | null;
    setSessionState: (state: SessionState) => void;

    // 초기 분석 결과
    initialAnalysis: LLMInitialAnalysis | null;
    setInitialAnalysis: (analysis: LLMInitialAnalysis) => void;

    // 현재 질문
    currentQuestion: CurrentQuestion | null;
    setCurrentQuestion: (q: CurrentQuestion | null) => void;

    // 로딩 상태
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;

    // 에러
    error: string | null;
    setError: (error: string | null) => void;

    // Fallback 사용 여부
    usedFallback: boolean;
    setUsedFallback: (used: boolean) => void;

    // 수렴 결과
    converged: boolean;
    convergenceResult: {
        primaryBranch: string;
        secondaryBranch: string | null;
        reasoning: string;
    } | null;
    setConvergenceResult: (result: {
        primaryBranch: string;
        secondaryBranch: string | null;
        reasoning: string;
    }) => void;

    // 브리프 출력
    brief: BriefOutput | null;
    llmSummary: LLMBriefResponse | null;
    setBrief: (brief: BriefOutput, llmSummary: LLMBriefResponse) => void;

    // API 호출 함수
    startSession: () => Promise<void>;
    submitAnswer: (selectedLabel: string, selectedDirection: string) => Promise<void>;
    generateBrief: () => Promise<void>;

    // 리셋
    reset: () => void;
    resetToContext: () => void;
}

const initialUserContext: UserContext = {
    industry: '',
    pricePosition: '',
    projectStage: '',
    targetAge: '',
};

export const useSessionStore = create<SessionStore>((set, get) => ({
    step: 'entry',
    feedbackText: '',
    userContext: { ...initialUserContext },
    sessionState: null,
    initialAnalysis: null,
    currentQuestion: null,
    isLoading: false,
    error: null,
    usedFallback: false,
    converged: false,
    convergenceResult: null,
    brief: null,
    llmSummary: null,

    setStep: (step) => set({ step }),
    setFeedbackText: (feedbackText) => set({ feedbackText }),
    setUserContext: (ctx) => set((s) => ({
        userContext: { ...s.userContext, ...ctx },
    })),
    setSessionState: (sessionState) => set({ sessionState }),
    setInitialAnalysis: (initialAnalysis) => set({ initialAnalysis }),
    setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setUsedFallback: (usedFallback) => set({ usedFallback }),
    setConvergenceResult: (result) => set({
        converged: true,
        convergenceResult: result,
    }),
    setBrief: (brief, llmSummary) => set({ brief, llmSummary }),

    // 세션 시작 API 호출
    startSession: async () => {
        const { feedbackText, userContext } = get();
        set({ isLoading: true, error: null });

        try {
            const res = await fetch('/api/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackText, context: userContext }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '세션 시작 실패');
            }

            const data = await res.json();

            set({
                sessionState: data.sessionState,
                initialAnalysis: data.initialAnalysis,
                usedFallback: data.usedFallback ?? false,
                currentQuestion: {
                    question: data.initialAnalysis.question,
                    options: data.initialAnalysis.options,
                    type: 'text_choice' as QuestionType,
                },
                step: 'questions',
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류',
                isLoading: false,
            });
        }
    },

    // 답변 제출 API 호출 (ISSUE 4b: 질문 텍스트/옵션 전달)
    submitAnswer: async (selectedLabel, selectedDirection) => {
        const { sessionState, currentQuestion } = get();
        if (!sessionState) return;

        set({ isLoading: true, error: null });

        try {
            const res = await fetch(`/api/session/${sessionState.sessionId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedLabel,
                    selectedDirection,
                    sessionState,
                    currentQuestion: currentQuestion?.question ?? '',
                    currentOptions: currentQuestion?.options ?? [],
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '답변 처리 실패');
            }

            const data = await res.json();

            set({
                sessionState: data.sessionState,
                usedFallback: data.usedFallback ?? get().usedFallback,
                isLoading: false,
            });

            if (data.converged && data.result) {
                set({
                    converged: true,
                    convergenceResult: data.result,
                    currentQuestion: null,
                    step: 'confirm',
                });
            } else if (data.nextQuestion) {
                set({
                    currentQuestion: {
                        question: data.nextQuestion.question,
                        options: data.nextQuestion.options,
                        type: data.nextQuestion.type ?? 'text_choice',
                    },
                });
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류',
                isLoading: false,
            });
        }
    },

    // 브리프 생성 API 호출
    generateBrief: async () => {
        const { sessionState } = get();
        if (!sessionState) return;

        set({ isLoading: true, error: null });

        try {
            const res = await fetch(`/api/brief/${sessionState.sessionId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionState }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '브리프 생성 실패');
            }

            const data = await res.json();

            set({
                brief: data.brief,
                llmSummary: data.llmSummary,
                step: 'brief',
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류',
                isLoading: false,
            });
        }
    },

    // 전체 리셋
    reset: () => set({
        step: 'entry',
        feedbackText: '',
        userContext: { ...initialUserContext },
        sessionState: null,
        initialAnalysis: null,
        currentQuestion: null,
        isLoading: false,
        error: null,
        usedFallback: false,
        converged: false,
        convergenceResult: null,
        brief: null,
        llmSummary: null,
    }),

    // 맥락 설정으로 되돌아가기 (feedbackText/userContext 유지)
    resetToContext: () => set({
        step: 'context',
        sessionState: null,
        initialAnalysis: null,
        currentQuestion: null,
        isLoading: false,
        error: null,
        usedFallback: false,
        converged: false,
        convergenceResult: null,
        brief: null,
        llmSummary: null,
    }),
}));
