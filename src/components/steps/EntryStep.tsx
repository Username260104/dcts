'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import ReturnToStartButton from '@/components/ReturnToStartButton';
import { getFrequentTriggers } from '@/lib/triggerMatcher';
import { useSessionStore } from '@/store/sessionStore';
import type { ExtractFileResponse } from '@/types/ontology';

const frequentTriggers = getFrequentTriggers();
const MIN_TEXTAREA_HEIGHT = 48;
const MAX_TEXTAREA_HEIGHT = 240;
const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt,.md,.markdown,.json,.csv';

const entryCopy = {
    client: {
        title: '구체화할 피드백을 입력해 주세요',
        description:
            '표현이 거칠거나 모호해도 괜찮습니다. 원문에 가깝게 적을수록 실제 의도를 더 정확하게 좁힐 수 있습니다.',
        placeholder:
            '예: "고급스럽긴 한데 너무 딱딱하지 않았으면 좋겠어요." "지금보다 조금 더 프리미엄한 결로 보였으면 합니다."',
        helperTitle: '입력 가이드',
        helperText:
            '회의 메모, 메신저 대화, 수정 요청처럼 실제로 오간 표현을 그대로 붙여넣어 주세요.',
        samplesTitle: '예시로 시작하기',
    },
    strategist: {
        title: '전략 방향을 입력해 주세요',
        description:
            '브랜드 의도, 포지셔닝, 경쟁 구도, 원하는 인상을 함께 적으면 이후 질문이 더 빠르고 정교하게 좁혀집니다.',
        placeholder:
            '예: 프리미엄이지만 과시적이지 않고, 테크 기반이되 차갑게 보이지 않는 방향. 경쟁사보다 신뢰감은 유지하되 더 젊고 선명한 인상.',
        helperTitle: '권장 정보',
        helperText:
            '브랜드 성격, 목표 고객, 지금 시안의 문제감, 경쟁사와의 차별화 포인트를 함께 적으면 해석 정확도가 높아집니다.',
        samplesTitle: '',
    },
} as const;

function formatFrequentTriggerLabel(expression: string): string {
    return expression.replace(/\s{2,}/g, ' ').trim();
}

export default function EntryStep() {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRole = useSessionStore((state) => state.inputRole);
    const feedbackText = useSessionStore((state) => state.feedbackText);
    const setFeedbackText = useSessionStore((state) => state.setFeedbackText);
    const importedFile = useSessionStore((state) => state.importedFile);
    const setImportedFile = useSessionStore((state) => state.setImportedFile);
    const refinedFeedbackText = useSessionStore((state) => state.refinedFeedbackText);
    const refineChoice = useSessionStore((state) => state.refineChoice);
    const setRefineChoice = useSessionStore((state) => state.setRefineChoice);
    const refineFeedback = useSessionStore((state) => state.refineFeedback);
    const isRefiningFeedback = useSessionStore((state) => state.isRefiningFeedback);
    const error = useSessionStore((state) => state.error);
    const setError = useSessionStore((state) => state.setError);
    const setStep = useSessionStore((state) => state.setStep);
    const hasInput = feedbackText.trim().length > 0;
    const copy = entryCopy[inputRole];
    const [isImportingFile, setIsImportingFile] = useState(false);

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

    const handleFileButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleClearImportedFile = () => {
        setFeedbackText('');
        setImportedFile(null);
        setError(null);
    };

    const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (importedFile) {
            setImportedFile(null);
        }

        setFeedbackText(event.target.value);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (feedbackText.trim().length > 0) {
            const confirmed = window.confirm(
                '현재 입력한 내용이 파일 내용으로 대체됩니다. 계속할까요?'
            );

            if (!confirmed) {
                event.target.value = '';
                return;
            }
        }

        setIsImportingFile(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/session/extract-file', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json() as ExtractFileResponse | { error?: string };

            if (!response.ok) {
                const message = 'error' in data ? data.error : undefined;
                throw new Error(message || '파일을 불러오지 못했습니다.');
            }

            const extracted = data as ExtractFileResponse;

            setFeedbackText(extracted.text);
            setImportedFile({
                fileName: extracted.fileName,
                fileType: extracted.fileType,
                characterCount: extracted.characterCount,
                originalCharacterCount: extracted.originalCharacterCount,
                truncated: extracted.truncated,
            });
        } catch (uploadError) {
            setError(
                uploadError instanceof Error
                    ? uploadError.message
                    : '파일을 불러오는 중 오류가 발생했습니다.'
            );
        } finally {
            setIsImportingFile(false);
            event.target.value = '';
        }
    };

    return (
        <div className="flex w-full max-w-4xl flex-col items-center justify-center px-5 sm:px-8">
            <div className="mb-2 w-full max-w-3xl">
                <ReturnToStartButton />
            </div>

            <div className="mb-8 w-full text-center">
                <p
                    className="mt-4 px-2 text-[clamp(1.4625rem,6vw,2.5rem)] font-bold leading-tight tracking-[-0.03em] text-gray-700"
                    style={{ fontFamily: 'Pretendard, Arial, Helvetica, sans-serif', fontWeight: 700 }}
                >
                    {copy.title}
                    <span className="signal-dot">.</span>
                </p>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-500">
                    {copy.description}
                </p>
            </div>

            <div className="mb-6 w-full max-w-3xl">
                <div className="rounded-[2rem] border border-gray-200 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-all duration-300 ease-out focus-within:border-gray-300 focus-within:shadow-[0_12px_36px_rgba(15,23,42,0.12)]">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={feedbackText}
                        onChange={handleTextareaChange}
                        placeholder={copy.placeholder}
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                        <p className="text-sm font-medium text-gray-700">파일로 불러오기</p>
                        <p className="text-xs leading-5 text-gray-500">
                            지원 형식: PDF, DOCX, TXT, MD, JSON, CSV
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleFileButtonClick}
                        disabled={isImportingFile}
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-all duration-300 ease-out hover:border-gray-400 hover:bg-gray-50 disabled:pointer-events-none disabled:border-gray-100 disabled:text-gray-400"
                    >
                        {isImportingFile ? '파일 읽는 중...' : '파일 불러오기'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>

                <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                        {copy.helperTitle}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                        {copy.helperText}
                    </p>
                </div>

                {importedFile ? (
                    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-500">
                                    Imported File
                                </p>
                                <p className="mt-2 text-sm font-medium text-blue-900">
                                    {importedFile.fileName}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-blue-800">
                                    {importedFile.fileType} 문서에서 {importedFile.characterCount.toLocaleString()}자를 불러왔습니다.
                                    {importedFile.truncated
                                        ? ` 원문이 길어 ${importedFile.originalCharacterCount.toLocaleString()}자 중 앞부분만 반영했습니다.`
                                        : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleClearImportedFile}
                                className="text-xs font-medium text-blue-500 transition-all hover:text-blue-700"
                            >
                                비우기
                            </button>
                        </div>
                    </div>
                ) : null}

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

            {inputRole === 'client' && <div className="mb-8 w-full max-w-3xl">
                <p className="mb-3 text-center text-xs text-gray-400">
                    {copy.samplesTitle}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                    {frequentTriggers.map((trigger) => (
                        <button
                            key={trigger.id}
                            onClick={() => {
                                if (importedFile) {
                                    setImportedFile(null);
                                }

                                setFeedbackText(trigger.expression);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${feedbackText === trigger.expression
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
                                }`}
                        >
                            {formatFrequentTriggerLabel(trigger.expression)}
                        </button>
                    ))}
                </div>
            </div>}
        </div>
    );
}
