'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ReturnToStartButton from '@/components/ReturnToStartButton';
import contextData from '@/data/context.json';
import { useSessionStore } from '@/store/sessionStore';
import type { ContextVariables } from '@/types/ontology';

const ctxData = contextData as ContextVariables;

const contextSections = [
    {
        key: 'industry' as const,
        description: '브랜드가 속한 업종',
        helper: '업종에 따라 먼저 검토할 시각 언어와 참조 분기가 달라집니다.',
        options: Object.keys(ctxData.industry),
    },
    {
        key: 'pricePosition' as const,
        description: '시장 가격대',
        helper: '같은 표현도 가격대에 따라 고급감의 밀도와 허용 범위가 달라집니다.',
        options: Object.keys(ctxData.pricePosition),
    },
    {
        key: 'projectStage' as const,
        description: '현재 작업 단계',
        helper: '수정 단계에 따라 질문 폭과 디테일 수준을 다르게 가져갑니다.',
        options: Object.keys(ctxData.projectStage),
    },
    {
        key: 'targetAge' as const,
        description: '주요 타깃 연령대',
        helper: '타깃 연령은 톤과 레퍼런스 방향을 더 현실적으로 좁히는 데 도움됩니다.',
        options: Object.keys(ctxData.targetAge),
    },
];

const urlParamMap: Record<string, keyof ContextVariables> = {
    industry: 'industry',
    price: 'pricePosition',
    stage: 'projectStage',
    age: 'targetAge',
};

function StrategistContextForm() {
    const userContext = useSessionStore((state) => state.userContext);
    const setUserContext = useSessionStore((state) => state.setUserContext);
    const setStep = useSessionStore((state) => state.setStep);
    const startSession = useSessionStore((state) => state.startSession);
    const isLoading = useSessionStore((state) => state.isLoading);

    const isComplete = Boolean(userContext.projectStage);

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="mb-2 w-full max-w-lg">
                <ReturnToStartButton />
            </div>

            <div className="mb-8 text-center">
                <h2 className="mb-1 text-xl font-bold text-gray-900">전략 해석에 필요한 프로젝트 조건</h2>
                <p className="max-w-lg text-sm leading-6 text-gray-500">
                    같은 방향 언어라도 브랜드 성격과 작업 단계에 따라 해석이 달라집니다.
                    최소한의 맥락을 적어 두면 이후 질문과 최종 브리프가 더 구체화됩니다.
                </p>
            </div>

            <div className="w-full max-w-lg space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        브랜드 또는 클라이언트명
                    </label>
                    <input
                        type="text"
                        value={userContext.brandDescription ?? ''}
                        onChange={(e) => setUserContext({ brandDescription: e.target.value })}
                        placeholder="예: LG U+ 브랜드 리뉴얼, 신규 프리미엄 스킨케어 브랜드"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        브랜드 포지셔닝과 성격
                    </label>
                    <textarea
                        value={userContext.positioningNote ?? ''}
                        onChange={(e) => setUserContext({ positioningNote: e.target.value })}
                        placeholder="예: 대중 브랜드지만 시각적으로는 프리미엄하게 보이고 싶음. 테크 기반이지만 지나치게 차갑게 보이지 않는 방향."
                        rows={2}
                        className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        현재 작업 단계
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(ctxData.projectStage).map((option) => (
                            <button
                                key={option}
                                onClick={() => setUserContext({ projectStage: option })}
                                className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                                    userContext.projectStage === option
                                        ? 'border-gray-900 bg-gray-900 text-white'
                                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        추가 제약 또는 차별화 포인트 <span className="text-gray-400">(선택)</span>
                    </label>
                    <textarea
                        value={userContext.additionalContext ?? ''}
                        onChange={(e) => setUserContext({ additionalContext: e.target.value })}
                        placeholder="예: 경쟁사는 모두 테크 톤이라 사람 냄새가 나는 방향이 필요. 이번 차수에서는 구조 변경보다 인상 조정이 우선."
                        rows={2}
                        className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400"
                    />
                </div>
            </div>

            <div className="mt-8 flex gap-3">
                <button
                    onClick={() => setStep('entry')}
                    className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50"
                >
                    이전
                </button>
                <button
                    onClick={() => startSession()}
                    disabled={!isComplete || isLoading}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-3 text-base font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isLoading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            분석 중...
                        </>
                    ) : (
                        '해석 시작'
                    )}
                </button>
            </div>
        </div>
    );
}

export default function ContextStep() {
    const inputRole = useSessionStore((state) => state.inputRole);
    const userContext = useSessionStore((state) => state.userContext);
    const setUserContext = useSessionStore((state) => state.setUserContext);
    const setStep = useSessionStore((state) => state.setStep);
    const startSession = useSessionStore((state) => state.startSession);
    const isLoading = useSessionStore((state) => state.isLoading);
    const searchParams = useSearchParams();
    const appliedRef = useRef(false);

    useEffect(() => {
        if (appliedRef.current) return;
        appliedRef.current = true;

        const updates: Partial<typeof userContext> = {};

        for (const [param, key] of Object.entries(urlParamMap)) {
            const value = searchParams.get(param);
            if (value && ctxData[key] && value in ctxData[key]) {
                (updates as Record<string, string>)[key] = value;
            }
        }

        if (Object.keys(updates).length > 0) {
            setUserContext(updates);
        }
    }, [searchParams, setUserContext, userContext]);

    if (inputRole === 'strategist') {
        return <StrategistContextForm />;
    }

    const isComplete = Boolean(
        userContext.industry &&
        userContext.pricePosition &&
        userContext.projectStage
    );

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="mb-2 w-full max-w-lg">
                <ReturnToStartButton />
            </div>

            <div className="mb-8 text-center">
                <h2 className="mb-1 text-xl font-bold text-gray-900">해석 기준을 맞추기 위한 프로젝트 맥락</h2>
                <p className="max-w-lg text-sm leading-6 text-gray-500">
                    업종, 가격대, 작업 단계에 따라 같은 피드백도 다른 방향으로 해석됩니다.
                    지금 시안이 놓인 조건을 알려 주시면 질문과 결과가 더 실무적으로 정리됩니다.
                </p>
            </div>

            <div className="w-full max-w-lg space-y-6">
                {contextSections.map((section) => (
                    <div key={section.key}>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            {section.description}
                        </label>
                        <p className="mb-3 text-sm leading-6 text-gray-500">
                            {section.helper}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {section.options.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setUserContext({ [section.key]: option })}
                                    className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                                        userContext[section.key] === option
                                            ? 'border-gray-900 bg-gray-900 text-white'
                                            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex gap-3">
                <button
                    onClick={() => setStep('entry')}
                    className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50"
                >
                    이전
                </button>
                <button
                    onClick={() => startSession()}
                    disabled={!isComplete || isLoading}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-3 text-base font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isLoading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            분석 중...
                        </>
                    ) : (
                        '해석 시작'
                    )}
                </button>
            </div>
        </div>
    );
}
