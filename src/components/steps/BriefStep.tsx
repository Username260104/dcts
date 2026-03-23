'use client';

import { useState } from 'react';
import { BriefDocument } from '@/components/brief/BriefDocument';
import ReturnToStartButton from '@/components/ReturnToStartButton';
import { exportBriefToPdf } from '@/lib/briefExport';
import { useSessionStore } from '@/store/sessionStore';

const BRIEF_CONTENT_ID = 'brief-content';

function getBriefTitle(briefKind: string): string {
    if (briefKind === 'translation_brief') {
        return '전략-디자인 번역 브리프';
    }

    if (briefKind === 'gap_memo') {
        return '전략 정렬 갭 메모';
    }

    return '디자인 커뮤니케이션 브리프';
}

export default function BriefStep() {
    const brief = useSessionStore((state) => state.brief);
    const llmSummary = useSessionStore((state) => state.llmSummary);
    const sessionState = useSessionStore((state) => state.sessionState);
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
            <div className="mb-2">
                <ReturnToStartButton confirmMessage="초기 화면으로 돌아가면 현재 브리프 화면과 세션 결과가 초기화됩니다. 돌아가시겠어요?" />
            </div>

            <div className="mb-8 text-center print:mb-4">
                <h2 className="mb-1 text-xl font-bold text-gray-900">
                    {getBriefTitle(brief.briefKind)}
                </h2>
                <p className="text-xs text-gray-400">
                    생성일 {new Date(brief.generatedAt).toLocaleDateString('ko-KR')}
                </p>
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

            <div id={BRIEF_CONTENT_ID}>
                <BriefDocument brief={brief} llmSummary={llmSummary} />
            </div>

            <div className="mt-8 flex justify-center gap-3 print:hidden">
                <button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                    {isExporting ? 'PDF 생성 중..' : 'PDF 다운로드'}
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
