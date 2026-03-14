'use client';

import { useSessionStore } from '@/store/sessionStore';
import type { SessionStep } from '@/types/ontology';

const STEPS: { key: SessionStep; label: string }[] = [
    { key: 'entry', label: '피드백 입력' },
    { key: 'context', label: '맥락 설정' },
    { key: 'questions', label: '질문' },
    { key: 'confirm', label: '확인' },
    { key: 'brief', label: '브리프' },
];

export default function ProgressBar() {
    const step = useSessionStore((s) => s.step);
    const currentIndex = STEPS.findIndex((s) => s.key === step);

    return (
        <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between max-w-xl mx-auto">
                {STEPS.map((s, i) => (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                        {/* 원형 인디케이터 */}
                        <div
                            className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                                transition-all duration-300
                                ${i < currentIndex
                                    ? 'bg-gray-900 text-white'
                                    : i === currentIndex
                                        ? 'bg-gray-900 text-white ring-2 ring-gray-400 ring-offset-2'
                                        : 'bg-gray-200 text-gray-400'
                                }
                            `}
                        >
                            {i < currentIndex ? '✓' : i + 1}
                        </div>

                        {/* 라벨 */}
                        <span
                            className={`
                                hidden sm:block ml-2 text-xs
                                ${i <= currentIndex ? 'text-gray-900 font-medium' : 'text-gray-400'}
                            `}
                        >
                            {s.label}
                        </span>

                        {/* 연결 선 */}
                        {i < STEPS.length - 1 && (
                            <div
                                className={`
                                    flex-1 h-px mx-3
                                    ${i < currentIndex ? 'bg-gray-900' : 'bg-gray-200'}
                                `}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
