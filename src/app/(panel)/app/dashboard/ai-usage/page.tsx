'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Coins, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

function fmtUsd(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('ai_usage_logs')
            .select(
                'id, created_at, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, tool_rounds, ok, error'
            )
            .order('created_at', { ascending: false })
            .limit(200);
        setLoading(false);
        if (err) {
            setError(
                err.message.includes('ai_usage_logs') || err.code === '42P01'
                    ? 'Tablo yok. Supabase SQL Editor’da create_ai_usage_logs.sql çalıştır.'
                    : err.message
            );
            setRows([]);
            return;
        }
        setRows((data as UsageRow[]) || []);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const todayIso = startOfTodayIso();
    const monthIso = startOfMonthIso();

    const stats = useMemo(() => {
        const sum = (list: UsageRow[]) =>
            list.reduce(
                (acc, r) => {
                    acc.tokens += Number(r.total_tokens) || 0;
                    acc.cost += Number(r.cost_usd) || 0;
                    acc.calls += 1;
                    return acc;
                },
                { tokens: 0, cost: 0, calls: 0 }
            );
        return {
            today: sum(rows.filter((r) => r.created_at >= todayIso)),
            month: sum(rows.filter((r) => r.created_at >= monthIso)),
            all: sum(rows)
        };
    }, [rows, todayIso, monthIso]);

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
                        Her asistan isteğinin token ve tahmini USD maliyeti. Fiyat tablosu kodda
                        (gpt-4o-mini / gpt-4o).
                    </p>
                </div>
                <Link
                    href="/app/dashboard/assistant"
                    className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary/50"
                >
                    Asistana dön
                </Link>
            </header>

            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi title="Bugün" tokens={stats.today.tokens} cost={stats.today.cost} calls={stats.today.calls} />
                <Kpi title="Bu ay" tokens={stats.month.tokens} cost={stats.month.cost} calls={stats.month.calls} />
                <Kpi title="Son 200 istek" tokens={stats.all.tokens} cost={stats.all.cost} calls={stats.all.calls} />
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
                                        <td className="px-3 py-2 text-right tabular-nums">{r.prompt_tokens}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.completion_tokens}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                                            {r.total_tokens}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(Number(r.cost_usd))}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{r.tool_rounds}</td>
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
