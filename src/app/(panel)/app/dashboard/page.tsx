'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ControlCenter } from '@/components/panel/control-center';
import { KpiCard } from '@/components/panel/kpi-card';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowRight, Loader2 } from 'lucide-react';

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
    const [projects, setProjects] = useState<DashboardProjectRow[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setProjectsLoading(true);
            setProjectsError(null);
            try {
                const projectsRes = await supabase
                    .from('projects')
                    .select('id, title, status, updated_at')
                    .order('updated_at', { ascending: false });

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
                console.error('Error fetching dashboard data:', error);
            } finally {
                setProjectsLoading(false);
            }
        };
        load();
    }, []);

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
                        Projeler ve operasyon özeti.
                    </p>
                </div>
                <ControlCenter />
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
        </div>
    );
}
