import type { Metadata, Viewport } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import { PwaRegister } from '@/components/pwa-register';
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
    description: 'Dijital ürünler ve web sistemleri',
    applicationName: 'Kaysia',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Kaysia'
    },
    icons: {
        icon: [
            { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ],
        apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }]
    },
    formatDetection: {
        telephone: false
    }
};

export const viewport: Viewport = {
    themeColor: '#070A0E',
    colorScheme: 'dark',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover'
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
                <PwaRegister />
            </body>
        </html>
    );
}
