'use client';

import { getFrequentTriggers } from '@/lib/triggerMatcher';
import { useSessionStore } from '@/store/sessionStore';

const frequentTriggers = getFrequentTriggers();

export default function EntryStep() {
    const feedbackText = useSessionStore((state) => state.feedbackText);
    const setFeedbackText = useSessionStore((state) => state.setFeedbackText);
    const refinedFeedbackText = useSessionStore((state) => state.refinedFeedbackText);
    const refineChoice = useSessionStore((state) => state.refineChoice);
    const setRefineChoice = useSessionStore((state) => state.setRefineChoice);
    const refineFeedback = useSessionStore((state) => state.refineFeedback);
    const isRefiningFeedback = useSessionStore((state) => state.isRefiningFeedback);
    const error = useSessionStore((state) => state.error);
    const setStep = useSessionStore((state) => state.setStep);

    return (
        <div className="flex w-full max-w-2xl flex-col items-center justify-center px-4">
            <div className="mb-8 text-center">
                <p
                    className="mt-4 text-xl font-bold text-gray-700 sm:text-2xl"
                    style={{ fontFamily: 'Pretendard, Arial, Helvetica, sans-serif', fontWeight: 700 }}
                >
                    전달하고 싶던 피드백을 자연스럽게 적어 주세요
                    <span className="signal-dot">.</span>
                </p>
            </div>

            <div className="mb-6 w-full max-w-lg">
                <textarea
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                    placeholder={`예) "조금 더 고급스럽게 보여요."\n"너무 촌스러워요."\n"뭔가 조금 더 밝고 정돈됐으면 좋겠어요."`}
                    className="h-32 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                />

                {refinedFeedbackText ? (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-medium text-gray-500">다듬은 표현</p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-900">
                            {refinedFeedbackText}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setRefineChoice('refined')}
                                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                    refineChoice === 'refined'
                                        ? 'bg-gray-900 text-white'
                                        : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                                }`}
                            >
                                다듬은 표현으로 진행
                            </button>
                            <button
                                type="button"
                                onClick={() => setRefineChoice('original')}
                                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                    refineChoice === 'original'
                                        ? 'bg-gray-900 text-white'
                                        : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                                }`}
                            >
                                원래 표현으로 진행
                            </button>
                        </div>
                    </div>
                ) : null}

                {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="mb-8 w-full max-w-lg">
                <p className="mb-3 text-center text-xs text-gray-400">자주 쓰는 표현</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {frequentTriggers.map((trigger) => (
                        <button
                            key={trigger.id}
                            onClick={() => setFeedbackText(trigger.expression)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                                feedbackText === trigger.expression
                                    ? 'border-gray-900 bg-gray-900 text-white'
                                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
                            }`}
                        >
                            {trigger.expression}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={() => refineFeedback()}
                    disabled={feedbackText.trim().length === 0 || isRefiningFeedback}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-[15px] font-medium text-gray-700 transition-all hover:border-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                    {isRefiningFeedback ? '다듬는 중...' : '표현 다듬기'}
                </button>
                <button
                    onClick={() => setStep('context')}
                    disabled={feedbackText.trim().length === 0}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gray-900 px-8 py-3 text-[15px] font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 sm:min-w-28"
                >
                    다음
                </button>
            </div>
        </div>
    );
}
