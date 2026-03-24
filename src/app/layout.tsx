import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Lens',
    description:
        '클라이언트의 피드백과 전략 문장을 디자이너가 바로 판단할 수 있는 방향 언어로 정리해주는 도구입니다.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
