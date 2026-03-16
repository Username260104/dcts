'use client';

import { useState } from 'react';
import { DecisionTrailSection } from '@/components/brief/DecisionTrailSection';
import { exportBriefToPdf } from '@/lib/briefExport';
import { useSessionStore } from '@/store/sessionStore';

const BRIEF_CONTENT_ID = 'brief-content';

export default function BriefStep() {
    const brief = useSessionStore((state) => state.brief);
    const llmSummary = useSessionStore((state) => state.llmSummary);
    const sessionState = useSessionStore((state) => state.sessionState);
    const usedFallback = useSessionStore((state) => state.usedFallback);
    const reset = useSessionStore((state) => state.reset);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    if (!brief || !sessionState) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <p className="text-gray-400">브리프를 생성하고 있습니다.</p>
            </div>
        );
    }

    const shareUrl = typeof window === 'undefined'
        ? ''
        : `${window.location.origin}/brief/${sessionState.sessionId}`;

    const handleCopyLink = async () => {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareMessage('공유 링크를 복사했습니다.');
        } catch {
            setShareMessage('링크 복사에 실패했습니다.');
        }
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        setShareMessage(null);

        try {
            await exportBriefToPdf(BRIEF_CONTENT_ID, `dcts-brief-${sessionState.sessionId}.pdf`);
        } catch (error) {
            setShareMessage(
                error instanceof Error ? error.message : 'PDF 생성에 실패했습니다.'
            );
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl px-4 py-8">
            <div className="mb-8 text-center print:mb-4">
                <h2 className="mb-1 text-xl font-bold text-gray-900">
                    디자이너 커뮤니케이션 브리프
                </h2>
                <p className="text-xs text-gray-400">
                    생성일 {new Date(brief.generatedAt).toLocaleDateString('ko-KR')}
                </p>
            </div>

            <div
                className={`mb-4 rounded-2xl border p-4 text-sm print:hidden ${
                    usedFallback
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
            >
                {usedFallback
                    ? '이번 세션은 중간에 LLM fallback이 발생해 일부 또는 전체가 정적 엔진 기준으로 생성되었습니다.'
                    : '이번 세션은 LLM 해석 기준으로 생성되었습니다.'}
            </div>

            <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 print:hidden">
                <p className="mb-2 text-xs font-medium text-gray-500">공유 링크</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                        readOnly
                        value={shareUrl}
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                    />
                    <button
                        onClick={handleCopyLink}
                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-all hover:bg-white"
                    >
                        링크 복사
                    </button>
                </div>
                {shareMessage && (
                    <p className="mt-2 text-xs text-gray-500">{shareMessage}</p>
                )}
            </div>

            <div className="space-y-6 print:space-y-4" id={BRIEF_CONTENT_ID}>
                <Section title="A. 원문 피드백">
                    <blockquote className="border-l-4 border-gray-300 py-2 pl-4 italic text-gray-700">
                        &ldquo;{brief.originalFeedback}&rdquo;
                    </blockquote>
                </Section>

                <Section title="B. 해석 요약 (클라이언트 확인용)">
                    <p className="mb-2 leading-relaxed text-gray-800">{brief.clientSummary}</p>
                    {brief.clientAntiSummary && (
                        <p className="text-sm text-gray-500">{brief.clientAntiSummary}</p>
                    )}
                </Section>

                <Section title="C. 해석 요약 (디자이너용)">
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

                <Section title="D. 디자인 조정 힌트">
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

                <Section title="E. 하지 말아야 할 것">
                    <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
                        {brief.neverDoList.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>

                    {brief.confusionWarnings.length > 0 && (
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

                <Section title="F. 레퍼런스 방향">
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

                        {brief.antiReferences.length > 0 && (
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

                <Section title="G. 선택 흐름 설명">
                    <DecisionTrailSection decisionTrail={brief.decisionTrail ?? []} />
                </Section>
            </div>

            <div className="mt-8 flex justify-center gap-3 print:hidden">
                <button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                    {isExporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
                </button>
                <button
                    onClick={() => reset()}
                    className="rounded-xl bg-gray-900 px-8 py-3 text-base font-medium text-white transition-all hover:bg-gray-800"
                >
                    새 세션 시작
                </button>
            </div>
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
