'use client';

import { useSessionStore } from '@/store/sessionStore';
import type { InputRole } from '@/types/ontology';

export default function RoleStep() {
    const setInputRole = useSessionStore((state) => state.setInputRole);
    const setJobType = useSessionStore((state) => state.setJobType);
    const setStep = useSessionStore((state) => state.setStep);

    const handleSelect = (role: InputRole) => {
        setInputRole(role);
        setJobType(
            role === 'strategist'
                ? 'strategy_to_design_translation'
                : 'client_feedback_interpretation'
        );
        setStep('entry');
    };

    return (
        <div className="flex w-full max-w-lg flex-col items-center px-4 py-8">
            <div className="mb-8 text-center">
                <h2 className="mb-2 text-xl font-bold text-gray-900">
                    어떤 기준으로 시작할까요?
                </h2>
                <p className="max-w-md text-sm leading-6 text-gray-500">
                    출발점에 따라 해석 방식과 질문 흐름이 달라집니다.
                    지금 가지고 있는 정보에 가장 가까운 경로를 선택해 주세요.
                </p>
            </div>

            <div className="w-full space-y-3">
                <button
                    onClick={() => handleSelect('client')}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:border-gray-400 hover:shadow-md"
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                        Original Feedback
                    </p>
                    <p className="text-base font-medium text-gray-900">
                        클라이언트 피드백 해석
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                        클라이언트가 남긴 원문, 회의 메모, 메신저 피드백을 기준으로 시작합니다.
                        모호한 표현을 질문으로 풀어가며 디자인 의도를 해석 브리프로 정리합니다.
                    </p>
                </button>

                <button
                    onClick={() => handleSelect('strategist')}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:border-gray-400 hover:shadow-md"
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                        Strategic Intent
                    </p>
                    <p className="text-base font-medium text-gray-900">
                        전략 방향 정리
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                        브랜드 포지셔닝, 경쟁 맥락, 원하는 인상처럼 내부에서 정리한 판단을 기준으로 시작합니다.
                        추상적인 전략 언어를 실제 시안 조정 기준으로 구체화할 때 적합합니다.
                    </p>
                </button>
            </div>
        </div>
    );
}
