'use client';

import { useSessionStore } from '@/store/sessionStore';
import { getBranchById } from '@/lib/questionEngine';

export default function ConfirmStep() {
    const convergenceResult = useSessionStore((s) => s.convergenceResult);
    const sessionState = useSessionStore((s) => s.sessionState);
    const generateBrief = useSessionStore((s) => s.generateBrief);
    const setStep = useSessionStore((s) => s.setStep);
    const isLoading = useSessionStore((s) => s.isLoading);

    if (!convergenceResult) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-400">결과를 분석하고 있어요...</p>
            </div>
        );
    }

    const primaryBranch = getBranchById(convergenceResult.primaryBranch);
    const secondaryBranch = convergenceResult.secondaryBranch
        ? getBranchById(convergenceResult.secondaryBranch)
        : null;

    const handleConfirm = async () => {
        await generateBrief();
    };

    const handleRetry = () => {
        setStep('entry');
        useSessionStore.getState().reset();
    };

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-600 text-xl">!</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                    이렇게 이해했어요
                </h2>
                <p className="text-sm text-gray-500">
                    맞는지 확인해주세요
                </p>
            </div>

            <div className="w-full max-w-lg space-y-4">
                {/* 1순위 분기 */}
                {primaryBranch && (
                    <div className="bg-gray-50 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                                1순위
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                                {primaryBranch.branchLabel}
                            </span>
                        </div>
                        <p className="text-base text-gray-900 leading-relaxed">
                            {primaryBranch.descriptionClient}
                        </p>
                    </div>
                )}

                {/* 2순위 분기 */}
                {secondaryBranch && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                2순위
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                                {secondaryBranch.branchLabel}
                            </span>
                        </div>
                        <p className="text-base text-gray-700 leading-relaxed">
                            {secondaryBranch.descriptionClient}
                        </p>
                    </div>
                )}

                {/* 판정 근거 */}
                {convergenceResult.reasoning && (
                    <div className="px-4 py-3 bg-blue-50 rounded-xl">
                        <p className="text-xs text-blue-600 font-medium mb-1">판정 근거</p>
                        <p className="text-sm text-blue-800">{convergenceResult.reasoning}</p>
                    </div>
                )}

                {/* 질문-응답 이력 */}
                {sessionState && sessionState.answerHistory.length > 0 && (
                    <details className="group">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                            질문-응답 이력 보기
                        </summary>
                        <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-200">
                            {sessionState.answerHistory.map((a, i) => (
                                <div key={i} className="text-xs text-gray-500">
                                    <span className="font-medium">Q{i + 1}:</span> {a.question}
                                    <br />
                                    <span className="text-gray-900 ml-4">
                                        &rarr; {a.selectedLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 mt-8">
                <button
                    onClick={handleRetry}
                    className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl
                               hover:bg-gray-50 transition-all text-sm"
                >
                    다시 하기
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl text-base font-medium
                               disabled:bg-gray-300 disabled:cursor-not-allowed
                               hover:bg-gray-800 transition-all flex items-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            브리프 생성 중...
                        </>
                    ) : (
                        '맞아요, 브리프 생성'
                    )}
                </button>
            </div>
        </div>
    );
}
