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
    Globe,
    Calendar,
    Building2,
    Blocks,
    ChevronDown,
    ChevronRight,
    Mail
} from 'lucide-react';
import { COMPANY_FINANCE_NAV_ITEMS } from './sidebar';
import { KaysiaLogo } from '@/components/brand/kaysia-logo';
import { UnreadBadge, useUnreadContactCount } from '@/hooks/use-unread-contact-count';

function pathActive(pathname: string, href: string): boolean {
    if (pathname === href) return true;
    if (href === '/app/dashboard') return false;
    return pathname.startsWith(href + '/');
}

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { count: unreadMessages } = useUnreadContactCount();
    const companyFinanceActive = COMPANY_FINANCE_NAV_ITEMS.some((item) =>
        pathActive(pathname, item.href)
    );
    const [companyFinanceOpen, setCompanyFinanceOpen] = useState(companyFinanceActive);

    useEffect(() => {
        if (companyFinanceActive) setCompanyFinanceOpen(true);
    }, [companyFinanceActive]);

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
                <span className="inline-flex items-center">
                    <KaysiaLogo markClassName="h-6 w-6" wordmarkClassName="text-base tracking-[0.2em]" />
                </span>
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
                            <KaysiaLogo markClassName="h-7 w-7" wordmarkClassName="text-lg tracking-[0.2em]" />
                            <button
                                onClick={close}
                                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
                                aria-label="Menüyü kapat"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto space-y-1">
                            <Link href="/app/dashboard" onClick={close} className={itemClass('/app/dashboard')}>
                                <LayoutDashboard className="w-5 h-5 shrink-0" />
                                <span>Dashboard</span>
                            </Link>

                            <Link
                                href="/app/dashboard/messages"
                                onClick={close}
                                className={itemClass('/app/dashboard/messages')}
                            >
                                <Mail className="w-5 h-5 shrink-0" />
                                <span>Mesajlar</span>
                                <UnreadBadge count={unreadMessages} />
                            </Link>

                            <Link
                                href="/app/dashboard/projects"
                                onClick={close}
                                className={itemClass('/app/dashboard/projects')}
                            >
                                <FolderKanban className="w-5 h-5 shrink-0" />
                                <span>Projeler</span>
                            </Link>

                            <Link
                                href="/app/dashboard/domains"
                                onClick={close}
                                className={itemClass('/app/dashboard/domains')}
                            >
                                <Globe className="w-5 h-5 shrink-0" />
                                <span>Domainler</span>
                            </Link>

                            <Link
                                href="/app/dashboard/ecosystem"
                                onClick={close}
                                className={itemClass('/app/dashboard/ecosystem')}
                            >
                                <Blocks className="w-5 h-5 shrink-0" />
                                <span>Ekosistem</span>
                            </Link>

                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => setCompanyFinanceOpen((o) => !o)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg text-left text-muted-foreground hover:bg-secondary/50"
                                >
                                    <Building2 className="w-5 h-5 shrink-0" />
                                    <span className="flex-1">Şirket Finans</span>
                                    {companyFinanceOpen ? (
                                        <ChevronDown className="w-4 h-4 opacity-70" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 opacity-70" />
                                    )}
                                </button>
                                {companyFinanceOpen && (
                                    <div className="mt-1 ml-2 pl-3 border-l border-border/80 space-y-0.5">
                                        {COMPANY_FINANCE_NAV_ITEMS.map((item) => (
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
                                href="/app/dashboard/calendar"
                                onClick={close}
                                className={itemClass('/app/dashboard/calendar')}
                            >
                                <Calendar className="w-5 h-5 shrink-0" />
                                <span>Takvim</span>
                            </Link>
                        </nav>

                        <div className="pt-6 border-t mt-auto space-y-2">
                            <Link
                                href="/app/dashboard/settings"
                                onClick={close}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-secondary/50 text-muted-foreground"
                            >
                                <Settings className="w-5 h-5" />
                                <span>Ayarlar</span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    void import('@/lib/auth-client').then((m) =>
                                        m.signOutAndRedirect('/')
                                    );
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
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
