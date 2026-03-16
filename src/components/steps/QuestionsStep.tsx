'use client';

import { useState } from 'react';
import { MAX_QUESTIONS } from '@/lib/constants';
import { useSessionStore } from '@/store/sessionStore';

export default function QuestionsStep() {
    const currentQuestion = useSessionStore((state) => state.currentQuestion);
    const sessionState = useSessionStore((state) => state.sessionState);
    const usedFallback = useSessionStore((state) => state.usedFallback);
    const submitAnswer = useSessionStore((state) => state.submitAnswer);
    const resetToContext = useSessionStore((state) => state.resetToContext);
    const isLoading = useSessionStore((state) => state.isLoading);
    const error = useSessionStore((state) => state.error);

    const [freeText, setFreeText] = useState('');

    const questionCount = sessionState?.questionCount ?? 0;
    const questionType = currentQuestion?.type ?? 'text_choice';

    const handleSelect = async (label: string, direction: string) => {
        await submitAnswer(label, direction);
    };

    const handleFreeTextSubmit = async () => {
        if (freeText.trim().length === 0) return;
        await submitAnswer(freeText.trim(), '');
        setFreeText('');
    };

    const handleBack = () => {
        const confirmed = window.confirm(
            '맥락 설정으로 돌아가면 현재 질문 진행은 초기화됩니다. 돌아가시겠어요?'
        );

        if (confirmed) {
            resetToContext();
        }
    };

    if (!currentQuestion) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <p className="text-gray-400">질문을 준비하고 있습니다.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="mb-8 w-full max-w-lg">
                <div
                    className={`mb-3 rounded-xl px-3 py-2 text-xs ${
                        usedFallback
                            ? 'border border-amber-200 bg-amber-50 text-amber-700'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                >
                    {usedFallback
                        ? '현재 질문은 정적 fallback 엔진으로 생성되고 있습니다.'
                        : '현재 질문은 LLM이 생성하고 있습니다.'}
                </div>
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                        질문 {Math.min(questionCount + 1, MAX_QUESTIONS)} / {MAX_QUESTIONS}
                    </span>
                    <span className="text-xs text-gray-400">
                        후보 {sessionState?.candidates.length ?? 0}개
                    </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                    <div
                        className="h-1.5 rounded-full bg-gray-900 transition-all duration-500"
                        style={{ width: `${(Math.min(questionCount + 1, MAX_QUESTIONS) / MAX_QUESTIONS) * 100}%` }}
                    />
                </div>
            </div>

            <div className="mb-8 w-full max-w-lg">
                <div className="rounded-2xl bg-gray-50 p-6">
                    <p className="text-center text-lg leading-relaxed text-gray-900">
                        {currentQuestion.question}
                    </p>
                    {sessionState?.intentInterpretation ? (
                        <p className="mt-3 text-center text-sm leading-6 text-gray-500">
                            {sessionState.intentInterpretation}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="w-full max-w-lg">
                {questionType === 'free_text' ? (
                    <div className="space-y-4">
                        <textarea
                            value={freeText}
                            onChange={(event) => setFreeText(event.target.value)}
                            placeholder="원하시는 방향을 편하게 적어 주세요."
                            className="h-28 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                        <button
                            onClick={handleFreeTextSubmit}
                            disabled={isLoading || freeText.trim().length === 0}
                            className="w-full rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {isLoading ? '분석 중...' : '제출'}
                        </button>
                    </div>
                ) : questionType === 'image_ab' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {currentQuestion.options
                                .filter((option) => option.direction !== '')
                                .map((option, index) => (
                                    <button
                                        key={`${option.label}-${index}`}
                                        onClick={() => handleSelect(option.label, option.direction)}
                                        disabled={isLoading}
                                        className="rounded-2xl border-2 border-gray-200 p-6 text-left transition-all hover:border-gray-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <div className="mb-2 text-xs font-medium text-gray-400">
                                            방향 {String.fromCharCode(65 + index)}
                                        </div>
                                        <p className="text-base leading-relaxed text-gray-900">
                                            {option.label}
                                        </p>
                                    </button>
                                ))}
                        </div>

                        {currentQuestion.options
                            .filter((option) => option.direction === '')
                            .map((option, index) => (
                                <button
                                    key={`${option.label}-${index}`}
                                    onClick={() => handleSelect(option.label, option.direction)}
                                    disabled={isLoading}
                                    className="w-full rounded-xl border border-dashed border-gray-300 px-6 py-3 text-center text-sm text-gray-500 transition-all hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {option.label}
                                </button>
                            ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {currentQuestion.options.map((option, index) => {
                            const isNeither = option.direction === '';

                            return (
                                <button
                                    key={`${option.label}-${index}`}
                                    onClick={() => handleSelect(option.label, option.direction)}
                                    disabled={isLoading}
                                    className={`w-full rounded-xl px-6 py-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                        isNeither
                                            ? 'border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                                            : 'border border-gray-300 text-gray-900 hover:border-gray-900 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-base">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="mt-6 flex items-center gap-2 text-gray-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    <span className="text-sm">다음 질문을 준비하고 있습니다.</span>
                </div>
            )}

            {error && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <button
                onClick={handleBack}
                className="mt-6 text-xs text-gray-400 transition-all hover:text-gray-600"
            >
                &larr; 맥락 설정으로 돌아가기
            </button>
        </div>
    );
}
