import type { Metadata } from 'next';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
    title: {
        default: 'Kaysia — Dijital ürünler ve web sistemleri',
        template: '%s · Kaysia'
    },
    description:
        'Kaysia; web ürünleri, paneller ve dijital sistemler tasarlayan bir ajans stüdyosudur.',
    applicationName: 'Kaysia',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Kaysia'
    }
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="marketing-root min-h-screen flex flex-col bg-[#070A0E] text-[#E8EAED]">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
        </div>
    );
}
