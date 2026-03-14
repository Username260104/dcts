'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

// 브리프 퍼머링크 페이지 (독립 조회용)
export default function BriefPermalinkPage() {
    const { id } = useParams<{ id: string }>();
    const [brief, setBrief] = useState<BriefOutput | null>(null);
    const [llmSummary, setLlmSummary] = useState<LLMBriefResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        fetch(`/api/brief/${id}`)
            .then(async (res) => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '브리프를 불러올 수 없습니다.');
                }
                return res.json();
            })
            .then((data) => {
                setBrief(data.brief);
                setLlmSummary(data.llmSummary);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : '알 수 없는 오류');
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-500">
                    <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span>브리프를 불러오고 있어요...</span>
                </div>
            </div>
        );
    }

    if (error || !brief) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">브리프를 찾을 수 없습니다</h1>
                    <p className="text-sm text-gray-500 mb-4">{error || '세션이 만료되었을 수 있습니다.'}</p>
                    <Link href="/" className="text-blue-600 hover:underline text-sm">새 세션 시작하기</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <header className="border-b border-gray-100 py-3 px-4">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <h1 className="text-sm font-bold text-gray-900">DCTS 브리프</h1>
                    <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">새 세션</Link>
                </div>
            </header>

            <main className="px-4 py-8 max-w-2xl mx-auto">
                <div className="text-center mb-8 print:mb-4">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">디자인 커뮤니케이션 브리프</h2>
                    <p className="text-xs text-gray-400">
                        생성일: {new Date(brief.generatedAt).toLocaleDateString('ko-KR')}
                    </p>
                </div>

                <div className="space-y-6 print:space-y-4">
                    {/* A. 원문 피드백 */}
                    <Section title="A. 원문 피드백">
                        <blockquote className="border-l-4 border-gray-300 pl-4 py-2 italic text-gray-700">
                            &ldquo;{brief.originalFeedback}&rdquo;
                        </blockquote>
                    </Section>

                    {/* B. 해석 요약 */}
                    <Section title="B. 해석 요약 (클라이언트 확인용)">
                        <p className="text-gray-800 leading-relaxed mb-2">{brief.clientSummary}</p>
                        {brief.clientAntiSummary && (
                            <p className="text-gray-500 text-sm">{brief.clientAntiSummary}</p>
                        )}
                    </Section>

                    {/* C. 디자이너용 */}
                    <Section title="C. 해석 요약 (디자이너용)">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">확정</span>
                                <span className="font-medium text-gray-900">{brief.primaryBranch.branchLabel}</span>
                                <span className="text-xs text-gray-400">({brief.primaryBranch.branchId})</span>
                            </div>
                            <p className="text-sm text-gray-700">{brief.primaryBranch.descriptionDesigner}</p>

                            {brief.secondaryBranch && (
                                <div className="pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">참조</span>
                                        <span className="font-medium text-gray-700">{brief.secondaryBranch.branchLabel}</span>
                                    </div>
                                </div>
                            )}

                            {llmSummary?.designerSummary && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-xs text-blue-600 font-medium mb-1">AI 해석 근거</p>
                                    <p className="text-sm text-blue-800">{llmSummary.designerSummary}</p>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* D. 조정 포인트 */}
                    <Section title="D. 핵심 조정 포인트">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <TokenCard label="컬러" value={brief.designTokens.colorDirection} />
                            <TokenCard label="서체" value={brief.designTokens.typographyDirection} />
                            <TokenCard label="레이아웃" value={brief.designTokens.layoutDirection} />
                            <TokenCard label="이미지" value={brief.designTokens.imageDirection} />
                            <TokenCard label="질감/텍스처" value={brief.designTokens.textureDirection} />
                        </div>
                    </Section>

                    {/* E. 절대 하지 말 것 */}
                    <Section title="E. 절대 하지 말 것">
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                            {brief.neverDoList.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                        {brief.confusionWarnings.length > 0 && (
                            <div className="mt-3 space-y-1">
                                {brief.confusionWarnings.map((w, i) => (
                                    <div key={i} className="px-3 py-2 bg-amber-50 rounded-lg text-sm text-amber-700">
                                        {w}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* F. 레퍼런스 */}
                    <Section title="F. 레퍼런스">
                        <div className="flex flex-wrap gap-2">
                            {brief.references.map((ref, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                                    {ref}
                                </span>
                            ))}
                        </div>
                        {brief.antiReferences.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-1">안티 레퍼런스</p>
                                <div className="flex flex-wrap gap-2">
                                    {brief.antiReferences.map((ref, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-50 rounded-full text-sm text-red-600 line-through">
                                            {ref}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>
                </div>

                {/* 인쇄 버튼 */}
                <div className="flex justify-center mt-8 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all text-sm"
                    >
                        PDF 저장
                    </button>
                </div>
            </main>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 print:border-gray-400">
            <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">{title}</h3>
            {children}
        </div>
    );
}

function TokenCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm text-gray-900">{value}</p>
        </div>
    );
}
