'use client';

import { useSessionStore } from '@/store/sessionStore';
import type { InputRole } from '@/types/ontology';

const roleOptions = [
    {
        role: 'client' as const,
        title: '클라이언트 표현 구체화',
        bridge: '클라이언트 ↔ 에이전시',
        description:
            '클라이언트의 메일, 회의 메모, 메신저 대화처럼 아직 정리되지 않은 표현을 기준으로 시작합니다. 모호한 표현을 질문으로 좁혀 디자이너가 바로 판단할 수 있는 방향 언어로 연결합니다.',
    },
    {
        role: 'strategist' as const,
        title: '전략 의사결정 구체화',
        bridge: '전략 ↔ 디자인',
        description:
            '브랜드 방향, 포지셔닝 문장, 전달하고 싶은 인상처럼 상위 의도가 먼저 잡혀 있을 때 적합합니다. 전략 언어를 실제 디자인 의사결정에 쓸 수 있는 브리프 구조로 정리합니다.',
    },
] satisfies Array<{
    role: InputRole;
    title: string;
    bridge: string;
    description: string;
}>;

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
        <div className="w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <section className="mx-auto max-w-3xl text-center">
                <h1
                    className="text-[clamp(3rem,8vw,5.5rem)] font-bold tracking-[-0.04em] text-gray-900 leading-none"
                    style={{ fontFamily: 'Pretendard, Arial, Helvetica, sans-serif' }}
                >
                    Lens
                </h1>
                <p className="mx-auto mt-6 max-w-2xl break-keep text-[15px] leading-relaxed text-gray-600 sm:text-base">
                    클라이언트의 피드백과 전략 문장을 디자이너가 바로 판단할 수 있는 방향 언어로
                    정리해주는 도구입니다. 모호한 표현을 그대로 받더라도 필요한 질문을 거쳐 의미를
                    좁히고, 최종적으로는 해석 근거와 함께 브리프 형태의 결과로 정리합니다.
                </p>
            </section>

            <section className="mx-auto mt-20 max-w-4xl">
                <div className="text-center">
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-gray-900 sm:text-3xl">
                        어떤 기준으로 시작할까요?
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl break-keep text-[15px] leading-relaxed text-gray-500">
                        지금 손에 들고 있는 정보에 가장 가까운 방식으로 시작하면, 이후 질문과 결과
                        구성이 자연스럽게 이어집니다.
                    </p>
                </div>

                <div className="mt-10 grid gap-5 md:grid-cols-2">
                    {roleOptions.map((option) => (
                        <button
                            key={option.role}
                            type="button"
                            onClick={() => handleSelect(option.role)}
                            className="group relative flex h-full w-full flex-col items-start justify-start rounded-[2rem] border border-gray-200 bg-white px-8 pb-8 pt-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
                        >
                            <svg
                                className="absolute right-8 top-7 h-5 w-5 text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gray-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                                />
                            </svg>
                            <p className="mt-1 text-[13px] font-medium tracking-[-0.01em] text-gray-500">
                                {option.bridge}
                            </p>
                            <p className="mt-2 pr-10 text-xl font-semibold tracking-[-0.02em] text-gray-900">
                                {option.title}
                            </p>
                            <p className="mt-4 break-keep text-[15px] leading-relaxed text-gray-600">
                                {option.description}
                            </p>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
