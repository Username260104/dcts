'use client';

import { DecisionTrailSection } from '@/components/brief/DecisionTrailSection';
import {
    buildStrategyGapDisplayModel,
    buildStrategyTranslationDisplayModel,
    type StrategyDisplayEntry,
    type StrategyDisplayTone,
} from '@/lib/strategyBriefPresenter';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

interface BriefDocumentProps {
    brief: BriefOutput;
    llmSummary?: LLMBriefResponse | null;
}

export function BriefDocument({ brief, llmSummary }: BriefDocumentProps) {
    if (brief.briefKind === 'translation_brief' && brief.strategyTranslation) {
        return <StrategyTranslationDocument brief={brief} />;
    }

    if (brief.briefKind === 'gap_memo' && brief.gapMemo) {
        return <StrategyGapDocument brief={brief} />;
    }

    return <InterpretationDocument brief={brief} llmSummary={llmSummary} />;
}

function InterpretationDocument({
    brief,
    llmSummary,
}: {
    brief: BriefOutput;
    llmSummary?: LLMBriefResponse | null;
}) {
    return (
        <div className="space-y-6 print:space-y-4">
            <Section title="A. 원문 피드백">
                <blockquote className="border-l-4 border-gray-300 py-2 pl-4 italic text-gray-700">
                    &ldquo;{brief.originalFeedback}&rdquo;
                </blockquote>
            </Section>

            <Section title="B. 해석 요약">
                <p className="mb-2 leading-relaxed text-gray-800">{brief.clientSummary}</p>
                {brief.clientAntiSummary && (
                    <p className="text-sm text-gray-500">{brief.clientAntiSummary}</p>
                )}
            </Section>

            <Section title="C. 전략 해석">
                <div className="space-y-3">
                    {brief.strategySummary && (
                        <Block label="방향 요약" value={brief.strategySummary} />
                    )}

                    {brief.strategyPositioningContext && (
                        <div className="rounded-lg bg-purple-50 p-3">
                            <p className="mb-1 text-xs font-medium text-purple-600">
                                포지셔닝 맥락
                            </p>
                            <p className="text-sm text-purple-800">
                                {brief.strategyPositioningContext}
                            </p>
                        </div>
                    )}

                    {brief.strategyPersuasionGuide && (
                        <div className="rounded-lg bg-indigo-50 p-3">
                            <p className="mb-1 text-xs font-medium text-indigo-600">
                                설명 포인트
                            </p>
                            <p className="text-sm text-indigo-800">
                                {brief.strategyPersuasionGuide}
                            </p>
                        </div>
                    )}
                </div>
            </Section>

            {brief.primaryBranch && (
                <Section title="D. 디자이너 해석">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                                확정
                            </span>
                            <span className="font-medium text-gray-900">
                                {brief.primaryBranch.branchLabel}
                            </span>
                            <span className="text-xs text-gray-400">
                                ({brief.primaryBranch.branchId})
                            </span>
                        </div>
                        <p className="text-sm text-gray-700">
                            {brief.primaryBranch.descriptionDesigner}
                        </p>

                        {brief.secondaryBranch && (
                            <div className="border-t border-gray-100 pt-2">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                                        참고
                                    </span>
                                    <span className="font-medium text-gray-700">
                                        {brief.secondaryBranch.branchLabel}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-600">
                                    {brief.secondaryBranch.descriptionDesigner}
                                </p>
                            </div>
                        )}

                        {llmSummary?.designerSummary && (
                            <div className="mt-3 rounded-lg bg-blue-50 p-3">
                                <p className="mb-1 text-xs font-medium text-blue-600">AI 해석 근거</p>
                                <p className="text-sm text-blue-800">{llmSummary.designerSummary}</p>
                            </div>
                        )}

                        {brief.interpretationRationale && (
                            <p className="mt-2 whitespace-pre-line text-xs text-gray-500">
                                {brief.interpretationRationale}
                            </p>
                        )}
                    </div>
                </Section>
            )}

            {brief.designTokens && (
                <Section title="E. 조정 힌트">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TokenCard label="컬러" value={brief.designTokens.colorDirection} />
                        <TokenCard label="타이포그래피" value={brief.designTokens.typographyDirection} />
                        <TokenCard label="레이아웃" value={brief.designTokens.layoutDirection} />
                        <TokenCard label="이미지" value={brief.designTokens.imageDirection} />
                        <TokenCard label="텍스처" value={brief.designTokens.textureDirection} />
                    </div>

                    {llmSummary?.adjustmentNotes && (
                        <div className="mt-3 rounded-lg bg-green-50 p-3">
                            <p className="mb-1 text-xs font-medium text-green-600">맥락 반영 메모</p>
                            <p className="text-sm text-green-800">{llmSummary.adjustmentNotes}</p>
                        </div>
                    )}
                </Section>
            )}

            {!!brief.neverDoList?.length && (
                <Section title="F. 피해야 할 것">
                    <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
                        {brief.neverDoList.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>

                    {!!brief.confusionWarnings?.length && (
                        <div className="mt-3 space-y-1">
                            {brief.confusionWarnings.map((warning, index) => (
                                <div
                                    key={`${warning}-${index}`}
                                    className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700"
                                >
                                    {warning}
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {!!brief.references?.length && (
                <Section title="G. 레퍼런스 방향">
                    <div className="space-y-2">
                        <div>
                            <p className="mb-1 text-xs text-gray-500">참고 레퍼런스</p>
                            <div className="flex flex-wrap gap-2">
                                {brief.references.map((reference, index) => (
                                    <span
                                        key={`${reference}-${index}`}
                                        className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                                    >
                                        {reference}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {!!brief.antiReferences?.length && (
                            <div>
                                <p className="mb-1 text-xs text-gray-500">피해야 할 레퍼런스</p>
                                <div className="flex flex-wrap gap-2">
                                    {brief.antiReferences.map((reference, index) => (
                                        <span
                                            key={`${reference}-${index}`}
                                            className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-600 line-through"
                                        >
                                            {reference}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            )}

            {!!brief.decisionTrail?.length && (
                <Section title="H. 선택 흐름">
                    <DecisionTrailSection decisionTrail={brief.decisionTrail} />
                </Section>
            )}
        </div>
    );
}

function StrategyTranslationDocument({ brief }: { brief: BriefOutput }) {
    const model = buildStrategyTranslationDisplayModel(brief);

    if (!model) {
        return null;
    }

    return (
        <div className="space-y-6 print:space-y-4">
            <Section title="A. 전략 입력 원문">
                <blockquote className="border-l-4 border-gray-300 py-2 pl-4 italic text-gray-700">
                    &ldquo;{brief.originalFeedback}&rdquo;
                </blockquote>
            </Section>

            {model.sections.map((section, index) => (
                <Section
                    key={`${section.title}-${index}`}
                    title={formatSectionTitle(index + 1, section.title)}
                >
                    <StrategySectionBody section={section} />
                </Section>
            ))}

            {!!brief.decisionTrail?.length && (
                <Section title={formatSectionTitle(model.sections.length + 1, '선택 흐름')}>
                    <DecisionTrailSection decisionTrail={brief.decisionTrail} />
                </Section>
            )}
        </div>
    );
}

function StrategyGapDocument({ brief }: { brief: BriefOutput }) {
    const model = buildStrategyGapDisplayModel(brief);

    if (!model) {
        return null;
    }

    return (
        <div className="space-y-6 print:space-y-4">
            <Section title="A. 전략 입력 원문">
                <blockquote className="border-l-4 border-gray-300 py-2 pl-4 italic text-gray-700">
                    &ldquo;{brief.originalFeedback}&rdquo;
                </blockquote>
            </Section>

            {model.sections.map((section, index) => (
                <Section
                    key={`${section.title}-${index}`}
                    title={formatSectionTitle(index + 1, section.title)}
                >
                    <StrategySectionBody section={section} />
                </Section>
            ))}

            {!!brief.decisionTrail?.length && (
                <Section title={formatSectionTitle(model.sections.length + 1, '선택 흐름')}>
                    <DecisionTrailSection decisionTrail={brief.decisionTrail} />
                </Section>
            )}
        </div>
    );
}

function StrategySectionBody({
    section,
}: {
    section: {
        description?: string;
        entries: StrategyDisplayEntry[];
    };
}) {
    return (
        <div className="space-y-4">
            {section.description && (
                <p className="leading-relaxed text-gray-800">{section.description}</p>
            )}

            {section.entries.map((entry, index) => (
                <StrategyEntry key={`${entry.label}-${index}`} entry={entry} />
            ))}
        </div>
    );
}

function StrategyEntry({ entry }: { entry: StrategyDisplayEntry }) {
    if (entry.kind === 'text') {
        return <Block label={entry.label} value={entry.value} tone={entry.tone} />;
    }

    return <ListBlock label={entry.label} values={entry.values} tone={entry.tone} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 print:border-gray-400">
            <h3 className="mb-4 border-b border-gray-100 pb-2 text-sm font-bold text-gray-900">
                {title}
            </h3>
            {children}
        </div>
    );
}

function TokenCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-gray-50 p-3">
            <p className="mb-1 text-xs text-gray-500">{label}</p>
            <p className="text-sm text-gray-900">{value}</p>
        </div>
    );
}

function formatSectionTitle(index: number, title: string): string {
    return `${String.fromCharCode(65 + index)}. ${title}`;
}

function getToneStyles(tone: StrategyDisplayTone = 'default') {
    switch (tone) {
        case 'success':
            return {
                label: 'text-emerald-700',
                value: 'text-emerald-900',
                item: 'bg-emerald-50 text-emerald-900',
            };
        case 'warning':
            return {
                label: 'text-amber-700',
                value: 'text-amber-900',
                item: 'bg-amber-50 text-amber-900',
            };
        case 'danger':
            return {
                label: 'text-red-700',
                value: 'text-red-900',
                item: 'bg-red-50 text-red-900',
            };
        case 'muted':
            return {
                label: 'text-slate-500',
                value: 'text-slate-700',
                item: 'bg-slate-50 text-slate-700',
            };
        default:
            return {
                label: 'text-gray-500',
                value: 'text-gray-800',
                item: 'bg-gray-50 text-gray-800',
            };
    }
}

function Block({
    label,
    value,
    tone,
}: {
    label: string;
    value?: string;
    tone?: StrategyDisplayTone;
}) {
    if (!value) return null;
    const styles = getToneStyles(tone);

    return (
        <div>
            <p className={`mb-1 text-xs font-medium ${styles.label}`}>{label}</p>
            <p className={`text-sm leading-relaxed ${styles.value}`}>{value}</p>
        </div>
    );
}

function ListBlock({
    label,
    values,
    tone,
}: {
    label: string;
    values?: string[];
    tone?: StrategyDisplayTone;
}) {
    if (!values || values.length === 0) {
        return null;
    }
    const styles = getToneStyles(tone);

    return (
        <div>
            <p className={`mb-2 text-xs font-medium ${styles.label}`}>{label}</p>
            <ul className="space-y-2 text-sm">
                {values.map((value, index) => (
                    <li key={`${value}-${index}`} className={`rounded-lg px-3 py-2 ${styles.item}`}>
                        {value}
                    </li>
                ))}
            </ul>
        </div>
    );
}
