'use client';

import { useSessionStore } from '@/store/sessionStore';

interface ReturnToStartButtonProps {
    confirmMessage?: string;
    className?: string;
}

export default function ReturnToStartButton({
    confirmMessage,
    className = '',
}: ReturnToStartButtonProps) {
    const returnToStart = useSessionStore((state) => state.returnToStart);

    const handleClick = () => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
            return;
        }

        returnToStart();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`inline-flex items-center gap-2 text-sm text-gray-400 transition-all hover:text-gray-600 ${className}`}
        >
            <span aria-hidden="true">&larr;</span>
            <span>초기 화면으로 돌아가기</span>
        </button>
    );
}
