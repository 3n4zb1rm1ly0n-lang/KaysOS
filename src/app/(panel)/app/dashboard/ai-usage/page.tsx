'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Coins, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AI_MONTHLY_BUDGET_USD } from '@/lib/ai-assistant/pricing';
import {
    DEFAULT_AI_BUDGET,
    normalizeBudgetRow,
    type AiBudgetSettings
} from '@/lib/ai-assistant/budget';

type UsageRow = {
    id: string;
    created_at: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    tool_rounds: number;
    ok: boolean;
    error: string | null;
};

function fmtUsd(n: number, digits = 4): string {
    return `$${n.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: Math.max(digits, 2)
    })}`;
}

function startOfTodayIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function startOfMonthIso(): string {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

export default function AiUsagePage() {
    const [rows, setRows] = useState<UsageRow[]>([]);
    const [monthCost, setMonthCost] = useState(0);
    const [monthTokens, setMonthTokens] = useState(0);
    const [monthCalls, setMonthCalls] = useState(0);
    const [periodCost, setPeriodCost] = useState(0);
    const [budgetSettings, setBudgetSettings] = useState<AiBudgetSettings>(DEFAULT_AI_BUDGET);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const budget = budgetSettings.limit_usd || AI_MONTHLY_BUDGET_USD;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const monthIso = startOfMonthIso();

        const [listRes, monthRes, budgetRes] = await Promise.all([
            supabase
                .from('ai_usage_logs')
                .select(
                    'id, created_at, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, tool_rounds, ok, error'
                )
                .order('created_at', { ascending: false })
                .limit(200),
            supabase
                .from('ai_usage_logs')
                .select('cost_usd, total_tokens')
                .gte('created_at', monthIso)
                .limit(5000),
            supabase
                .from('ai_budget_settings')
                .select('id, limit_usd, period_started_at, updated_at')
                .eq('id', 'main')
                .maybeSingle()
        ]);

        setLoading(false);

        const settings = normalizeBudgetRow(
            budgetRes.error ? null : (budgetRes.data as AiBudgetSettings | null)
        );
        setBudgetSettings(settings);

        if (listRes.error) {
            setError(
                listRes.error.message.includes('ai_usage_logs') || listRes.error.code === '42P01'
                    ? 'Tablo yok. Supabase SQL Editor’da create_ai_usage_logs.sql çalıştır.'
                    : listRes.error.message
            );
            setRows([]);
            setMonthCost(0);
            setMonthTokens(0);
            setMonthCalls(0);
            setPeriodCost(0);
            return;
        }

        setRows((listRes.data as UsageRow[]) || []);

        if (monthRes.error) {
            setMonthCost(0);
            setMonthTokens(0);
            setMonthCalls(0);
        } else {
            const monthRows = monthRes.data || [];
            setMonthCalls(monthRows.length);
            setMonthCost(monthRows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0));
            setMonthTokens(monthRows.reduce((s, r) => s + (Number(r.total_tokens) || 0), 0));
        }

        const periodStart = settings.period_started_at;
        const { data: periodRows, error: periodErr } = await supabase
            .from('ai_usage_logs')
            .select('cost_usd')
            .gte('created_at', periodStart)
            .limit(5000);

        if (periodErr || !periodRows) {
            setPeriodCost(0);
        } else {
            setPeriodCost(periodRows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0));
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const todayIso = startOfTodayIso();

    const todayStats = useMemo(() => {
        return rows
            .filter((r) => r.created_at >= todayIso)
            .reduce(
                (acc, r) => {
                    acc.tokens += Number(r.total_tokens) || 0;
                    acc.cost += Number(r.cost_usd) || 0;
                    acc.calls += 1;
                    return acc;
                },
                { tokens: 0, cost: 0, calls: 0 }
            );
    }, [rows, todayIso]);

    const budgetPct = budget > 0 ? Math.min(100, (periodCost / budget) * 100) : 0;
    const remaining = Math.max(0, budget - periodCost);
    const barTone =
        budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-primary';
    const periodLabel =
        budgetSettings.period_started_at &&
        new Date(budgetSettings.period_started_at).getTime() > 0
            ? new Date(budgetSettings.period_started_at).toLocaleString('tr-TR')
            : 'tüm kayıtlar';

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Coins className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">OpenAI</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">AI kullanım</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Her asistan isteğinin token ve tahmini USD maliyeti.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/app/dashboard/settings"
                        className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary/50"
                    >
                        Bütçe ayarı
                    </Link>
                    <Link
                        href="/app/dashboard/assistant"
                        className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary/50"
                    >
                        Asistana dön
                    </Link>
                </div>
            </header>

            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            <section className="rounded-xl border border-border p-4 md:p-5 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <div className="text-xs text-muted-foreground">Dönem bütçesi</div>
                        <div className="text-lg font-semibold tabular-nums mt-0.5">
                            {fmtUsd(periodCost, 4)}
                            <span className="text-muted-foreground font-normal text-sm">
                                {' '}
                                / {fmtUsd(budget, 2)}
                            </span>
                        </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground tabular-nums">
                        <div>%{budgetPct.toFixed(1)} kullanıldı</div>
                        <div>Kalan {fmtUsd(remaining, 4)}</div>
                    </div>
                </div>
                <div
                    className="h-3 w-full rounded-full bg-secondary/60 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(budgetPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="AI bütçe kullanımı"
                >
                    <div
                        className={`h-full rounded-full transition-[width] duration-500 ease-out ${barTone}`}
                        style={{ width: `${budgetPct}%` }}
                    />
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Dönem: {periodLabel}. Limit ve sıfırlama{' '}
                    <Link href="/app/dashboard/settings" className="text-primary hover:underline">
                        Ayarlar
                    </Link>
                    ’dan.
                </p>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi
                    title="Bugün"
                    tokens={todayStats.tokens}
                    cost={todayStats.cost}
                    calls={todayStats.calls}
                />
                <Kpi
                    title="Bu ay"
                    tokens={monthTokens}
                    cost={monthCost}
                    calls={monthCalls}
                />
                <Kpi
                    title="Son 200 istek"
                    tokens={rows.reduce((s, r) => s + (Number(r.total_tokens) || 0), 0)}
                    cost={rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0)}
                    calls={rows.length}
                />
            </section>

            <section className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">İstekler</h2>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="text-xs px-2 py-1 rounded-md border border-border hover:bg-secondary/50"
                    >
                        Yenile
                    </button>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Yükleniyor…</span>
                    </div>
                ) : rows.length === 0 ? (
                    <p className="px-4 py-10 text-sm text-muted-foreground text-center">
                        Henüz istek yok. Asistanda bir soru sor.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th className="text-left font-medium px-3 py-2">Zaman</th>
                                    <th className="text-left font-medium px-3 py-2">Model</th>
                                    <th className="text-right font-medium px-3 py-2">Girdi</th>
                                    <th className="text-right font-medium px-3 py-2">Çıktı</th>
                                    <th className="text-right font-medium px-3 py-2">Toplam</th>
                                    <th className="text-right font-medium px-3 py-2">USD</th>
                                    <th className="text-right font-medium px-3 py-2">Tur</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((r) => (
                                    <tr key={r.id} className={r.ok ? '' : 'bg-red-500/5'}>
                                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                            {new Date(r.created_at).toLocaleString('tr-TR')}
                                        </td>
                                        <td className="px-3 py-2">{r.model}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.prompt_tokens}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.completion_tokens}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                                            {r.total_tokens}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtUsd(Number(r.cost_usd))}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.tool_rounds}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function Kpi({
    title,
    tokens,
    cost,
    calls
}: {
    title: string;
    tokens: number;
    cost: number;
    calls: number;
}) {
    return (
        <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">{title}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{fmtUsd(cost)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {tokens.toLocaleString('tr-TR')} token · {calls} istek
            </div>
        </div>
    );
}
