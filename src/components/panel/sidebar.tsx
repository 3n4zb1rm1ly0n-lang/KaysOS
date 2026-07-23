'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Settings,
    TrendingDown,
    TrendingUp,
    CreditCard,
    LogOut,
    Calendar,
    Receipt,
    Wallet,
    FileText,
    PieChart,
    FolderKanban,
    Globe,
    Landmark,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavLinkItem {
    id: string;
    label: string;
    href: string;
    icon: LucideIcon;
}

/** Finans grubu — Projeler’in hemen altında gösterilir */
export const FINANCE_NAV_ITEMS: NavLinkItem[] = [
    { id: 'fin-incomes', label: 'Gelirler', href: '/app/dashboard/incomes', icon: TrendingUp },
    { id: 'fin-expenses', label: 'Gider', href: '/app/dashboard/expenses', icon: TrendingDown },
    { id: 'fin-debts', label: 'Borçlar', href: '/app/dashboard/debts', icon: CreditCard },
    { id: 'fin-invoices', label: 'Faturalar', href: '/app/dashboard/invoices', icon: Receipt },
    { id: 'fin-reports', label: 'Muhasebe', href: '/app/dashboard/reports', icon: FileText },
    { id: 'fin-savings', label: 'Birikim', href: '/app/dashboard/savings', icon: Wallet },
    { id: 'fin-budget', label: 'Bütçe plan', href: '/app/dashboard/budget', icon: PieChart }
];

function pathActive(pathname: string, href: string): boolean {
    if (pathname === href) return true;
    if (href === '/app/dashboard') return false;
    return pathname.startsWith(href + '/');
}

export function Sidebar() {
    const pathname = usePathname();
    const financeSectionActive = FINANCE_NAV_ITEMS.some((item) => pathActive(pathname, item.href));
    const [financeOpen, setFinanceOpen] = useState(financeSectionActive);

    useEffect(() => {
        if (financeSectionActive) setFinanceOpen(true);
    }, [financeSectionActive]);

    const linkClass = (href: string) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            pathActive(pathname, href)
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        }`;

    return (
        <aside className="hidden md:flex w-64 border-r h-full bg-background flex-col fixed left-0 top-0 overflow-y-auto z-50">
            <div className="p-6 border-b">
                <h1 className="text-xl font-bold text-white">Kaysia</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">App</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                <Link href="/app/dashboard" className={linkClass('/app/dashboard')}>
                    <LayoutDashboard className="w-5 h-5 shrink-0" />
                    <span>Dashboard</span>
                </Link>

                <Link href="/app/dashboard/projects" className={linkClass('/app/dashboard/projects')}>
                    <FolderKanban className="w-5 h-5 shrink-0" />
                    <span>Projeler</span>
                </Link>

                <Link href="/app/dashboard/domains" className={linkClass('/app/dashboard/domains')}>
                    <Globe className="w-5 h-5 shrink-0" />
                    <span>Domainler</span>
                </Link>

                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setFinanceOpen((o) => !o)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                            financeSectionActive && !financeOpen
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                        }`}
                        aria-expanded={financeOpen}
                    >
                        <Landmark className="w-5 h-5 shrink-0" />
                        <span className="flex-1">Finans</span>
                        {financeOpen ? (
                            <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                        ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                        )}
                    </button>

                    {financeOpen && (
                        <div className="mt-1 ml-2 pl-3 border-l border-border/80 space-y-0.5">
                            {FINANCE_NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    className={`${linkClass(item.href)} py-2 pl-1`}
                                >
                                    <item.icon className="w-4 h-4 shrink-0 opacity-80" />
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <Link href="/app/dashboard/calendar" className={linkClass('/app/dashboard/calendar')}>
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span>Takvim</span>
                </Link>
            </nav>

            <div className="p-4 border-t mt-auto">
                <Link
                    href="/app/dashboard/settings"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-secondary/50 transition-colors mb-2 text-muted-foreground hover:text-foreground"
                >
                    <Settings className="w-5 h-5" />
                    <span>Ayarlar</span>
                </Link>
                <button
                    type="button"
                    onClick={() => {
                        document.cookie = 'auth=; path=/; max-age=0';
                        window.location.href = '/';
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Çıkış Yap</span>
                </button>
            </div>
        </aside>
    );
}
