'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Menu,
    X,
    Settings,
    LogOut,
    LayoutDashboard,
    FolderKanban,
    Calendar,
    Landmark,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { FINANCE_NAV_ITEMS } from './sidebar';

function pathActive(pathname: string, href: string): boolean {
    if (pathname === href) return true;
    if (href === '/dashboard') return false;
    return pathname.startsWith(href + '/');
}

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const financeSectionActive = FINANCE_NAV_ITEMS.some((item) => pathActive(pathname, item.href));
    const [financeOpen, setFinanceOpen] = useState(financeSectionActive);

    useEffect(() => {
        if (financeSectionActive) setFinanceOpen(true);
    }, [financeSectionActive]);

    const close = () => setIsOpen(false);

    const itemClass = (href: string) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            pathActive(pathname, href)
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary/50'
        }`;

    return (
        <div className="md:hidden sticky top-0 z-40 bg-background border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
                    aria-label="Menüyü aç"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg">KaysiOS</span>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={close}
                        aria-hidden
                    />

                    <div className="relative w-[300px] h-full bg-background border-r p-6 flex flex-col animate-in slide-in-from-left duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">KaysiOS</h2>
                            <button
                                onClick={close}
                                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
                                aria-label="Menüyü kapat"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto space-y-1">
                            <Link href="/dashboard" onClick={close} className={itemClass('/dashboard')}>
                                <LayoutDashboard className="w-5 h-5 shrink-0" />
                                <span>Dashboard</span>
                            </Link>

                            <Link
                                href="/dashboard/projects"
                                onClick={close}
                                className={itemClass('/dashboard/projects')}
                            >
                                <FolderKanban className="w-5 h-5 shrink-0" />
                                <span>Projeler</span>
                            </Link>

                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => setFinanceOpen((o) => !o)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-left text-muted-foreground hover:bg-secondary/50"
                                >
                                    <Landmark className="w-5 h-5 shrink-0" />
                                    <span className="flex-1">Finans</span>
                                    {financeOpen ? (
                                        <ChevronDown className="w-4 h-4 opacity-70" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 opacity-70" />
                                    )}
                                </button>
                                {financeOpen && (
                                    <div className="mt-1 ml-2 pl-3 border-l border-border/80 space-y-0.5">
                                        {FINANCE_NAV_ITEMS.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                onClick={close}
                                                className={`${itemClass(item.href)} py-2 pl-1`}
                                            >
                                                <item.icon className="w-4 h-4 shrink-0 opacity-80" />
                                                <span>{item.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Link
                                href="/dashboard/calendar"
                                onClick={close}
                                className={itemClass('/dashboard/calendar')}
                            >
                                <Calendar className="w-5 h-5 shrink-0" />
                                <span>Takvim</span>
                            </Link>
                        </nav>

                        <div className="pt-6 border-t mt-auto space-y-2">
                            <Link
                                href="/dashboard/settings"
                                onClick={close}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-secondary/50 text-muted-foreground"
                            >
                                <Settings className="w-5 h-5" />
                                <span>Ayarlar</span>
                            </Link>
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
                                <LogOut className="w-5 h-5" />
                                <span>Çıkış Yap</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
