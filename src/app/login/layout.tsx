import type { Metadata, Viewport } from 'next';

/** Login, App PWA ile aynı manifest — kurulum / yönlendirme tutarlı olsun. */
export const metadata: Metadata = {
    title: 'Giriş · Kaysia App',
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

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
