import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'DCTS - Design Communication Translation System',
    description: '디자인 커뮤니케이션 브리프를 만드는 웹앱',
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
