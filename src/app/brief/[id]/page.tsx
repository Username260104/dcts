'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DecisionTrailSection } from '@/components/brief/DecisionTrailSection';
import { exportBriefToPdf } from '@/lib/briefExport';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

const BRIEF_CONTENT_ID = 'brief-permalink-content';

export default function BriefPermalinkPage() {
    const { id } = useParams<{ id: string }>();
    const [brief, setBrief] = useState<BriefOutput | null>(null);
    const [llmSummary, setLlmSummary] = useState<LLMBriefResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!id) return;

        fetch(`/api/brief/${id}`)
            .then(async (response) => {
                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(errorBody.error || '브리프를 불러오지 못했습니다.');
                }

                return response.json();
            })
            .then((data) => {
                setBrief(data.brief);
                setLlmSummary(data.llmSummary);
            })
            .catch((fetchError) => {
                setError(fetchError instanceof Error ? fetchError.message : '알 수 없는 오류가 발생했습니다.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleExportPdf = async () => {
        if (!id) return;

        setIsExporting(true);

        try {
            await exportBriefToPdf(BRIEF_CONTENT_ID, `dcts-brief-${id}.pdf`);
        } catch (exportError) {
            setError(exportError instanceof Error ? exportError.message : 'PDF 생성에 실패했습니다.');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex items-center gap-2 text-gray-500">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    <span>브리프를 불러오고 있습니다.</span>
                </div>
            </div>
        );
    }

    if (error || !brief) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-2 text-xl font-bold text-gray-900">브리프를 찾을 수 없습니다.</h1>
                    <p className="mb-4 text-sm text-gray-500">
                        {error || '세션이 만료되었거나 브리프가 저장되지 않았습니다.'}
                    </p>
                    <Link href="/" className="text-sm text-blue-600 hover:underline">
                        새 세션 시작하기
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <header className="border-b border-gray-100 px-4 py-3">
                <div className="mx-auto flex max-w-2xl items-center justify-between">
                    <h1 className="text-sm font-bold text-gray-900">DCTS 브리프</h1>
                    <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
                        새 세션
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 py-8">
                <div className="mb-8 text-center print:mb-4">
                    <h2 className="mb-1 text-xl font-bold text-gray-900">
                        디자인 커뮤니케이션 브리프
                    </h2>
                    <p className="text-xs text-gray-400">
                        생성일 {new Date(brief.generatedAt).toLocaleDateString('ko-KR')}
                    </p>
                </div>

                <div className="space-y-6 print:space-y-4" id={BRIEF_CONTENT_ID}>
                    <Section title="A. 원문 피드백">
                        <blockquote className="border-l-4 border-gray-300 pl-4 py-2 italic text-gray-700">
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
                            <p className="text-sm text-gray-700">{brief.primaryBranch.descriptionDesigner}</p>

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
                                </div>
                            )}

                            {llmSummary?.designerSummary && (
                                <div className="mt-3 rounded-lg bg-blue-50 p-3">
                                    <p className="mb-1 text-xs font-medium text-blue-600">AI 해석 근거</p>
                                    <p className="text-sm text-blue-800">{llmSummary.designerSummary}</p>
                                </div>
                            )}
                        </div>
                    </Section>

                    <Section title="D. 디자인 조정 사인">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <TokenCard label="컬러" value={brief.designTokens.colorDirection} />
                            <TokenCard label="타이포그래피" value={brief.designTokens.typographyDirection} />
                            <TokenCard label="레이아웃" value={brief.designTokens.layoutDirection} />
                            <TokenCard label="이미지" value={brief.designTokens.imageDirection} />
                            <TokenCard label="텍스처" value={brief.designTokens.textureDirection} />
                        </div>
                    </Section>

                    <Section title="E. 하지 말아야 할 것">
                        <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
                            {brief.neverDoList.map((item, index) => (
                                <li key={`${item}-${index}`}>{item}</li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="F. 레퍼런스 방향">
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

                        {brief.antiReferences.length > 0 && (
                            <div className="mt-3">
                                <p className="mb-1 text-xs text-gray-500">안티 레퍼런스</p>
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
                    </Section>

                    <Section title="G. 선택 흐름 설명">
                        <DecisionTrailSection decisionTrail={brief.decisionTrail ?? []} />
                    </Section>
                </div>

                <div className="mt-8 flex justify-center print:hidden">
                    <button
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                        {isExporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
                    </button>
                </div>
            </main>
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
