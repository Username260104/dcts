'use client';

import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { MAX_QUESTIONS } from '@/lib/constants';

export default function QuestionsStep() {
    const currentQuestion = useSessionStore((s) => s.currentQuestion);
    const sessionState = useSessionStore((s) => s.sessionState);
    const submitAnswer = useSessionStore((s) => s.submitAnswer);
    const resetToContext = useSessionStore((s) => s.resetToContext);
    const isLoading = useSessionStore((s) => s.isLoading);
    const error = useSessionStore((s) => s.error);

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
        if (confirm('맥락 설정으로 돌아가면 현재 질문 진행이 초기화됩니다. 돌아가시겠어요?')) {
            resetToContext();
        }
    };

    if (!currentQuestion) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-400">질문을 준비하고 있어요...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center px-4 py-8">
            {/* 진행률 */}
            <div className="w-full max-w-lg mb-8">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">
                        질문 {questionCount + 1} / {MAX_QUESTIONS}
                    </span>
                    <span className="text-xs text-gray-400">
                        후보 {sessionState?.candidates.length ?? 0}개 남음
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                        className="bg-gray-900 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${((questionCount + 1) / MAX_QUESTIONS) * 100}%` }}
                    />
                </div>
            </div>

            {/* 질문 */}
            <div className="w-full max-w-lg mb-8">
                <div className="bg-gray-50 rounded-2xl p-6">
                    <p className="text-lg text-gray-900 leading-relaxed text-center">
                        {currentQuestion.question}
                    </p>
                </div>
            </div>

            {/* 선택지 — 질문 타입별 분기 렌더링 */}
            <div className="w-full max-w-lg">
                {questionType === 'free_text' ? (
                    /* free_text: 자유 텍스트 입력 */
                    <div className="space-y-4">
                        <textarea
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                            placeholder="원하시는 느낌을 편하게 적어주세요..."
                            className="w-full h-28 px-4 py-3 border border-gray-300 rounded-xl
                                       text-base text-gray-900 placeholder-gray-400
                                       focus:outline-none focus:ring-2 focus:ring-gray-900
                                       resize-none transition-all"
                        />
                        <button
                            onClick={handleFreeTextSubmit}
                            disabled={isLoading || freeText.trim().length === 0}
                            className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl
                                       font-medium disabled:bg-gray-300 disabled:cursor-not-allowed
                                       hover:bg-gray-800 transition-all"
                        >
                            {isLoading ? '분석 중...' : '제출'}
                        </button>
                    </div>
                ) : questionType === 'image_ab' ? (
                    /* image_ab: 비교 카드 (텍스트 기반, 이미지는 post-MVP) */
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentQuestion.options
                                .filter((opt) => opt.label !== '둘 다 아닌데요' && opt.direction !== '')
                                .map((option, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSelect(option.label, option.direction)}
                                        disabled={isLoading}
                                        className="p-6 border-2 border-gray-200 rounded-2xl text-left
                                                   hover:border-gray-900 hover:shadow-md
                                                   disabled:opacity-50 disabled:cursor-not-allowed
                                                   transition-all group"
                                    >
                                        <div className="text-xs text-gray-400 mb-2 font-medium">
                                            방향 {String.fromCharCode(65 + i)}
                                        </div>
                                        <p className="text-base text-gray-900 leading-relaxed">
                                            {option.label}
                                        </p>
                                    </button>
                                ))}
                        </div>
                        {/* VS 구분선 (모바일에서는 세로 사이에 표시) */}
                        <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                                        w-10 h-10 bg-white border-2 border-gray-300 rounded-full
                                        items-center justify-center text-xs font-bold text-gray-400 pointer-events-none">
                            VS
                        </div>
                        {/* "둘 다 아닌데요" 버튼 */}
                        {currentQuestion.options
                            .filter((opt) => opt.label === '둘 다 아닌데요' || opt.direction === '')
                            .map((option, i) => (
                                <button
                                    key={`neither-${i}`}
                                    onClick={() => handleSelect(option.label, option.direction)}
                                    disabled={isLoading}
                                    className="w-full px-6 py-3 rounded-xl text-center
                                               border border-dashed border-gray-300 text-gray-500
                                               hover:border-gray-400 hover:bg-gray-50
                                               disabled:opacity-50 disabled:cursor-not-allowed
                                               transition-all text-sm"
                                >
                                    {option.label}
                                </button>
                            ))}
                    </div>
                ) : (
                    /* text_choice: 기본 버튼 UI */
                    <div className="space-y-3">
                        {currentQuestion.options.map((option, i) => {
                            const isNeither = option.label === '둘 다 아닌데요' || option.direction === '';
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleSelect(option.label, option.direction)}
                                    disabled={isLoading}
                                    className={`
                                        w-full px-6 py-4 rounded-xl text-left transition-all
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        ${isNeither
                                            ? 'border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                                            : 'border border-gray-300 text-gray-900 hover:border-gray-900 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <span className="text-base">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 로딩 인디케이터 */}
            {isLoading && (
                <div className="mt-6 flex items-center gap-2 text-gray-500">
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">다음 질문을 준비하고 있어요...</span>
                </div>
            )}

            {/* 에러 */}
            {error && (
                <div className="mt-4 px-4 py-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* 이전 버튼 (ISSUE 5b) */}
            <button
                onClick={handleBack}
                className="mt-6 text-xs text-gray-400 hover:text-gray-600 transition-all"
            >
                &larr; 맥락 설정으로 돌아가기
            </button>
        </div>
    );
}
