'use client';

import { useSessionStore } from '@/store/sessionStore';
import { getFrequentTriggers } from '@/lib/triggerMatcher';

const frequentTriggers = getFrequentTriggers();

export default function EntryStep() {
    const feedbackText = useSessionStore((s) => s.feedbackText);
    const setFeedbackText = useSessionStore((s) => s.setFeedbackText);
    const setStep = useSessionStore((s) => s.setStep);

    const handleChipClick = (expression: string) => {
        setFeedbackText(expression);
    };

    const handleNext = () => {
        if (feedbackText.trim().length === 0) return;
        setStep('context');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            {/* 헤더 */}
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    DCTS
                </h1>
                <p className="text-sm text-gray-500">
                    Design Communication Translation System
                </p>
                <p className="text-base text-gray-700 mt-4">
                    클라이언트가 뭐라고 했나요?
                </p>
            </div>

            {/* 피드백 입력 */}
            <div className="w-full max-w-lg mb-6">
                <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={'예: "좀 더 고급스럽게 해주세요"\n     "너무 촌스러워요"\n     "뭔가 좀 다른 느낌이었으면..."'}
                    className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl
                               text-base text-gray-900 placeholder-gray-400
                               focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                               resize-none transition-all"
                />
            </div>

            {/* 빈출 표현 칩 */}
            <div className="w-full max-w-lg mb-8">
                <p className="text-xs text-gray-400 mb-3 text-center">
                    자주 듣는 표현
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                    {frequentTriggers.map((trigger) => (
                        <button
                            key={trigger.id}
                            onClick={() => handleChipClick(trigger.expression)}
                            className={`
                                px-3 py-1.5 rounded-full text-sm border transition-all
                                ${feedbackText === trigger.expression
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                                }
                            `}
                        >
                            {trigger.expression}
                        </button>
                    ))}
                </div>
            </div>

            {/* 다음 버튼 */}
            <button
                onClick={handleNext}
                disabled={feedbackText.trim().length === 0}
                className="px-8 py-3 bg-gray-900 text-white rounded-xl text-base font-medium
                           disabled:bg-gray-300 disabled:cursor-not-allowed
                           hover:bg-gray-800 transition-all"
            >
                다음
            </button>
        </div>
    );
}
