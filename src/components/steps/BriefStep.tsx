'use client';

import { useSessionStore } from '@/store/sessionStore';

export default function BriefStep() {
    const brief = useSessionStore((s) => s.brief);
    const llmSummary = useSessionStore((s) => s.llmSummary);
    const reset = useSessionStore((s) => s.reset);

    if (!brief) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-400">브리프를 생성하고 있어요...</p>
            </div>
        );
    }

    const handleNewSession = () => {
        reset();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="px-4 py-8 max-w-2xl mx-auto">
            {/* 헤더 */}
            <div className="text-center mb-8 print:mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-1">디자인 커뮤니케이션 브리프</h2>
                <p className="text-xs text-gray-400">
                    생성일: {new Date(brief.generatedAt).toLocaleDateString('ko-KR')}
                </p>
            </div>

            <div className="space-y-6 print:space-y-4" id="brief-content">
                {/* A. 원문 피드백 */}
                <Section title="A. 원문 피드백">
                    <blockquote className="border-l-4 border-gray-300 pl-4 py-2 italic text-gray-700">
                        &ldquo;{brief.originalFeedback}&rdquo;
                    </blockquote>
                </Section>

                {/* B. 클라이언트 확인용 해석 */}
                <Section title="B. 해석 요약 (클라이언트 확인용)">
                    <p className="text-gray-800 leading-relaxed mb-2">{brief.clientSummary}</p>
                    {brief.clientAntiSummary && (
                        <p className="text-gray-500 text-sm">{brief.clientAntiSummary}</p>
                    )}
                </Section>

                {/* C. 디자이너용 해석 */}
                <Section title="C. 해석 요약 (디자이너용)">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
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
                            <div className="pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                        참조
                                    </span>
                                    <span className="font-medium text-gray-700">
                                        {brief.secondaryBranch.branchLabel}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    {brief.secondaryBranch.descriptionDesigner}
                                </p>
                            </div>
                        )}

                        {/* LLM 디자이너 요약 */}
                        {llmSummary?.designerSummary && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-600 font-medium mb-1">AI 해석 근거</p>
                                <p className="text-sm text-blue-800">{llmSummary.designerSummary}</p>
                            </div>
                        )}

                        {brief.interpretationRationale && (
                            <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">
                                {brief.interpretationRationale}
                            </p>
                        )}
                    </div>
                </Section>

                {/* D. 핵심 조정 포인트 */}
                <Section title="D. 핵심 조정 포인트">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <TokenCard label="컬러" value={brief.designTokens.colorDirection} />
                        <TokenCard label="서체" value={brief.designTokens.typographyDirection} />
                        <TokenCard label="레이아웃" value={brief.designTokens.layoutDirection} />
                        <TokenCard label="이미지" value={brief.designTokens.imageDirection} />
                        <TokenCard label="질감/텍스처" value={brief.designTokens.textureDirection} />
                    </div>

                    {/* LLM 조정 노트 */}
                    {llmSummary?.adjustmentNotes && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-green-600 font-medium mb-1">맥락 반영 조정</p>
                            <p className="text-sm text-green-800">{llmSummary.adjustmentNotes}</p>
                        </div>
                    )}
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
                    <div className="space-y-2">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">참고 레퍼런스</p>
                            <div className="flex flex-wrap gap-2">
                                {brief.references.map((ref, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                                    >
                                        {ref}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {brief.antiReferences.length > 0 && (
                            <div>
                                <p className="text-xs text-gray-500 mb-1">안티 레퍼런스 (이 방향 아님)</p>
                                <div className="flex flex-wrap gap-2">
                                    {brief.antiReferences.map((ref, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-red-50 rounded-full text-sm text-red-600 line-through"
                                        >
                                            {ref}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-3 mt-8 justify-center print:hidden">
                <button
                    onClick={handlePrint}
                    className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl
                               hover:bg-gray-50 transition-all text-sm"
                >
                    PDF 저장
                </button>
                <button
                    onClick={handleNewSession}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl text-base font-medium
                               hover:bg-gray-800 transition-all"
                >
                    새 세션 시작
                </button>
            </div>
        </div>
    );
}

// 섹션 래퍼 컴포넌트
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 print:border-gray-400">
            <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                {title}
            </h3>
            {children}
        </div>
    );
}

// 토큰 카드 컴포넌트
function TokenCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm text-gray-900">{value}</p>
        </div>
    );
}
