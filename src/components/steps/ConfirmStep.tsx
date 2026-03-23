'use client';

import ReturnToStartButton from '@/components/ReturnToStartButton';
import { getDebugBanner } from '@/lib/debugSource';
import { getBranchById } from '@/lib/questionEngine';
import {
    STRATEGY_ARTIFACT_LABELS,
    STRATEGY_FIELD_LABELS,
} from '@/lib/strategyArtifacts';
import { useSessionStore } from '@/store/sessionStore';
import type { StrategyReadinessChecks, StrategyState } from '@/types/ontology';

function buildReadinessItems(readinessChecks: StrategyReadinessChecks) {
    return [
        {
            key: 'complete',
            label: 'Complete',
            passed: readinessChecks.complete,
            notes: readinessChecks.completeNotes,
        },
        {
            key: 'specific',
            label: 'Specific',
            passed: readinessChecks.specific,
            notes: readinessChecks.specificNotes,
        },
        {
            key: 'coherent',
            label: 'Coherent',
            passed: readinessChecks.coherent,
            notes: readinessChecks.coherentNotes,
        },
        {
            key: 'actionable',
            label: 'Actionable',
            passed: readinessChecks.actionable,
            notes: readinessChecks.actionableNotes,
        },
    ] as const;
}

function getStrategySnapshotEntries(strategyState: StrategyState | undefined) {
    if (!strategyState) {
        return [];
    }

    return [
        strategyState.schema.businessChallenge
            ? ['이번 차수 과제', strategyState.schema.businessChallenge]
            : null,
        strategyState.schema.valueProposition
            ? ['핵심 가치 제안', strategyState.schema.valueProposition]
            : null,
        strategyState.schema.frameOfReference
            ? ['시장 프레임', strategyState.schema.frameOfReference]
            : null,
        strategyState.schema.scopeNow
            ? ['이번 차수 범위', strategyState.schema.scopeNow]
            : strategyState.schema.scope
                ? ['전체 범위', strategyState.schema.scope]
                : null,
    ].filter((entry): entry is [string, string] => entry !== null);
}

function PillList({
    values,
    tone = 'default',
}: {
    values: string[];
    tone?: 'default' | 'warn' | 'danger' | 'success';
}) {
    if (values.length === 0) {
        return <p className="text-sm text-gray-400">아직 정리되지 않았습니다.</p>;
    }

    const toneClass = {
        default: 'bg-gray-100 text-gray-700',
        warn: 'bg-amber-100 text-amber-800',
        danger: 'bg-red-100 text-red-800',
        success: 'bg-emerald-100 text-emerald-800',
    }[tone];

    return (
        <div className="flex flex-wrap gap-2">
            {values.map((value, index) => (
                <span
                    key={`${value}-${index}`}
                    className={`rounded-full px-3 py-1 text-sm ${toneClass}`}
                >
                    {value}
                </span>
            ))}
        </div>
    );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                {title}
            </p>
            {children}
        </div>
    );
}

export default function ConfirmStep() {
    const convergenceResult = useSessionStore((state) => state.convergenceResult);
    const sessionState = useSessionStore((state) => state.sessionState);
    const debugState = useSessionStore((state) => state.debugState);
    const generateBrief = useSessionStore((state) => state.generateBrief);
    const refineSession = useSessionStore((state) => state.refineSession);
    const isLoading = useSessionStore((state) => state.isLoading);

    const debugBanner = getDebugBanner('result', debugState.resultSource);

    if (!convergenceResult) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <p className="text-gray-400">결과를 정리하고 있습니다.</p>
            </div>
        );
    }

    if (convergenceResult.kind === 'client_interpretation') {
        const primaryBranch = getBranchById(convergenceResult.primaryBranch);
        const secondaryBranch = convergenceResult.secondaryBranch
            ? getBranchById(convergenceResult.secondaryBranch)
            : null;

        return (
            <div className="flex flex-col items-center px-4 py-8">
                <div className="mb-2 w-full max-w-lg">
                    <ReturnToStartButton confirmMessage="처음 화면으로 돌아가면 현재 해석 결과가 사라집니다. 돌아가시겠어요?" />
                </div>

                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <span className="text-xl text-green-600">!</span>
                    </div>
                    <h2 className="mb-1 text-xl font-bold text-gray-900">이렇게 이해했어요</h2>
                    <p className="text-sm text-gray-500">맞는지 확인해 주세요.</p>
                </div>

                {debugBanner && (
                    <div className={`mb-6 w-full max-w-lg rounded-xl px-4 py-3 text-sm ${debugBanner.className}`}>
                        {debugBanner.message}
                    </div>
                )}

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

                    {primaryBranch?.descriptionStrategy && (
                        <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
                            <p className="mb-1 text-xs font-medium text-purple-600">전략 해석</p>
                            <p className="text-sm leading-relaxed text-purple-800">
                                {primaryBranch.descriptionStrategy}
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
                                질문-응답 이력 보기
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
                        아니에요, 다시 물어봐 주세요
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

    const strategyState = convergenceResult.strategyState;
    const artifactLabel = strategyState.artifactType
        ? STRATEGY_ARTIFACT_LABELS[strategyState.artifactType]
        : '전략 산출물 미정';
    const snapshotEntries = getStrategySnapshotEntries(strategyState);
    const readinessItems = buildReadinessItems(strategyState.readinessChecks);
    const isReady = convergenceResult.kind === 'strategy_ready';

    return (
        <div className="flex flex-col items-center px-4 py-8">
            <div className="mb-2 w-full max-w-3xl">
                <ReturnToStartButton confirmMessage="처음 화면으로 돌아가면 현재 전략 정리 결과가 사라집니다. 돌아가시겠어요?" />
            </div>

            <div className="mb-8 text-center">
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                    isReady ? 'bg-green-100' : 'bg-amber-100'
                }`}>
                    <span className={`text-xl ${isReady ? 'text-green-600' : 'text-amber-600'}`}>!</span>
                </div>
                <h2 className="mb-1 text-xl font-bold text-gray-900">
                    {isReady ? 'handoff 기준이 정리됐어요' : 'handoff 전에 더 다듬을 부분이 있어요'}
                </h2>
                <p className="text-sm text-gray-500">
                    {isReady
                        ? '전략팀 판단을 디자이너가 바로 사용할 수 있는 상태인지 마지막으로 확인해 주세요.'
                        : '비어 있는 항목, 추상적인 표현, 충돌 요소를 먼저 점검해 주세요.'}
                </p>
            </div>

            {debugBanner && (
                <div className={`mb-6 w-full max-w-3xl rounded-xl px-4 py-3 text-sm ${debugBanner.className}`}>
                    {debugBanner.message}
                </div>
            )}

            <div className="w-full max-w-3xl space-y-4">
                <div className="rounded-2xl bg-gray-50 p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                            산출물
                        </span>
                        <span className="text-sm font-medium text-gray-700">{artifactLabel}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                            isReady
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                        }`}>
                            {strategyState.readinessStatus}
                        </span>
                    </div>
                    <p className="text-base leading-relaxed text-gray-900">
                        {convergenceResult.summary || '전략 요약을 정리하는 중입니다.'}
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {readinessItems.map((item) => (
                        <div
                            key={item.key}
                            className={`rounded-2xl border p-4 ${
                                item.passed
                                    ? 'border-emerald-200 bg-emerald-50'
                                    : 'border-amber-200 bg-amber-50'
                            }`}
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                    {item.label}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-xs ${
                                    item.passed
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {item.passed ? 'PASS' : 'CHECK'}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {item.notes.map((note, index) => (
                                    <p key={`${item.key}-${index}`} className="text-sm leading-relaxed text-gray-700">
                                        {note}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {snapshotEntries.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {snapshotEntries.map(([label, value]) => (
                            <InfoCard key={label} title={label}>
                                <p className="text-sm leading-relaxed text-gray-800">{value}</p>
                            </InfoCard>
                        ))}
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                    <InfoCard title="핸드오프 핵심 문장">
                        <p className="text-sm leading-relaxed text-gray-800">
                            {strategyState.diagnosis.handoffPremise}
                        </p>
                    </InfoCard>
                    <InfoCard title="핵심 긴장">
                        <p className="text-sm leading-relaxed text-gray-800">
                            {strategyState.diagnosis.coreTension}
                        </p>
                    </InfoCard>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <InfoCard title="지켜야 할 자산">
                        <PillList values={strategyState.schema.equitiesToProtect ?? []} tone="success" />
                    </InfoCard>
                    <InfoCard title="더 강하게 보여야 할 인상">
                        <PillList values={strategyState.schema.mustAmplify ?? []} tone="default" />
                    </InfoCard>
                    <InfoCard title="피해야 할 방향">
                        <PillList values={strategyState.schema.mustAvoid ?? strategyState.schema.noGo ?? []} tone="danger" />
                    </InfoCard>
                    <InfoCard title="디자인 평가 기준">
                        <PillList values={strategyState.schema.reviewCriteria ?? []} tone="warn" />
                    </InfoCard>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <InfoCard title="우선순위 기준">
                        <PillList values={strategyState.schema.decisionPriority ?? []} />
                    </InfoCard>
                    <InfoCard title="트레이드오프">
                        <PillList values={strategyState.schema.tradeOffs ?? []} />
                    </InfoCard>
                    <InfoCard title="디자이너와 확인할 질문">
                        <PillList values={strategyState.schema.openQuestionsForDesign ?? []} />
                    </InfoCard>
                    <InfoCard title="필수 반영 요소">
                        <PillList values={strategyState.schema.mandatories ?? []} />
                    </InfoCard>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <InfoCard title="의사결정 프레임">
                        <PillList values={strategyState.diagnosis.decisionFrame} tone="default" />
                    </InfoCard>
                    <InfoCard title="실행 함의">
                        <PillList values={strategyState.diagnosis.creativeImplications} tone="default" />
                    </InfoCard>
                </div>

                {strategyState.diagnosis.workingAssumptions.length > 0 && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <p className="mb-2 text-xs font-medium text-blue-700">현재 가정으로 두고 있는 항목</p>
                        <PillList values={strategyState.diagnosis.workingAssumptions} tone="default" />
                    </div>
                )}

                {!isReady && strategyState.diagnosis.prioritizedGaps.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-medium text-slate-700">우선 보강해야 할 순서</p>
                        <PillList values={strategyState.diagnosis.prioritizedGaps} tone="default" />
                    </div>
                )}

                {!isReady && strategyState.missingFields.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="mb-2 text-xs font-medium text-amber-700">아직 비어 있는 항목</p>
                        <PillList
                            values={strategyState.missingFields.map((field) => STRATEGY_FIELD_LABELS[field])}
                            tone="warn"
                        />
                    </div>
                )}

                {!isReady && strategyState.weakFields.length > 0 && (
                    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                        <p className="mb-2 text-xs font-medium text-yellow-700">더 구체화가 필요한 항목</p>
                        <PillList
                            values={strategyState.weakFields.map((field) => STRATEGY_FIELD_LABELS[field])}
                            tone="warn"
                        />
                    </div>
                )}

                {!isReady && strategyState.contradictions.length > 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="mb-2 text-xs font-medium text-red-700">충돌하는 지시</p>
                        <div className="space-y-2">
                            {strategyState.contradictions.map((item, index) => (
                                <p key={`${item}-${index}`} className="text-sm leading-relaxed text-red-800">
                                    {item}
                                </p>
                            ))}
                        </div>
                    </div>
                )}

                {sessionState && sessionState.answerHistory.length > 0 && (
                    <details className="group">
                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                            질문-응답 이력 보기
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
                {!isReady && (
                    <button
                        onClick={() => refineSession()}
                        disabled={isLoading}
                        className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                        보강 질문 더 진행하기
                    </button>
                )}
                <button
                    onClick={() => generateBrief()}
                    disabled={isLoading}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-3 text-base font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isLoading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            {isReady ? 'handoff 브리프 생성 중...' : 'gap memo 생성 중...'}
                        </>
                    ) : (
                        isReady ? 'handoff 브리프 생성' : 'gap memo 생성'
                    )}
                </button>
            </div>
        </div>
    );
}
