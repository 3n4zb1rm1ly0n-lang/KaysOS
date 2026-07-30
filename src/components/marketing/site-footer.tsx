import Link from 'next/link';
import { KaysiaLogo } from '@/components/brand/kaysia-logo';

export function SiteFooter() {
    const year = new Date().getFullYear();
    return (
        <footer className="border-t border-white/5 py-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 md:flex-row md:items-center md:justify-between md:px-8">
                <Link href="/" aria-label="Kaysia ana sayfa">
                    <KaysiaLogo markClassName="h-6 w-6" wordmarkClassName="text-base md:text-lg" />
                </Link>
                <p className="text-sm text-[#6B7280]">
                    © {year} Kaysia. Dijital ürünler ve web sistemleri.
                </p>
            </div>
        </footer>
    );
}
