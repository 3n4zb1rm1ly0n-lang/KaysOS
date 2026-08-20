'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Settings,
    LogOut,
    Calendar,
    FolderKanban,
    Globe,
    Building2,
    Calculator,
    Blocks,
    ChevronDown,
    ChevronRight,
    Wallet,
    Mail,
    Package,
    Shield,
    Fuel,
    Landmark,
    FileText,
    UserRound,
    WalletCards,
    CreditCard,
    Scale,
    Coins,
    Bot,
    PieChart,
    PiggyBank,
    History
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KaysiaLogo } from '@/components/brand/kaysia-logo';
import { UnreadBadge, useUnreadContactCount } from '@/hooks/use-unread-contact-count';

export interface NavLinkItem {
    id: string;
    label: string;
    href: string;
    icon: LucideIcon;
}

/** Kişisel Finans grubu */
export const PERSONAL_FINANCE_NAV_ITEMS: NavLinkItem[] = [
    {
        id: 'pf-income',
        label: 'Gelirler',
        href: '/app/dashboard/personal-finance/income',
        icon: WalletCards
    },
    {
        id: 'pf-budget',
        label: 'Bütçe',
        href: '/app/dashboard/personal-finance/budget',
        icon: PieChart
    },
    {
        id: 'pf-savings',
        label: 'Birikim',
        href: '/app/dashboard/personal-finance/savings',
        icon: PiggyBank
    },
    {
        id: 'pf-expenses',
        label: 'Giderler',
        href: '/app/dashboard/personal-finance/expenses',
        icon: CreditCard
    },
    {
        id: 'pf-debts',
        label: 'Borçlar',
        href: '/app/dashboard/personal-finance/debts',
        icon: Scale
    },
    {
        id: 'pf-activity',
        label: 'Hareketler',
        href: '/app/dashboard/personal-finance/activity',
        icon: History
    }
];

/** Şirket Finans grubu */
export const COMPANY_FINANCE_NAV_ITEMS: NavLinkItem[] = [
    {
        id: 'cf-calculator',
        label: 'Hesaplama',
        href: '/app/dashboard/company-finance/calculator',
        icon: Calculator
    },
    {
        id: 'cf-monthly',
        label: 'Aylık kazanç',
        href: '/app/dashboard/company-finance/monthly',
        icon: Wallet
    },
    {
        id: 'cf-taxes',
        label: 'Vergiler',
        href: '/app/dashboard/company-finance/vergiler',
        icon: FileText
    },
    {
        id: 'cf-paket-prim',
        label: 'Paket prim',
        href: '/app/dashboard/company-finance/paket-prim',
        icon: Package
    },
    {
        id: 'cf-bagkur',
        label: 'Bağkur',
        href: '/app/dashboard/company-finance/bagkur',
        icon: Shield
    },
    {
        id: 'cf-fuel',
        label: 'Benzin',
        href: '/app/dashboard/company-finance/fuel',
        icon: Fuel
    },
    {
        id: 'cf-tax-installments',
        label: 'Vergi taksit',
        href: '/app/dashboard/company-finance/vergi-taksit',
        icon: Landmark
    }
];

function pathActive(pathname: string, href: string): boolean {
    if (pathname === href) return true;
    if (href === '/app/dashboard') return false;
    return pathname.startsWith(href + '/');
}

export function Sidebar() {
    const pathname = usePathname();
    const { count: unreadMessages } = useUnreadContactCount();
    const companyFinanceActive = COMPANY_FINANCE_NAV_ITEMS.some((item) =>
        pathActive(pathname, item.href)
    );
    const personalFinanceActive = PERSONAL_FINANCE_NAV_ITEMS.some((item) =>
        pathActive(pathname, item.href)
    );
    const [companyFinanceOpen, setCompanyFinanceOpen] = useState(companyFinanceActive);
    const [personalFinanceOpen, setPersonalFinanceOpen] = useState(personalFinanceActive);

    useEffect(() => {
        if (companyFinanceActive) setCompanyFinanceOpen(true);
    }, [companyFinanceActive]);

    useEffect(() => {
        if (personalFinanceActive) setPersonalFinanceOpen(true);
    }, [personalFinanceActive]);

    const linkClass = (href: string) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            pathActive(pathname, href)
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        }`;

    return (
        <aside className="hidden md:flex w-64 border-r h-full bg-background flex-col fixed left-0 top-0 overflow-y-auto z-50">
            <div className="p-6 border-b">
                <Link href="/app/dashboard" aria-label="Kaysia App">
                    <KaysiaLogo markClassName="h-7 w-7" wordmarkClassName="text-lg tracking-[0.22em]" />
                </Link>
                <p className="text-[11px] text-muted-foreground mt-1.5 pl-[2.35rem]">App</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                <Link href="/app/dashboard" className={linkClass('/app/dashboard')}>
                    <LayoutDashboard className="w-5 h-5 shrink-0" />
                    <span>Dashboard</span>
                </Link>

                <Link
                    href="/app/dashboard/messages"
                    className={linkClass('/app/dashboard/messages')}
                >
                    <Mail className="w-5 h-5 shrink-0" />
                    <span>Mesajlar</span>
                    <UnreadBadge count={unreadMessages} />
                </Link>

                <Link href="/app/dashboard/projects" className={linkClass('/app/dashboard/projects')}>
                    <FolderKanban className="w-5 h-5 shrink-0" />
                    <span>Projeler</span>
                </Link>

                <Link href="/app/dashboard/domains" className={linkClass('/app/dashboard/domains')}>
                    <Globe className="w-5 h-5 shrink-0" />
                    <span>Domainler</span>
                </Link>

                <Link href="/app/dashboard/ecosystem" className={linkClass('/app/dashboard/ecosystem')}>
                    <Blocks className="w-5 h-5 shrink-0" />
                    <span>Ekosistem</span>
                </Link>

                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setCompanyFinanceOpen((o) => !o)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                            companyFinanceActive && !companyFinanceOpen
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                        }`}
                        aria-expanded={companyFinanceOpen}
                    >
                        <Building2 className="w-5 h-5 shrink-0" />
                        <span className="flex-1">Şirket Finans</span>
                        {companyFinanceOpen ? (
                            <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                        ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                        )}
                    </button>

                    {companyFinanceOpen && (
                        <div className="mt-1 ml-2 pl-3 border-l border-border/80 space-y-0.5">
                            {COMPANY_FINANCE_NAV_ITEMS.map((item) => (
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

                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setPersonalFinanceOpen((o) => !o)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                            personalFinanceActive && !personalFinanceOpen
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                        }`}
                        aria-expanded={personalFinanceOpen}
                    >
                        <UserRound className="w-5 h-5 shrink-0" />
                        <span className="flex-1">Kişisel Finans</span>
                        {personalFinanceOpen ? (
                            <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                        ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                        )}
                    </button>

                    {personalFinanceOpen && (
                        <div className="mt-1 ml-2 pl-3 border-l border-border/80 space-y-0.5">
                            {PERSONAL_FINANCE_NAV_ITEMS.map((item) => (
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

                <Link href="/app/dashboard/assistant" className={linkClass('/app/dashboard/assistant')}>
                    <Bot className="w-5 h-5 shrink-0" />
                    <span>Asistan</span>
                </Link>

                <Link href="/app/dashboard/ai-usage" className={linkClass('/app/dashboard/ai-usage')}>
                    <Coins className="w-5 h-5 shrink-0" />
                    <span>AI kullanım</span>
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
                        void import('@/lib/auth-client').then((m) =>
                            m.signOutAndRedirect('/')
                        );
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
