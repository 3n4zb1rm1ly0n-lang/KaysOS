import type { Metadata, Viewport } from 'next';
import { Sidebar } from '@/components/panel/sidebar';
import { MobileNav } from '@/components/panel/mobile-nav';
import { FloatingIdeaChat } from '@/components/panel/floating-idea-chat';

export const metadata: Metadata = {
    title: {
        default: 'Kaysia App',
        template: '%s · Kaysia App'
    },
    applicationName: 'Kaysia App',
    manifest: '/manifest-app.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Kaysia App'
    },
    icons: {
        icon: [
            { url: '/icons/icon-app-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-app-512.png', sizes: '512x512', type: 'image/png' }
        ],
        apple: [{ url: '/icons/icon-app-180.png', sizes: '180x180', type: 'image/png' }]
    }
};

export const viewport: Viewport = {
    themeColor: '#0B0F14',
    colorScheme: 'dark',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover'
};

export default function PanelLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-[#0B0F14] text-[#E5E7EB] font-sans flex-col md:flex-row">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 overflow-y-auto text-foreground bg-background">
                {children}
            </main>
            <FloatingIdeaChat />
        </div>
    );
}
