import type {
    LLMQuestionOption,
    Question,
    QuestionEngineState,
    QuestionType,
    SessionState,
} from '@/types/ontology';

export function reconstructQuestionState(sessionState: SessionState): QuestionEngineState {
    let neitherCount = 0;

    for (let i = sessionState.answerHistory.length - 1; i >= 0; i -= 1) {
        const answer = sessionState.answerHistory[i];
        if (answer.selectedDirection !== '') break;
        neitherCount += 1;
    }

    return {
        remainingCandidates: sessionState.candidates,
        eliminated: sessionState.eliminated,
        answerHistory: sessionState.answerHistory.map((answer) => ({
            questionText: answer.question,
            answerLabel: answer.selectedLabel,
            eliminatedBranches: [],
            remainingBranches: sessionState.candidates,
        })),
        confidence: 0,
        questionCount: sessionState.questionCount,
        neitherCount,
    };
}

export function mapQuestionOptions(options: Question['options']): LLMQuestionOption[] {
    return options.map((option) => ({
        label: option.label,
        direction: option.branchIds.join(','),
    }));
}

export function createQuestionPayload(question: Question): {
    question: string;
    options: LLMQuestionOption[];
    type: QuestionType;
} {
    return {
        question: question.text,
        options: mapQuestionOptions(question.options),
        type: question.type,
    };
}
