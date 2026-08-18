'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { ControlCenter } from '@/components/panel/control-center';
import { FinanceDonut } from '@/components/panel/finance-donut';
import { supabase } from '@/lib/supabase';
import { fetchDashboardFinance, type DashboardFinance } from '@/lib/dashboard-finance';
import { fmtMoney } from '@/lib/personal-finance';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowRight, Fuel, Landmark, Loader2, Shield, UserRound, Wallet } from 'lucide-react';

type ProjectStatus =
    | 'idea'
    | 'potential'
    | 'ongoing'
    | 'on_hold'
    | 'completed'
    | 'cancelled';

interface DashboardProjectRow {
    id: string;
    title: string;
    status: ProjectStatus;
    updated_at: string;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
    idea: 'Fikir',
    potential: 'Potansiyel',
    ongoing: 'Devam ediyor',
    on_hold: 'Beklemede',
    completed: 'Bitti',
    cancelled: 'İptal'
};

const STATUS_BADGE: Record<ProjectStatus, string> = {
    idea: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    potential: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    ongoing: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    on_hold: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    completed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    cancelled: 'bg-red-500/15 text-red-300 border-red-500/30'
};

const STATUSES: ProjectStatus[] = [
    'idea',
    'potential',
    'ongoing',
    'on_hold',
    'completed',
    'cancelled'
];

function normalizeProjectStatus(s: string): ProjectStatus {
    if (STATUSES.includes(s as ProjectStatus)) return s as ProjectStatus;
    return 'idea';
}

function SqlHint({ hint }: { hint?: string }) {
    if (!hint) return null;
    return <p className="text-xs text-muted-foreground">{hint}</p>;
}

export default function DashboardPage() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [projects, setProjects] = useState<DashboardProjectRow[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [finance, setFinance] = useState<DashboardFinance | null>(null);
    const [financeLoading, setFinanceLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setProjectsLoading(true);
            setFinanceLoading(true);
            setProjectsError(null);
            try {
                const [projectsRes, fin] = await Promise.all([
                    supabase
                        .from('projects')
                        .select('id, title, status, updated_at')
                        .order('updated_at', { ascending: false }),
                    fetchDashboardFinance(year, month)
                ]);

                if (projectsRes.error) {
                    setProjectsError(projectsRes.error.message);
                    setProjects([]);
                } else {
                    const rows = (projectsRes.data || []).map((r) => ({
                        id: r.id,
                        title: r.title || 'Adsız',
                        status: normalizeProjectStatus(String(r.status || 'idea')),
                        updated_at: r.updated_at
                    }));
                    setProjects(rows);
                }
                setFinance(fin);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setProjectsLoading(false);
                setFinanceLoading(false);
            }
        };
        void load();
    }, [year, month]);

    const projectKpis = useMemo(() => {
        const total = projects.length;
        const ongoing = projects.filter((p) => p.status === 'ongoing').length;
        const pipeline = projects.filter(
            (p) => p.status === 'idea' || p.status === 'potential'
        ).length;
        const closed = projects.filter(
            (p) => p.status === 'completed' || p.status === 'cancelled'
        ).length;
        return [
            { title: 'Toplam', value: String(total), change: 'Kayıtlı', trend: 'neutral' as const },
            { title: 'Devam', value: String(ongoing), trend: 'neutral' as const, change: 'Aktif' },
            {
                title: 'Pipeline',
                value: String(pipeline),
                trend: 'neutral' as const,
                change: 'Fikir + Potansiyel'
            },
            {
                title: 'Kapalı',
                value: String(closed),
                trend: 'neutral' as const,
                change: 'Bitti / İptal'
            }
        ];
    }, [projects]);

    const recentProjects = useMemo(() => projects.slice(0, 4), [projects]);
    const pf = finance?.personal;
    const tax = finance?.tax;
    const fuel = finance?.fuel;
    const bagkur = finance?.bagkur;
    const cash = finance?.companyCash;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Genel Bakış</h2>
                    <p className="text-muted-foreground mt-1">
                        Bu ay: projeler, şirket ve kişisel finans özetleri.
                    </p>
                </div>
                <ControlCenter />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                {/* Projeler */}
                <section className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight">Projeler</h3>
                            <p className="text-xs text-muted-foreground">Durum özeti</p>
                        </div>
                        <Link
                            href="/app/dashboard/projects"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Tümü
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {projectKpis.map((card) => (
                            <div
                                key={card.title}
                                className="rounded-lg border border-border px-3 py-2.5"
                            >
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    {card.title}
                                </p>
                                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                                    {card.value}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{card.change}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-3 py-2 border-b flex items-center justify-between">
                            <h4 className="font-medium text-xs">Son güncellenen</h4>
                            {projectsLoading && (
                                <Loader2
                                    className="w-3.5 h-3.5 animate-spin text-muted-foreground"
                                    aria-hidden
                                />
                            )}
                        </div>
                        {projectsError && (
                            <p className="px-3 py-6 text-sm text-destructive">{projectsError}</p>
                        )}
                        {!projectsError && !projectsLoading && recentProjects.length === 0 && (
                            <p className="px-3 py-6 text-sm text-muted-foreground">
                                Henüz proje yok.{' '}
                                <Link
                                    href="/app/dashboard/projects"
                                    className="text-primary font-medium hover:underline"
                                >
                                    Ekle
                                </Link>
                            </p>
                        )}
                        {!projectsError && recentProjects.length > 0 && (
                            <ul className="divide-y divide-border">
                                {recentProjects.map((p) => (
                                    <li key={p.id}>
                                        <Link
                                            href="/app/dashboard/projects"
                                            className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-secondary/40 transition-colors"
                                        >
                                            <span className="font-medium text-sm truncate pr-1">
                                                {p.title}
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span
                                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${STATUS_BADGE[p.status]}`}
                                                >
                                                    {STATUS_LABELS[p.status]}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:inline">
                                                    {format(new Date(p.updated_at), 'd MMM', {
                                                        locale: tr
                                                    })}
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                {/* Şirket finans */}
                <section className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight">Şirket finans</h3>
                            <p className="text-xs text-muted-foreground">Bu ay nakit, vergi, benzin</p>
                        </div>
                        <Link
                            href="/app/dashboard/company-finance/monthly"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Aylık
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {financeLoading && !finance ? (
                        <div className="flex justify-center py-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <MiniStat
                                    icon={<Wallet className="h-3.5 w-3.5" />}
                                    label="Aylık net nakit"
                                    value={
                                        cash?.ok ? fmtMoney(cash.amount) : '—'
                                    }
                                    href="/app/dashboard/company-finance/monthly"
                                    hint={cash?.ok ? undefined : cash?.sqlHint}
                                />
                                <MiniStat
                                    icon={<Landmark className="h-3.5 w-3.5" />}
                                    label="Vergi taksit bu ay"
                                    value={tax?.ok ? fmtMoney(tax.dueThisMonth) : '—'}
                                    href="/app/dashboard/company-finance/vergi-taksit"
                                    hint={
                                        tax?.ok && tax.overdue > 0
                                            ? `Geciken ${fmtMoney(tax.overdue)}`
                                            : tax?.sqlHint
                                    }
                                    warn={Boolean(tax?.ok && tax.overdue > 0)}
                                />
                                <MiniStat
                                    icon={<Fuel className="h-3.5 w-3.5" />}
                                    label="Benzin alınan"
                                    value={fuel?.ok ? fmtMoney(fuel.totalAmount) : '—'}
                                    href="/app/dashboard/company-finance/fuel"
                                    hint={
                                        fuel?.ok
                                            ? `${fuel.count} dolum · ${fuel.totalLiters.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} L${
                                                  fuel.budget > 0
                                                      ? ` · %${Math.round((fuel.totalAmount / fuel.budget) * 100)} hedef`
                                                      : ''
                                              }`
                                            : fuel?.sqlHint
                                    }
                                />
                                <MiniStat
                                    icon={<Shield className="h-3.5 w-3.5" />}
                                    label="Bağkur bu ay"
                                    value={
                                        bagkur?.ok
                                            ? bagkur.paid
                                                ? fmtMoney(0)
                                                : fmtMoney(bagkur.thisMonth)
                                            : '—'
                                    }
                                    href="/app/dashboard/company-finance/bagkur"
                                    hint={
                                        bagkur?.ok
                                            ? bagkur.paid
                                                ? 'Ödendi'
                                                : bagkur.prim > 0
                                                  ? `Prim ${fmtMoney(bagkur.prim)}`
                                                  : undefined
                                            : bagkur?.sqlHint
                                    }
                                />
                            </div>

                            <div className="rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h4 className="text-xs font-semibold">Vergi taksit dilimleri</h4>
                                    <Link
                                        href="/app/dashboard/company-finance/vergi-taksit"
                                        className="text-[11px] text-primary hover:underline"
                                    >
                                        Plan
                                    </Link>
                                </div>
                                {tax?.ok ? (
                                    <FinanceDonut
                                        data={tax.slices}
                                        centerLabel="Bu ay"
                                        centerValue={fmtMoney(tax.dueThisMonth)}
                                        height={160}
                                    />
                                ) : (
                                    <SqlHint hint={tax?.sqlHint} />
                                )}
                            </div>
                        </>
                    )}
                </section>

                {/* Kişisel finans */}
                <section className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight">Kişisel finans</h3>
                            <p className="text-xs text-muted-foreground">
                                Gelir, haciz bloke, gider
                            </p>
                        </div>
                        <Link
                            href="/app/dashboard/personal-finance/expenses"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Giderler
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {financeLoading && !finance ? (
                        <div className="flex justify-center py-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : pf?.ok === false ? (
                        <SqlHint hint={pf.sqlHint} />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <MiniStat
                                    icon={<Wallet className="h-3.5 w-3.5" />}
                                    label="Gelir"
                                    value={fmtMoney(pf?.income ?? 0)}
                                    href="/app/dashboard/personal-finance/income"
                                />
                                <MiniStat
                                    icon={<UserRound className="h-3.5 w-3.5" />}
                                    label="Haciz bloke"
                                    value={fmtMoney(pf?.blocked ?? 0)}
                                    href="/app/dashboard/personal-finance/income"
                                />
                                <MiniStat
                                    label="Gider"
                                    value={fmtMoney(pf?.expense ?? 0)}
                                    href="/app/dashboard/personal-finance/expenses"
                                />
                                <MiniStat
                                    label="Kalan (kullanılabilir)"
                                    value={fmtMoney(pf?.usableRemaining ?? 0)}
                                    href="/app/dashboard/personal-finance/expenses"
                                    emphasize
                                    warn={Boolean(pf && pf.usableRemaining < 0)}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Açık borç{' '}
                                <Link
                                    href="/app/dashboard/personal-finance/debts"
                                    className="text-primary hover:underline tabular-nums"
                                >
                                    {fmtMoney(pf?.openDebt ?? 0)}
                                </Link>
                            </p>
                            <div className="rounded-lg border border-border p-3">
                                <h4 className="text-xs font-semibold mb-1">Dağılım</h4>
                                <FinanceDonut
                                    data={pf?.slices ?? []}
                                    centerLabel="Kalan"
                                    centerValue={fmtMoney(pf?.usableRemaining ?? 0)}
                                    height={160}
                                />
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

function MiniStat({
    label,
    value,
    href,
    hint,
    icon,
    emphasize,
    warn
}: {
    label: string;
    value: string;
    href: string;
    hint?: string;
    icon?: ReactNode;
    emphasize?: boolean;
    warn?: boolean;
}) {
    return (
        <Link
            href={href}
            className={`rounded-lg border px-3 py-2.5 hover:bg-secondary/40 transition-colors ${
                emphasize ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
        >
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {icon}
                {label}
            </p>
            <p
                className={`mt-0.5 text-sm font-semibold tabular-nums ${
                    warn ? 'text-red-400' : emphasize ? 'text-primary' : ''
                }`}
            >
                {value}
            </p>
            {hint && (
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{hint}</p>
            )}
        </Link>
    );
}
