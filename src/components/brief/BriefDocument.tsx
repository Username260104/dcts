'use client';

import { DecisionTrailSection } from '@/components/brief/DecisionTrailSection';
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
    const translation = brief.strategyTranslation;

    if (!translation) {
        return null;
    }

    return (
        <div className="space-y-6 print:space-y-4">
            <Section title="A. 전략 입력 원문">
                <blockquote className="border-l-4 border-gray-300 py-2 pl-4 italic text-gray-700">
                    &ldquo;{brief.originalFeedback}&rdquo;
                </blockquote>
            </Section>

            <Section title="B. Shared Handoff">
                <div className="space-y-4">
                    <Block label="이번 차수 한 줄 과제" value={translation.strategicPremise} />
                    <Block label="핵심 긴장" value={translation.coreTension} />
                    <Block label="Audience + Context" value={translation.audienceAndContext} />
                    <Block label="이번 차수 범위" value={translation.scopeNow} />
                    <div className="grid gap-4 md:grid-cols-2">
                        <ListBlock label="입력에서 직접 확인된 내용" values={translation.confirmedInputs} />
                        <ListBlock label="현재 작업 가정" values={translation.workingAssumptions} />
                        <ListBlock label="지켜야 할 자산" values={translation.equitiesToProtect} />
                        <ListBlock label="더 강하게 보여야 할 인상" values={translation.mustAmplify} />
                        <ListBlock label="피해야 할 방향" values={translation.mustAvoid} />
                        <ListBlock label="필수 반영 요소" values={translation.mandatories} />
                    </div>
                </div>
            </Section>

            <Section title="C. Decision Rules">
                <div className="space-y-4">
                    <ListBlock label="우선순위 기준" values={translation.decisionPriority} />
                    <ListBlock label="트레이드오프" values={translation.tradeOffs} />
                    <ListBlock label="의사결정 프레임" values={translation.decisionFrame} />
                    <ListBlock label="실행 함의" values={translation.creativeImplications} />
                    <ListBlock label="디자인 평가 기준" values={translation.reviewCriteria} />
                    <ListBlock label="디자이너 체크리스트" values={translation.designerChecklist} />
                    <ListBlock label="디자이너와 확인할 질문" values={translation.openQuestionsForDesign} />
                </div>
            </Section>

            <Section title="D. Strategy Rationale">
                <div className="space-y-4">
                    <Block label="Frame of Reference" value={translation.frameOfReference} />
                    <ListBlock label="Points of Parity" values={translation.pointsOfParity} />
                    <ListBlock label="Points of Difference" values={translation.pointsOfDifference} />
                    <Block label="Value Proposition" value={translation.valueProposition} />
                    <ListBlock label="Reasons to Believe" values={translation.reasonsToBelieve} />
                    <ListBlock label="Design Principles" values={translation.principlesForDesign} />
                </div>
            </Section>

            <Section title="E. Direction Mapping">
                <div className="space-y-4">
                    <Block label="전체 범위" value={translation.scope} />
                    <ListBlock label="No-Go" values={translation.noGo} />
                    <ListBlock label="표면별 적용 메모" values={translation.surfaceImplications} />
                    <ListBlock label="Recommended Visual Directions" values={translation.recommendedDirections} />
                    <ListBlock label="Avoided Directions" values={translation.avoidedDirections} />
                    {translation.mappingRationale && (
                        <Block label="Mapping Rationale" value={translation.mappingRationale} />
                    )}
                </div>
            </Section>

            <Section title="F. Open Risks">
                <ListBlock label="Open Risks" values={translation.openRisks} />
            </Section>

            {!!brief.decisionTrail?.length && (
                <Section title="G. Decision Trail">
                    <DecisionTrailSection decisionTrail={brief.decisionTrail} />
                </Section>
            )}
        </div>
    );
}

function StrategyGapDocument({ brief }: { brief: BriefOutput }) {
    const gapMemo = brief.gapMemo;

    if (!gapMemo) {
        return null;
    }

    return (
        <div className="space-y-6 print:space-y-4">
            <Section title="A. 전략 입력 원문">
                <blockquote className="border-l-4 border-gray-300 py-2 pl-4 italic text-gray-700">
                    &ldquo;{brief.originalFeedback}&rdquo;
                </blockquote>
            </Section>

            {!!brief.strategySummary && (
                <Section title="B. 현재까지의 전략 이해">
                    <p className="mb-3 leading-relaxed text-gray-800">{brief.strategySummary}</p>
                    <ListBlock label="Current Understanding" values={gapMemo.currentUnderstanding} />
                </Section>
            )}

            <Section title="C. 아직 비어 있는 기준">
                <ListBlock label="Missing Criteria" values={gapMemo.missingCriteria} />
            </Section>

            {!!gapMemo.weakCriteria.length && (
                <Section title="D. 더 구체화가 필요한 기준">
                    <ListBlock label="Weak Criteria" values={gapMemo.weakCriteria} />
                </Section>
            )}

            {!!gapMemo.priorityGaps.length && (
                <Section title="E. 우선 보강해야 할 순서">
                    <ListBlock label="Priority Gaps" values={gapMemo.priorityGaps} />
                </Section>
            )}

            {!!gapMemo.contradictions.length && (
                <Section title="F. 충돌하는 지시">
                    <ListBlock label="Contradictions" values={gapMemo.contradictions} />
                </Section>
            )}

            <Section title="G. 왜 바로 handoff 하기 어려운가">
                <p className="leading-relaxed text-gray-800">{gapMemo.blockingReason}</p>
            </Section>

            <Section title="H. 다음에 확인할 질문">
                <ListBlock label="Next Questions" values={gapMemo.nextQuestions} />
            </Section>

            {!!brief.decisionTrail?.length && (
                <Section title="I. Decision Trail">
                    <DecisionTrailSection decisionTrail={brief.decisionTrail} />
                </Section>
            )}
        </div>
    );
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

function Block({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
            <p className="text-sm leading-relaxed text-gray-800">{value}</p>
        </div>
    );
}

function ListBlock({ label, values }: { label: string; values: string[] }) {
    if (values.length === 0) {
        return null;
    }

    return (
        <div>
            <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
            <ul className="space-y-2 text-sm text-gray-800">
                {values.map((value, index) => (
                    <li key={`${value}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2">
                        {value}
                    </li>
                ))}
            </ul>
        </div>
    );
}
