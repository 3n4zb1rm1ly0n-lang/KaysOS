import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';

const syne = Syne({
    subsets: ['latin'],
    variable: '--font-display',
    display: 'swap'
});

const dmSans = DM_Sans({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap'
});

export const metadata: Metadata = {
    title: 'Kaysia',
    description: 'Dijital ürünler ve web sistemleri'
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr">
            <body className={`${syne.variable} ${dmSans.variable} font-sans antialiased`}>
                {children}
            </body>
        </html>
    );
}
