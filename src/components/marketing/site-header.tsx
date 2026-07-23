'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV = [
    { href: '/#biz', label: 'Biz' },
    { href: '/#isler', label: 'İşler' },
    { href: '/#surec', label: 'Süreç' },
    { href: '/#iletisim', label: 'İletişim' }
];

export function SiteHeader() {
    const [open, setOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#070A0E]/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
                <Link
                    href="/"
                    className="font-display text-xl tracking-tight text-white md:text-2xl"
                >
                    Kaysia
                </Link>

                <nav className="hidden items-center gap-8 md:flex">
                    {NAV.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="text-sm text-[#9CA3AF] transition-colors hover:text-white"
                        >
                            {item.label}
                        </a>
                    ))}
                    <Link
                        href="/login"
                        className="text-xs text-[#6B7280] transition-colors hover:text-[#9CA3AF]"
                    >
                        App
                    </Link>
                </nav>

                <button
                    type="button"
                    className="md:hidden p-2 text-[#9CA3AF]"
                    aria-label="Menü"
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {open && (
                <div className="border-t border-white/5 px-5 py-4 md:hidden">
                    <div className="flex flex-col gap-3">
                        {NAV.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="text-sm text-[#E8EAED]"
                            >
                                {item.label}
                            </a>
                        ))}
                        <Link
                            href="/login"
                            onClick={() => setOpen(false)}
                            className="text-sm text-[#6B7280]"
                        >
                            App girişi
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
