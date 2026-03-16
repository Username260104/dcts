'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import contextData from '@/data/context.json';
import { useSessionStore } from '@/store/sessionStore';
import type { ContextVariables } from '@/types/ontology';

const ctxData = contextData as ContextVariables;

const contextSections = [
    {
        key: 'industry' as const,
        description: '어떤 업종의 브랜드인가요?',
        options: Object.keys(ctxData.industry),
    },
    {
        key: 'pricePosition' as const,
        description: '가격대는 어느 쪽인가요?',
        options: Object.keys(ctxData.pricePosition),
    },
    {
        key: 'projectStage' as const,
        description: '어떤 작업 단계인가요?',
        options: Object.keys(ctxData.projectStage),
    },
    {
        key: 'targetAge' as const,
        description: '주요 타깃 연령대는 어떻게 되나요?',
        options: Object.keys(ctxData.targetAge),
    },
];

const urlParamMap: Record<string, keyof ContextVariables> = {
    industry: 'industry',
    price: 'pricePosition',
    stage: 'projectStage',
    age: 'targetAge',
};

export default function ContextStep() {
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

    const isComplete = Boolean(
        userContext.industry &&
        userContext.pricePosition &&
        userContext.projectStage
    );

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="mb-8 text-center">
                <h2 className="mb-1 text-xl font-bold text-gray-900">맥락 설정</h2>
                <p className="text-sm text-gray-500">
                    해석 정확도를 높이기 위해 프로젝트 맥락을 알려 주세요.
                </p>
            </div>

            <div className="w-full max-w-lg space-y-6">
                {contextSections.map((section) => (
                    <div key={section.key}>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            {section.description}
                        </label>
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
                        '질문 시작'
                    )}
                </button>
            </div>
        </div>
    );
}
