import { create } from 'zustand';
import type {
    BriefOutput,
    ImportedFileMeta,
    InputRole,
    JobType,
    LLMBriefResponse,
    LLMInitialAnalysis,
    RefineFeedbackResponse,
    RefineSessionResponse,
    SessionState,
    SessionStep,
    UserContext,
    WorkflowConvergenceResult,
    WorkflowDebugState,
    WorkflowQuestion,
} from '@/types/ontology';

interface SessionStore {
    inputRole: InputRole;
    setInputRole: (role: InputRole) => void;
    jobType: JobType;
    setJobType: (jobType: JobType) => void;
    step: SessionStep;
    setStep: (step: SessionStep) => void;
    feedbackText: string;
    setFeedbackText: (text: string) => void;
    refinedFeedbackText: string | null;
    refineChoice: 'original' | 'refined' | null;
    setRefineChoice: (choice: 'original' | 'refined') => void;
    importedFile: ImportedFileMeta | null;
    setImportedFile: (file: ImportedFileMeta | null) => void;
    userContext: UserContext;
    setUserContext: (ctx: Partial<UserContext>) => void;
    sessionState: SessionState | null;
    setSessionState: (state: SessionState) => void;
    initialAnalysis: LLMInitialAnalysis | null;
    setInitialAnalysis: (analysis: LLMInitialAnalysis) => void;
    currentQuestion: WorkflowQuestion | null;
    setCurrentQuestion: (question: WorkflowQuestion | null) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    isRefiningFeedback: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    usedFallback: boolean;
    setUsedFallback: (used: boolean) => void;
    debugState: WorkflowDebugState;
    setDebugState: (debugState: WorkflowDebugState) => void;
    converged: boolean;
    convergenceResult: WorkflowConvergenceResult | null;
    setConvergenceResult: (result: WorkflowConvergenceResult) => void;
    brief: BriefOutput | null;
    llmSummary: LLMBriefResponse | null;
    setBrief: (brief: BriefOutput, llmSummary: LLMBriefResponse) => void;
    refineFeedback: () => Promise<void>;
    startSession: () => Promise<void>;
    submitAnswer: (selectedLabel: string, selectedDirection: string) => Promise<void>;
    refineSession: () => Promise<void>;
    generateBrief: () => Promise<void>;
    reset: () => void;
    resetToContext: () => void;
    returnToStart: () => void;
}

const initialUserContext: UserContext = {
    industry: '',
    pricePosition: '',
    projectStage: '',
    targetAge: '',
};

export const useSessionStore = create<SessionStore>((set, get) => ({
    inputRole: 'client' as InputRole,
    setInputRole: (inputRole) => set({ inputRole }),
    jobType: 'client_feedback_interpretation' as JobType,
    setJobType: (jobType) => set({ jobType }),
    step: 'role' as SessionStep,
    feedbackText: '',
    refinedFeedbackText: null,
    refineChoice: null,
    importedFile: null,
    userContext: { ...initialUserContext },
    sessionState: null,
    initialAnalysis: null,
    currentQuestion: null,
    isLoading: false,
    isRefiningFeedback: false,
    error: null,
    usedFallback: false,
    debugState: {},
    converged: false,
    convergenceResult: null,
    brief: null,
    llmSummary: null,

    setStep: (step) => set({ step }),
    setFeedbackText: (feedbackText) => set({
        feedbackText,
        refinedFeedbackText: null,
        refineChoice: null,
        importedFile: feedbackText.trim().length === 0 ? null : get().importedFile,
        error: null,
    }),
    setRefineChoice: (refineChoice) => set({ refineChoice }),
    setImportedFile: (importedFile) => set({ importedFile }),
    setUserContext: (ctx) => set((state) => ({
        userContext: { ...state.userContext, ...ctx },
    })),
    setSessionState: (sessionState) => set({ sessionState }),
    setInitialAnalysis: (initialAnalysis) => set({ initialAnalysis }),
    setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setUsedFallback: (usedFallback) => set({ usedFallback }),
    setDebugState: (debugState) => set({ debugState }),
    setConvergenceResult: (result) => set({
        converged: true,
        convergenceResult: result,
    }),
    setBrief: (brief, llmSummary) => set({ brief, llmSummary }),

    refineFeedback: async () => {
        const { feedbackText, userContext } = get();
        if (feedbackText.trim().length === 0) return;

        set({ isRefiningFeedback: true, error: null });

        try {
            const response = await fetch('/api/session/refine-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackText, context: userContext }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error || '표현 다듬기에 실패했습니다.');
            }

            const data = await response.json() as RefineFeedbackResponse;

            set({
                refinedFeedbackText: data.refinedText,
                refineChoice: null,
                isRefiningFeedback: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '표현 다듬기 중 오류가 발생했습니다.',
                isRefiningFeedback: false,
            });
        }
    },

    startSession: async () => {
        const { feedbackText, refinedFeedbackText, refineChoice, userContext, inputRole, jobType } = get();
        const selectedFeedbackText =
            refineChoice === 'refined' && refinedFeedbackText
                ? refinedFeedbackText
                : feedbackText;

        set({ isLoading: true, error: null });

        try {
            const response = await fetch('/api/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedbackText: selectedFeedbackText,
                    context: userContext,
                    inputRole,
                    jobType,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error || '세션 시작에 실패했습니다.');
            }

            const data = await response.json();

            set({
                sessionState: data.sessionState,
                initialAnalysis: data.initialAnalysis ?? null,
                usedFallback: data.usedFallback ?? false,
                debugState: data.debugState ?? {},
                currentQuestion: data.nextQuestion ?? null,
                converged: Boolean(data.converged),
                convergenceResult: data.result ?? null,
                step: data.converged ? 'confirm' : 'questions',
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
                isLoading: false,
            });
        }
    },

    submitAnswer: async (selectedLabel, selectedDirection) => {
        const { sessionState, currentQuestion } = get();
        if (!sessionState) return;

        set({ isLoading: true, error: null });

        try {
            const response = await fetch(`/api/session/${sessionState.sessionId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedLabel,
                    selectedDirection,
                    sessionState,
                    currentQuestion: currentQuestion?.question ?? '',
                    currentOptions: currentQuestion?.options ?? [],
                    currentQuestionMeta: currentQuestion?.meta,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error || '응답 처리에 실패했습니다.');
            }

            const data = await response.json();

            set({
                sessionState: data.sessionState,
                usedFallback: data.usedFallback ?? get().usedFallback,
                debugState: {
                    ...get().debugState,
                    ...(data.debugState ?? {}),
                },
                isLoading: false,
            });

            if (data.converged && data.result) {
                set({
                    converged: true,
                    convergenceResult: data.result,
                    currentQuestion: null,
                    step: 'confirm',
                });
                return;
            }

            if (data.nextQuestion) {
                set({
                    currentQuestion: data.nextQuestion,
                    step: 'questions',
                });
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
                isLoading: false,
            });
        }
    },

    refineSession: async () => {
        const { sessionState } = get();
        if (!sessionState) return;

        set({ isLoading: true, error: null });

        try {
            const response = await fetch(`/api/session/${sessionState.sessionId}/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionState }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error || '추가 질문 생성에 실패했습니다.');
            }

            const data = await response.json() as RefineSessionResponse;

            set({
                sessionState: data.sessionState,
                usedFallback: data.usedFallback ?? get().usedFallback,
                debugState: {
                    ...get().debugState,
                    ...(data.debugState ?? {}),
                },
                currentQuestion: data.nextQuestion ?? null,
                converged: Boolean(data.converged),
                convergenceResult: data.result ?? null,
                step: data.converged ? 'confirm' : 'questions',
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
                isLoading: false,
            });
        }
    },

    generateBrief: async () => {
        const { sessionState } = get();
        if (!sessionState) return;

        set({ isLoading: true, error: null });

        try {
            const response = await fetch(`/api/brief/${sessionState.sessionId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionState }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error || '브리프 생성에 실패했습니다.');
            }

            const data = await response.json();

            set({
                brief: data.brief,
                llmSummary: data.llmSummary,
                debugState: {
                    ...get().debugState,
                    ...(data.debugState ?? {}),
                },
                step: 'brief',
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
                isLoading: false,
            });
        }
    },

    reset: () => set({
        inputRole: 'client' as InputRole,
        jobType: 'client_feedback_interpretation' as JobType,
        step: 'role' as SessionStep,
        feedbackText: '',
        refinedFeedbackText: null,
        refineChoice: null,
        importedFile: null,
        userContext: { ...initialUserContext },
        sessionState: null,
        initialAnalysis: null,
        currentQuestion: null,
        isLoading: false,
        isRefiningFeedback: false,
        error: null,
        usedFallback: false,
        debugState: {},
        converged: false,
        convergenceResult: null,
        brief: null,
        llmSummary: null,
    }),

    resetToContext: () => set({
        step: 'context',
        sessionState: null,
        initialAnalysis: null,
        currentQuestion: null,
        isLoading: false,
        isRefiningFeedback: false,
        error: null,
        usedFallback: false,
        debugState: {},
        converged: false,
        convergenceResult: null,
        brief: null,
        llmSummary: null,
    }),

    returnToStart: () => set({
        inputRole: 'client' as InputRole,
        jobType: 'client_feedback_interpretation' as JobType,
        step: 'role',
        sessionState: null,
        initialAnalysis: null,
        currentQuestion: null,
        isLoading: false,
        isRefiningFeedback: false,
        error: null,
        usedFallback: false,
        debugState: {},
        converged: false,
        convergenceResult: null,
        brief: null,
        llmSummary: null,
    }),
}));
