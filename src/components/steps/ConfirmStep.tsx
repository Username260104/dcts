'use client';

import { getBranchById } from '@/lib/questionEngine';
import { useSessionStore } from '@/store/sessionStore';

export default function ConfirmStep() {
    const convergenceResult = useSessionStore((state) => state.convergenceResult);
    const sessionState = useSessionStore((state) => state.sessionState);
    const usedFallback = useSessionStore((state) => state.usedFallback);
    const generateBrief = useSessionStore((state) => state.generateBrief);
    const refineSession = useSessionStore((state) => state.refineSession);
    const isLoading = useSessionStore((state) => state.isLoading);

    if (!convergenceResult) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <p className="text-gray-400">결과를 정리하고 있습니다.</p>
            </div>
        );
    }

    const primaryBranch = getBranchById(convergenceResult.primaryBranch);
    const secondaryBranch = convergenceResult.secondaryBranch
        ? getBranchById(convergenceResult.secondaryBranch)
        : null;

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <span className="text-xl text-green-600">!</span>
                </div>
                <h2 className="mb-1 text-xl font-bold text-gray-900">
                    이렇게 이해했어요
                </h2>
                <p className="text-sm text-gray-500">
                    맞는지 확인해 주세요
                </p>
            </div>

            <div
                className={`mb-6 w-full max-w-lg rounded-xl px-4 py-3 text-sm ${
                    usedFallback
                        ? 'border border-amber-200 bg-amber-50 text-amber-700'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
            >
                {usedFallback
                    ? '이 결과는 정적 fallback 엔진이 수렴시킨 결과입니다.'
                    : '이 결과는 LLM 해석을 기반으로 수렴된 결과입니다.'}
            </div>

            <div className="w-full max-w-lg space-y-4">
                {primaryBranch && (
                    <div className="rounded-2xl bg-gray-50 p-6">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                                1순위
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                                {primaryBranch.branchLabel}
                            </span>
                        </div>
                        <p className="text-base leading-relaxed text-gray-900">
                            {primaryBranch.descriptionClient}
                        </p>
                    </div>
                )}

                {secondaryBranch && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                                참고
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                                {secondaryBranch.branchLabel}
                            </span>
                        </div>
                        <p className="text-base leading-relaxed text-gray-700">
                            {secondaryBranch.descriptionClient}
                        </p>
                    </div>
                )}

                {convergenceResult.reasoning && (
                    <div className="rounded-xl bg-blue-50 px-4 py-3">
                        <p className="mb-1 text-xs font-medium text-blue-600">판단 근거</p>
                        <p className="text-sm text-blue-800">{convergenceResult.reasoning}</p>
                    </div>
                )}

                {sessionState && sessionState.answerHistory.length > 0 && (
                    <details className="group">
                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                            질문-답변 이력 보기
                        </summary>
                        <div className="mt-2 space-y-2 border-l-2 border-gray-200 pl-2">
                            {sessionState.answerHistory.map((answer, index) => (
                                <div key={`${answer.question}-${index}`} className="text-xs text-gray-500">
                                    <span className="font-medium">Q{index + 1}:</span> {answer.question}
                                    <br />
                                    <span className="ml-4 text-gray-900">
                                        &rarr; {answer.selectedLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>

            <div className="mt-8 flex gap-3">
                <button
                    onClick={() => refineSession()}
                    disabled={isLoading}
                    className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                    아니요, 다시 물어봐주세요
                </button>
                <button
                    onClick={() => generateBrief()}
                    disabled={isLoading}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-3 text-base font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isLoading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
