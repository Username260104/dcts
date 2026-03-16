'use client';

import type { BriefDecisionStep } from '@/types/ontology';

interface DecisionTrailSectionProps {
    decisionTrail: BriefDecisionStep[];
}

export function DecisionTrailSection({ decisionTrail }: DecisionTrailSectionProps) {
    if (decisionTrail.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {decisionTrail.map((step, index) => (
                <div
                    key={`${step.question}-${step.selectedOption}-${index}`}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                            {index + 1}
                        </span>
                        <p className="text-sm font-medium text-gray-900">{step.question}</p>
                    </div>

                    <p className="text-sm text-gray-700">
                        선택: <span className="font-medium text-gray-900">{step.selectedOption}</span>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                        제시된 선택지: {step.availableOptions.join(' / ')}
                    </p>

                    <div className="mt-3 rounded-lg bg-white p-3">
                        <p className="text-xs font-medium text-gray-500">다음 단계가 이어진 이유</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-800">{step.nextReason}</p>
                    </div>

                    {step.nextAction === 'question' && step.nextPrompt && (
                        <div className="mt-3">
                            <p className="text-xs font-medium text-gray-500">이어진 질문</p>
                            <p className="mt-1 text-sm text-gray-800">{step.nextPrompt}</p>
                            {step.nextOptions && step.nextOptions.length > 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                    다음 선택지: {step.nextOptions.join(' / ')}
                                </p>
                            )}
                        </div>
                    )}

                    {step.nextAction === 'conclusion' && (
                        <p className="mt-3 text-xs font-medium text-emerald-700">
                            이 선택 이후 최종 브리프로 정리되었습니다.
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}
