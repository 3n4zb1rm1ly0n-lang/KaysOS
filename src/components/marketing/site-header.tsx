'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { KaysiaLogo } from '@/components/brand/kaysia-logo';

const NAV = [
    { href: '/#biz', label: 'Biz' },
    { href: '/#isler', label: 'İşler' },
    { href: '/#surec', label: 'Süreç' },
    { href: '/#iletisim', label: 'İletişim' }
];

export function SiteHeader() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const reduce = useReducedMotion();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.header
            className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
                scrolled
                    ? 'border-white/10 bg-[#070A0E]/95'
                    : 'border-white/5 bg-[#070A0E]/90'
            }`}
            initial={reduce ? false : { y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
                <Link href="/" className="shrink-0" aria-label="Kaysia ana sayfa">
                    <KaysiaLogo markClassName="h-7 w-7 md:h-8 md:w-8" />
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

            <AnimatePresence>
                {open && (
                    <motion.div
                        className="overflow-hidden border-t border-white/5 md:hidden"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex flex-col gap-3 px-5 py-4">
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}
