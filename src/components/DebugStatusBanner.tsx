'use client';

import { getDebugBanner } from '@/lib/debugSource';
import { useSessionStore } from '@/store/sessionStore';

export default function DebugStatusBanner() {
    const step = useSessionStore((state) => state.step);
    const debugState = useSessionStore((state) => state.debugState);

    const debugBanner = (() => {
        switch (step) {
            case 'questions':
                return getDebugBanner('question', debugState.questionSource);
            case 'confirm':
                return getDebugBanner('result', debugState.resultSource);
            case 'brief':
                return getDebugBanner('brief', debugState.briefSource);
            default:
                return null;
        }
    })();

    if (!debugBanner) {
        return null;
    }

    return (
        <div className="bg-white print:hidden">
            <div className="mx-auto w-full max-w-xl px-4 py-3">
                <div className={`rounded-xl px-4 py-3 text-sm ${debugBanner.className}`}>
                    {debugBanner.message}
                </div>
            </div>
        </div>
    );
}
