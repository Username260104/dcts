'use client';

import ProgressBar from '@/components/ProgressBar';
import StepContainer from '@/components/StepContainer';
import { useSessionStore } from '@/store/sessionStore';

export default function Home() {
    const error = useSessionStore((s) => s.error);
    const setError = useSessionStore((s) => s.setError);

    return (
        <div className="min-h-screen bg-white">
            {/* 상단 프로그레스 바 */}
            <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10">
                <ProgressBar />
            </header>

            {/* 글로벌 에러 토스트 */}
            {error && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50
                                px-4 py-3 bg-red-50 border border-red-200 rounded-xl shadow-lg
                                flex items-center gap-3 max-w-md">
                    <span className="text-sm text-red-700">{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-600 text-xs"
                    >
                        닫기
                    </button>
                </div>
            )}

            {/* 메인 컨텐츠 */}
            <main className="max-w-2xl mx-auto">
                <StepContainer />
            </main>

            {/* 푸터 */}
            <footer className="text-center py-4 text-xs text-gray-300 print:hidden">
                DCTS v0.1 MVP
            </footer>
        </div>
    );
}
