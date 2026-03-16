'use client';

import { useLayoutEffect, useRef } from 'react';
import { getFrequentTriggers } from '@/lib/triggerMatcher';
import { useSessionStore } from '@/store/sessionStore';

const frequentTriggers = getFrequentTriggers();
const MIN_TEXTAREA_HEIGHT = 48;
const MAX_TEXTAREA_HEIGHT = 240;

function formatFrequentTriggerLabel(expression: string): string {
    return expression.replace(/\s{2,}/g, ' ').trim();
}

export default function EntryStep() {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const feedbackText = useSessionStore((state) => state.feedbackText);
    const setFeedbackText = useSessionStore((state) => state.setFeedbackText);
    const refinedFeedbackText = useSessionStore((state) => state.refinedFeedbackText);
    const refineChoice = useSessionStore((state) => state.refineChoice);
    const setRefineChoice = useSessionStore((state) => state.setRefineChoice);
    const refineFeedback = useSessionStore((state) => state.refineFeedback);
    const isRefiningFeedback = useSessionStore((state) => state.isRefiningFeedback);
    const error = useSessionStore((state) => state.error);
    const setStep = useSessionStore((state) => state.setStep);
    const hasInput = feedbackText.trim().length > 0;

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';

        const nextHeight = Math.min(
            Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT),
            MAX_TEXTAREA_HEIGHT
        );

        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
    }, [feedbackText]);

    return (
        <div className="flex w-full max-w-4xl flex-col items-center justify-center px-5 sm:px-8">
            <div className="mb-8 w-full text-center">
                <p
                    className="mt-4 whitespace-nowrap px-2 text-[clamp(1.4625rem,6vw,2.5rem)] font-bold leading-none tracking-[-0.03em] text-gray-700"
                    style={{ fontFamily: 'Pretendard, Arial, Helvetica, sans-serif', fontWeight: 700 }}
                >
                    {'\ud53c\ub4dc\ubc31\uc744 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc801\uc5b4 \uc8fc\uc138\uc694'}
                    <span className="signal-dot">.</span>
                </p>
            </div>

            <div className="mb-6 w-full max-w-3xl">
                <div className="rounded-[2rem] border border-gray-200 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-all duration-300 ease-out focus-within:border-gray-300 focus-within:shadow-[0_12px_36px_rgba(15,23,42,0.12)]">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={feedbackText}
                        onChange={(event) => setFeedbackText(event.target.value)}
                        placeholder={'\ud53c\ub4dc\ubc31\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.'}
                        className="min-h-12 w-full resize-none bg-transparent px-3 py-2 text-base leading-7 text-gray-900 placeholder-gray-400 outline-none transition-[height] duration-300 ease-out"
                    />

                    <div
                        className={`overflow-hidden px-1 transition-all duration-300 ease-out ${hasInput
                            ? 'mt-3 max-h-16 translate-y-0 opacity-100'
                            : 'mt-0 max-h-0 -translate-y-2 opacity-0'
                            }`}
                    >
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => refineFeedback()}
                                disabled={!hasInput || isRefiningFeedback}
                                className="inline-flex min-h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-all duration-300 ease-out hover:border-gray-400 hover:bg-gray-50 disabled:pointer-events-none disabled:translate-y-1 disabled:border-gray-100 disabled:text-gray-400"
                            >
                                {isRefiningFeedback
                                    ? '\ub2e4\ub4ec\ub294 \uc911...'
                                    : '\ud45c\ud604 \ub2e4\ub4ec\uae30'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('context')}
                                disabled={!hasInput}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-950 text-white transition-all duration-300 ease-out hover:bg-gray-800 disabled:pointer-events-none disabled:scale-95"
                                aria-label={'\ub2e4\uc74c \ub2e8\uacc4\ub85c \uc774\ub3d9'}
                            >
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    className="h-4 w-4"
                                >
                                    <path
                                        d="M4 10H15M15 10L10.5 5.5M15 10L10.5 14.5"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {refinedFeedbackText ? (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-medium text-gray-500">
                            {'\ub2e4\ub4ec\uc740 \ud45c\ud604'}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-900">
                            {refinedFeedbackText}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setRefineChoice('refined')}
                                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${refineChoice === 'refined'
                                    ? 'bg-gray-900 text-white'
                                    : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                                    }`}
                            >
                                {'\ub2e4\ub4ec\uc740 \ud45c\ud604\uc73c\ub85c \uc9c4\ud589'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRefineChoice('original')}
                                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${refineChoice === 'original'
                                    ? 'bg-gray-900 text-white'
                                    : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                                    }`}
                            >
                                {'\uc6d0\ub798 \ud45c\ud604\uc73c\ub85c \uc9c4\ud589'}
                            </button>
                        </div>
                    </div>
                ) : null}

                {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="mb-8 w-full max-w-3xl">
                <p className="mb-3 text-center text-xs text-gray-400">
                    {'\uc790\uc8fc \uc4f0\ub294 \ud45c\ud604'}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                    {frequentTriggers.map((trigger) => (
                        <button
                            key={trigger.id}
                            onClick={() => setFeedbackText(trigger.expression)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${feedbackText === trigger.expression
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
                                }`}
                        >
                            {formatFrequentTriggerLabel(trigger.expression)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
