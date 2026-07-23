
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ControlCenter } from "@/components/panel/control-center";
import { KpiCard } from "@/components/panel/kpi-card";
import { RevenueExpenseLine } from "@/components/panel/charts/revenue-expense-line";
import { supabase } from '@/lib/supabase';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, format,
    addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
    isSameDay, isSameMonth
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';

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

export default function DashboardPage() {
    const [incomes, setIncomes] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<DashboardProjectRow[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);

    const [weeklyDate, setWeeklyDate] = useState(new Date());
    const [monthlyDate, setMonthlyDate] = useState(new Date());
    const [yearlyDate, setYearlyDate] = useState(new Date());

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setProjectsLoading(true);
        setProjectsError(null);
        try {
            const [incomesRes, expensesRes, projectsRes] = await Promise.all([
                supabase.from('incomes').select('*'),
                supabase.from('expenses').select('*'),
                supabase
                    .from('projects')
                    .select('id, title, status, updated_at')
                    .order('updated_at', { ascending: false })
            ]);

            setIncomes(incomesRes.data || []);
            setExpenses(expensesRes.data || []);

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
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
            setProjectsLoading(false);
        }
    };

    // --- Aggregation Logic ---

    const getWeeklyData = () => {
        const start = startOfWeek(weeklyDate, { weekStartsOn: 1 });
        const end = endOfWeek(weeklyDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dayIncomes = incomes.filter(i => isSameDay(new Date(i.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                name: format(day, 'EEEE', { locale: tr }),
                revenue: dayIncomes,
                expense: dayExpenses
            };
        });
    };

    const getMonthlyData = () => {
        const start = startOfMonth(monthlyDate);
        const end = endOfMonth(monthlyDate);
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dayIncomes = incomes.filter(i => isSameDay(new Date(i.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                name: format(day, 'd'),
                revenue: dayIncomes,
                expense: dayExpenses
            };
        });
    };

    const getYearlyData = () => {
        const start = startOfYear(yearlyDate);
        const end = endOfYear(yearlyDate);
        const months = eachMonthOfInterval({ start, end });

        return months.map(month => {
            const monthIncomes = incomes.filter(i => isSameMonth(new Date(i.date), month)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const monthExpenses = expenses.filter(e => isSameMonth(new Date(e.date), month)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                name: format(month, 'MMM', { locale: tr }),
                revenue: monthIncomes,
                expense: monthExpenses
            };
        });
    };

    // --- Mock KPIs for now, or Calculate them if wanted ---
    const totalIncome = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalExpense = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const netResult = totalIncome - totalExpense;

    // Cash Flow Calculations (Nakit Akışı)
    // Gelir: Sadece "Gelir" statüsünde olanlar VE tarihi bugün veya geçmişte olanlar (Gelecek tarihli "Gelir" olmaz ama kontrol etmekte fayda var)
    // Gider: Tarihi bugün veya geçmişte olanlar
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Include end of today

    const realizedIncome = incomes
        .filter(i => i.status === 'Gelir' && new Date(i.date) <= today)
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const realizedExpense = expenses
        .filter(e => new Date(e.date) <= today)
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const netCash = realizedIncome - realizedExpense;

    const pendingIncome = incomes
        .filter(i => i.status === 'Bekleyen' || new Date(i.date) > today)
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const kpiCards = [
        {
            title: 'Toplam Ciro (Gelecek Dahil)',
            value: `₺${totalIncome.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
            change: 'Genel',
            trend: 'neutral'
        },
        {
            title: 'Bekleyen / Gelecek Tahsilat',
            value: `₺${pendingIncome.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
            change: 'Alacaklar',
            trend: 'neutral'
        },
        {
            title: 'Toplam Gider',
            value: `₺${totalExpense.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
            change: '-',
            trend: 'neutral'
        },
        {
            title: 'ANLIK KASA (Nakit)',
            value: `₺${netCash.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
            change: 'Cepteki Para',
            trend: netCash >= 0 ? 'up' : 'down'
        },
    ];

    const projectKpis = useMemo(() => {
        const total = projects.length;
        const ongoing = projects.filter((p) => p.status === 'ongoing').length;
        const pipeline = projects.filter((p) => p.status === 'idea' || p.status === 'potential').length;
        const closed = projects.filter((p) => p.status === 'completed' || p.status === 'cancelled').length;
        return [
            { title: 'Toplam proje', value: String(total), change: 'Kayıtlı', trend: 'neutral' as const },
            { title: 'Devam ediyor', value: String(ongoing), trend: 'neutral' as const, change: 'Aktif' },
            { title: 'Pipeline', value: String(pipeline), trend: 'neutral' as const, change: 'Fikir + Potansiyel' },
            { title: 'Bitti / İptal', value: String(closed), trend: 'neutral' as const, change: 'Kapalı' }
        ];
    }, [projects]);

    const recentProjects = useMemo(() => projects.slice(0, 6), [projects]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Genel Bakış</h2>
                    <p className="text-muted-foreground mt-1">
                        İşletmenizin anlık durumunu buradan takip edebilirsiniz.
                    </p>
                </div>
                <ControlCenter />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {kpiCards.map((card, index) => (
                    <KpiCard
                        key={index}
                        title={card.title}
                        value={card.value}
                        change={card.change}
                        trend={card.trend as any}
                    />
                ))}
            </div>

            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">Projeler</h3>
                        <p className="text-sm text-muted-foreground">
                            Özet ve son güncellenen kayıtlar
                        </p>
                    </div>
                    <Link
                        href="/app/dashboard/projects"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                        Tümünü gör
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {projectKpis.map((card, index) => (
                        <KpiCard
                            key={index}
                            title={card.title}
                            value={card.value}
                            change={card.change}
                            trend={card.trend}
                        />
                    ))}
                </div>

                <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <h4 className="font-medium text-sm">Son güncellenen projeler</h4>
                        {projectsLoading && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden />
                        )}
                    </div>
                    <div className="p-0">
                        {projectsError && (
                            <p className="px-6 py-8 text-sm text-destructive">{projectsError}</p>
                        )}
                        {!projectsError && !projectsLoading && recentProjects.length === 0 && (
                            <p className="px-6 py-8 text-sm text-muted-foreground">
                                Henüz proje yok.{' '}
                                <Link href="/app/dashboard/projects" className="text-primary font-medium hover:underline">
                                    Projeler sayfasından ekleyin
                                </Link>
                                .
                            </p>
                        )}
                        {!projectsError && recentProjects.length > 0 && (
                            <ul className="divide-y divide-border">
                                {recentProjects.map((p) => (
                                    <li key={p.id}>
                                        <Link
                                            href="/app/dashboard/projects"
                                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-3 hover:bg-secondary/40 transition-colors"
                                        >
                                            <span className="font-medium text-foreground truncate pr-2">
                                                {p.title}
                                            </span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span
                                                    className={`text-xs font-medium px-2 py-0.5 rounded-md border ${STATUS_BADGE[p.status]}`}
                                                >
                                                    {STATUS_LABELS[p.status]}
                                                </span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {format(new Date(p.updated_at), 'd MMM yyyy, HH:mm', {
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
                </div>
            </section>

            <div className="space-y-8">
                {/* Haftalık Grafik */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex items-center justify-between border-b">
                        <h3 className="font-semibold">Haftalık Analiz</h3>
                        <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-1">
                            <button onClick={() => setWeeklyDate(subWeeks(weeklyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="min-w-[140px] text-center font-medium">
                                {format(startOfWeek(weeklyDate, { weekStartsOn: 1 }), 'd MMM', { locale: tr })} - {format(endOfWeek(weeklyDate, { weekStartsOn: 1 }), 'd MMM', { locale: tr })}
                            </span>
                            <button onClick={() => setWeeklyDate(addWeeks(weeklyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <RevenueExpenseLine data={getWeeklyData()} isLoading={loading} />
                    </div>
                </div>

                {/* Aylık Grafik */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex items-center justify-between border-b">
                        <h3 className="font-semibold">Aylık Analiz (Günlük)</h3>
                        <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-1">
                            <button onClick={() => setMonthlyDate(subMonths(monthlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="min-w-[140px] text-center font-medium">
                                {format(monthlyDate, 'MMMM yyyy', { locale: tr })}
                            </span>
                            <button onClick={() => setMonthlyDate(addMonths(monthlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <RevenueExpenseLine data={getMonthlyData()} isLoading={loading} />
                    </div>
                </div>

                {/* Yıllık Grafik */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex items-center justify-between border-b">
                        <h3 className="font-semibold">Yıllık Analiz (Aylık)</h3>
                        <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-1">
                            <button onClick={() => setYearlyDate(subYears(yearlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="min-w-[140px] text-center font-medium">
                                {format(yearlyDate, 'yyyy', { locale: tr })}
                            </span>
                            <button onClick={() => setYearlyDate(addYears(yearlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <RevenueExpenseLine data={getYearlyData()} isLoading={loading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
