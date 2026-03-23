'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BriefDocument } from '@/components/brief/BriefDocument';
import { exportBriefToPdf } from '@/lib/briefExport';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

const BRIEF_CONTENT_ID = 'brief-permalink-content';

function getBriefTitle(briefKind: string): string {
    if (briefKind === 'translation_brief') {
        return '전략-디자인 번역 브리프';
    }

    if (briefKind === 'gap_memo') {
        return '전략 정렬 갭 메모';
    }

    return '디자인 커뮤니케이션 브리프';
}

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
                        {error || '세션이 만료됐거나 브리프가 저장되지 않았습니다.'}
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
                        {getBriefTitle(brief.briefKind)}
                    </h2>
                    <p className="text-xs text-gray-400">
                        생성일 {new Date(brief.generatedAt).toLocaleDateString('ko-KR')}
                    </p>
                </div>

                <div id={BRIEF_CONTENT_ID}>
                    <BriefDocument brief={brief} llmSummary={llmSummary} />
                </div>

                <div className="mt-8 flex justify-center print:hidden">
                    <button
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                        {isExporting ? 'PDF 생성 중..' : 'PDF 다운로드'}
                    </button>
                </div>
            </main>
        </div>
    );
}
