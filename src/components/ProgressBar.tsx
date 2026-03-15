'use client';

import { useSessionStore } from '@/store/sessionStore';
import type { SessionStep } from '@/types/ontology';

const steps: { key: SessionStep; label: string }[] = [
    { key: 'entry', label: '피드백' },
    { key: 'context', label: '맥락' },
    { key: 'questions', label: '질문' },
    { key: 'confirm', label: '확인' },
    { key: 'brief', label: '브리프' },
];

export default function ProgressBar() {
    const step = useSessionStore((state) => state.step);
    const currentIndex = steps.findIndex((item) => item.key === step);

    return (
        <div className="w-full px-4 py-3">
            <div className="mx-auto flex max-w-xl items-center justify-between">
                {steps.map((item, index) => (
                    <div key={item.key} className="flex flex-1 items-center last:flex-none">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300 ${
                                index < currentIndex
                                    ? 'bg-gray-900 text-white'
                                    : index === currentIndex
                                        ? 'bg-gray-900 text-white ring-2 ring-gray-400 ring-offset-2'
                                        : 'bg-gray-200 text-gray-400'
                            }`}
                        >
                            {index < currentIndex ? '✓' : index + 1}
                        </div>

                        <span
                            className={`ml-2 hidden text-xs sm:block ${
                                index <= currentIndex ? 'font-medium text-gray-900' : 'text-gray-400'
                            }`}
                        >
                            {item.label}
                        </span>

                        {index < steps.length - 1 && (
                            <div
                                className={`mx-3 h-px flex-1 ${
                                    index < currentIndex ? 'bg-gray-900' : 'bg-gray-200'
                                }`}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
