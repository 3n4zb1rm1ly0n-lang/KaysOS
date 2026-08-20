'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES_TR } from '@/lib/income-tax';
import {
    PF_ACTIVITY_ACTIONS,
    PF_ACTIVITY_LOG,
    fmtMoney,
    mapPfActivity,
    pfActivityActionLabel,
    type PfActivityRow
} from '@/lib/personal-finance';

export default function PersonalFinanceActivityPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [rows, setRows] = useState<PfActivityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    const load = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        let q = supabase
            .from(PF_ACTIVITY_LOG)
            .select('*')
            .eq('year', y)
            .eq('month', m)
            .order('created_at', { ascending: false })
            .limit(300);

        if (actionFilter !== 'all') {
            q = q.eq('action', actionFilter);
        }

        const { data, error: qErr } = await q;
        if (qErr) {
            setError(
                qErr.message.includes('does not exist') || qErr.code === '42P01'
                    ? 'Tablo yok. Supabase’te create_personal_finance_activity_log.sql çalıştırın.'
                    : qErr.message
            );
            setRows([]);
            setLoading(false);
            return;
        }
        setRows((data ?? []).map((r) => mapPfActivity(r as Record<string, unknown>)));
        setLoading(false);
    }, [actionFilter]);

    useEffect(() => {
        void load(year, month);
    }, [year, month, load]);

    const totalMoved = useMemo(
        () =>
            rows
                .filter((r) =>
                    ['company_bind', 'company_refresh', 'budget_send', 'savings_manual', 'expense_pay', 'debt_pay'].includes(
                        r.action
                    )
                )
                .reduce((a, r) => a + Math.abs(r.amount), 0),
        [rows]
    );

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <History className="w-6 h-6 text-primary" />
                        Hareketler
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Para ve kritik parametrelerin izi.{' '}
                        <Link
                            href="/app/dashboard/personal-finance/budget"
                            className="text-primary hover:underline"
                        >
                            Bütçe
                        </Link>
                        {' · '}
                        <Link
                            href="/app/dashboard/personal-finance/income"
                            className="text-primary hover:underline"
                        >
                            Gelirler
                        </Link>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        {MONTH_NAMES_TR.map((label, i) => (
                            <option key={label} value={i + 1}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        <option value="all">Tüm aksiyonlar</option>
                        {PF_ACTIVITY_ACTIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                                {a.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Kayıt
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{rows.length}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Hareket tutarı (mutlak)
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-primary">
                        {fmtMoney(totalMoved)}
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-400 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                    {error}
                </p>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
                </div>
            ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-10 text-center">
                    Bu ay henüz hareket yok. Gelir bağlama, bütçe gönderimi veya ödeme yaptıkça burada
                    görünür.
                </p>
            ) : (
                <ul className="space-y-2">
                    {rows.map((row) => (
                        <li
                            key={row.id}
                            className="rounded-lg border border-border bg-background px-3 py-3 space-y-1.5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                    <p className="text-sm font-medium leading-snug">{row.summary}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {pfActivityActionLabel(row.action)}
                                        {row.created_at
                                            ? ` · ${format(new Date(row.created_at), 'd MMM yyyy HH:mm', {
                                                  locale: tr
                                              })}`
                                            : ''}
                                    </p>
                                </div>
                                {Math.abs(row.amount) > 0.005 && (
                                    <p
                                        className={`text-sm font-semibold tabular-nums shrink-0 ${
                                            row.amount < 0 ? 'text-red-400' : 'text-primary'
                                        }`}
                                    >
                                        {fmtMoney(row.amount)}
                                    </p>
                                )}
                            </div>
                            {(row.from_label || row.to_label) && (
                                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="truncate max-w-[40%]">
                                        {row.from_label || '—'}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                    <span className="truncate max-w-[40%]">
                                        {row.to_label || '—'}
                                    </span>
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
