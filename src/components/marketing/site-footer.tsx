import Link from 'next/link';

export function SiteFooter() {
    const year = new Date().getFullYear();
    return (
        <footer className="border-t border-white/5 py-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 md:flex-row md:items-center md:justify-between md:px-8">
                <p className="font-display text-lg text-white">Kaysia</p>
                <p className="text-sm text-[#6B7280]">
                    © {year} Kaysia. Dijital ürünler ve web sistemleri.
                </p>
                <Link
                    href="/login"
                    className="text-xs text-[#4B5563] hover:text-[#9CA3AF]"
                >
                    App
                </Link>
            </div>
        </footer>
    );
}
