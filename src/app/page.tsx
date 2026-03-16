'use client';

import ProgressBar from '@/components/ProgressBar';
import StepContainer from '@/components/StepContainer';
import { useSessionStore } from '@/store/sessionStore';

export default function Home() {
    const error = useSessionStore((state) => state.error);
    const setError = useSessionStore((state) => state.setError);

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
                <ProgressBar />
            </header>

            {error && (
                <div className="fixed left-1/2 top-16 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
                    <span className="text-sm text-red-700">{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="text-xs text-red-400 hover:text-red-600"
                    >
                        {'\ub2eb\uae30'}
                    </button>
                </div>
            )}

            <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
                <StepContainer />
            </main>

            <footer className="py-4 text-center text-xs text-gray-300 print:hidden">
                DCTS v0.1 MVP
            </footer>
        </div>
    );
}
