'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import contextData from '@/data/context.json';
import type { ContextVariables } from '@/types/ontology';

const ctxData = contextData as ContextVariables;

const CONTEXT_SECTIONS = [
    {
        key: 'industry' as const,
        label: '업종',
        description: '클라이언트의 업종은?',
        options: Object.keys(ctxData.industry),
    },
    {
        key: 'pricePosition' as const,
        label: '가격대',
        description: '브랜드의 가격 포지션은?',
        options: Object.keys(ctxData.pricePosition),
    },
    {
        key: 'projectStage' as const,
        label: '수정 단계',
        description: '몇 차 수정인가요?',
        options: Object.keys(ctxData.projectStage),
    },
    {
        key: 'targetAge' as const,
        label: '타겟 연령',
        description: '주요 타겟 연령대는?',
        options: Object.keys(ctxData.targetAge),
    },
];

// URL 파라미터 → 맥락 변수 매핑
const URL_PARAM_MAP: Record<string, keyof ContextVariables> = {
    industry: 'industry',
    price: 'pricePosition',
    stage: 'projectStage',
    age: 'targetAge',
};

export default function ContextStep() {
    const userContext = useSessionStore((s) => s.userContext);
    const setUserContext = useSessionStore((s) => s.setUserContext);
    const setStep = useSessionStore((s) => s.setStep);
    const startSession = useSessionStore((s) => s.startSession);
    const isLoading = useSessionStore((s) => s.isLoading);
    const searchParams = useSearchParams();
    const appliedRef = useRef(false);

    // URL 파라미터로 맥락 프리셋 적용 (ISSUE 5a)
    useEffect(() => {
        if (appliedRef.current) return;
        appliedRef.current = true;

        const updates: Partial<typeof userContext> = {};
        for (const [param, ctxKey] of Object.entries(URL_PARAM_MAP)) {
            const value = searchParams.get(param);
            if (value && ctxData[ctxKey] && value in ctxData[ctxKey]) {
                (updates as Record<string, string>)[ctxKey] = value;
            }
        }
        if (Object.keys(updates).length > 0) {
            setUserContext(updates);
        }
    }, [searchParams, setUserContext]);

    const isComplete = userContext.industry && userContext.pricePosition && userContext.projectStage;

    const handleNext = async () => {
        if (!isComplete) return;
        await startSession();
    };

    const handleBack = () => {
        setStep('entry');
    };

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-1">맥락 설정</h2>
                <p className="text-sm text-gray-500">
                    더 정확한 해석을 위해 프로젝트 맥락을 알려주세요
                </p>
            </div>

            <div className="w-full max-w-lg space-y-6">
                {CONTEXT_SECTIONS.map((section) => (
                    <div key={section.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {section.description}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {section.options.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setUserContext({ [section.key]: option })}
                                    className={`
                                        px-4 py-2 rounded-lg text-sm border transition-all
                                        ${userContext[section.key] === option
                                            ? 'bg-gray-900 text-white border-gray-900'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                                        }
                                    `}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 mt-8">
                <button
                    onClick={handleBack}
                    className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl
                               hover:bg-gray-50 transition-all text-sm"
                >
                    이전
                </button>
                <button
                    onClick={handleNext}
                    disabled={!isComplete || isLoading}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl text-base font-medium
                               disabled:bg-gray-300 disabled:cursor-not-allowed
                               hover:bg-gray-800 transition-all flex items-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
