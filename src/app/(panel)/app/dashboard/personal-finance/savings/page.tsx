'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FinancePie, BUDGET_PIE_COLORS } from '@/components/panel/finance-pie';
import {
    PF_SAVINGS_LEDGER,
    PF_SAVINGS_POTS,
    fmtMoney,
    logPfActivity,
    mapSavingsLedger,
    mapSavingsPot,
    parseMoney,
    type SavingsLedgerRow,
    type SavingsPotRow
} from '@/lib/personal-finance';

const POT_COLORS = [
    BUDGET_PIE_COLORS.savings,
    BUDGET_PIE_COLORS.net,
    '#c026d3',
    '#f59e0b',
    '#0ea5e9',
    '#a3e635',
    '#dc2626'
];

export default function PersonalSavingsPage() {
    const [pots, setPots] = useState<SavingsPotRow[]>([]);
    const [ledger, setLedger] = useState<SavingsLedgerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const [draftName, setDraftName] = useState('');
    const [draftGoal, setDraftGoal] = useState('');
    const [manualPotId, setManualPotId] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [manualNote, setManualNote] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const [potRes, ledRes] = await Promise.all([
            supabase
                .from(PF_SAVINGS_POTS)
                .select('*')
                .eq('is_archived', false)
                .order('sort_order')
                .order('created_at'),
            supabase
                .from(PF_SAVINGS_LEDGER)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(40)
        ]);

        if (potRes.error?.message?.includes('does not exist') || potRes.error?.code === '42P01') {
            setError(
                'Birikim tabloları yok. Supabase’te create_personal_budget_savings.sql çalıştırın.'
            );
            setPots([]);
            setLedger([]);
            setLoading(false);
            return;
        }
        if (potRes.error) setError(potRes.error.message);

        setPots((potRes.data ?? []).map((r) => mapSavingsPot(r as Record<string, unknown>)));
        setLedger(
            (ledRes.data ?? []).map((r) => mapSavingsLedger(r as Record<string, unknown>))
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const totalBalance = useMemo(
        () => pots.reduce((a, p) => a + p.balance, 0),
        [pots]
    );

    const pie = useMemo(
        () =>
            pots.map((p, i) => ({
                name: p.name,
                value: Math.max(0, p.balance),
                color: POT_COLORS[i % POT_COLORS.length]
            })),
        [pots]
    );

    const addPot = async () => {
        const name = draftName.trim() || 'Birikim';
        setBusy(true);
        setError(null);
        const { error: iErr } = await supabase.from(PF_SAVINGS_POTS).insert([
            {
                name,
                balance: 0,
                goal_amount: parseMoney(draftGoal),
                note: '',
                sort_order: pots.length + 1
            }
        ]);
        if (iErr) setError(iErr.message);
        else {
            setDraftName('');
            setDraftGoal('');
            setStatus('Kasa eklendi');
        }
        setBusy(false);
        await load();
    };

    const updatePot = async (id: string, patch: Record<string, unknown>) => {
        const { error: uErr } = await supabase
            .from(PF_SAVINGS_POTS)
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (uErr) setError(uErr.message);
        else {
            setPots((prev) =>
                prev.map((p) => (p.id === id ? mapSavingsPot({ ...p, ...patch }) : p))
            );
        }
    };

    const archivePot = async (id: string) => {
        setBusy(true);
        const { error: uErr } = await supabase
            .from(PF_SAVINGS_POTS)
            .update({ is_archived: true })
            .eq('id', id);
        if (uErr) setError(uErr.message);
        setBusy(false);
        await load();
    };

    const manualTransfer = async (sign: 1 | -1) => {
        const potId = manualPotId || pots[0]?.id;
        if (!potId) {
            setError('Önce kasa ekle.');
            return;
        }
        const amt = parseMoney(manualAmount);
        if (amt <= 0) {
            setError('Tutar gir.');
            return;
        }
        const pot = pots.find((p) => p.id === potId);
        if (!pot) return;
        const delta = sign * amt;
        if (pot.balance + delta < -0.005) {
            setError('Bakiye yetersiz.');
            return;
        }
        setBusy(true);
        setError(null);
        const { error: uErr } = await supabase
            .from(PF_SAVINGS_POTS)
            .update({
                balance: pot.balance + delta,
                updated_at: new Date().toISOString()
            })
            .eq('id', potId);
        if (uErr) {
            setError(uErr.message);
            setBusy(false);
            return;
        }
        const { error: lErr } = await supabase.from(PF_SAVINGS_LEDGER).insert([
            {
                pot_id: potId,
                amount: delta,
                note: manualNote.trim() || (sign > 0 ? 'Manuel giriş' : 'Manuel çıkış')
            }
        ]);
        if (lErr) setError(lErr.message);
        else {
            setManualAmount('');
            setManualNote('');
            setStatus(sign > 0 ? 'Giriş kaydedildi' : 'Çıkış kaydedildi');
            const now = new Date();
            void logPfActivity({
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                action: 'savings_manual',
                summary: `Manuel → ${pot.name} · ${sign > 0 ? '+' : '−'}${fmtMoney(amt)}`,
                amount: delta,
                from_kind: 'manual',
                from_label: sign > 0 ? 'Manuel giriş' : 'Manuel çıkış',
                to_kind: 'savings',
                to_id: pot.id,
                to_label: pot.name,
                meta: {
                    note: manualNote.trim() || null,
                    before_balance: pot.balance,
                    after_balance: pot.balance + delta
                }
            });
        }
        setBusy(false);
        await load();
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <PiggyBank className="w-6 h-6 text-primary" />
                        Birikim
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Bütçeden aktarılan ve manuel girişler.{' '}
                        <Link
                            href="/app/dashboard/personal-finance/budget"
                            className="text-primary hover:underline"
                        >
                            Bütçe
                        </Link>
                    </p>
                </div>
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Toplam
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-green-400">
                        {fmtMoney(totalBalance)}
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-400 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                    {error}
                </p>
            )}
            {status && (
                <p className="text-sm text-muted-foreground rounded-md border border-border px-3 py-2">
                    {status}
                </p>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                    <h2 className="text-sm font-semibold mb-1">Kasalar</h2>
                    <FinancePie data={pie} emptyLabel="Henüz kasa yok" />
                </div>
                <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                    <h2 className="text-sm font-semibold">Manuel hareket</h2>
                    <select
                        value={manualPotId}
                        onChange={(e) => setManualPotId(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        <option value="">İlk kasa</option>
                        {pots.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <input
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        inputMode="decimal"
                        placeholder="Tutar"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        placeholder="Not"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void manualTransfer(1)}
                            className="rounded-md bg-green-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                        >
                            Giriş
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void manualTransfer(-1)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                        >
                            Çıkış
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
                </div>
            ) : (
                <ul className="space-y-3">
                    {pots.length === 0 && (
                        <li className="text-sm text-muted-foreground">
                            Kasa yok. Aşağıdan ekle; bütçeden gönderince otomatik de oluşabilir.
                        </li>
                    )}
                    {pots.map((pot) => {
                        const progress =
                            pot.goal_amount > 0
                                ? Math.min(100, (pot.balance / pot.goal_amount) * 100)
                                : null;
                        return (
                            <li
                                key={pot.id}
                                className="rounded-lg border border-border p-3 space-y-2"
                            >
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Ad
                                        </label>
                                        <input
                                            value={pot.name}
                                            onChange={(e) =>
                                                setPots((prev) =>
                                                    prev.map((p) =>
                                                        p.id === pot.id
                                                            ? { ...p, name: e.target.value }
                                                            : p
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updatePot(pot.id, {
                                                    name: pot.name.trim() || 'Birikim'
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Bakiye
                                        </label>
                                        <p className="text-sm font-semibold tabular-nums pt-1.5 text-green-400">
                                            {fmtMoney(pot.balance)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Hedef
                                        </label>
                                        <input
                                            value={String(pot.goal_amount)}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setPots((prev) =>
                                                    prev.map((p) =>
                                                        p.id === pot.id
                                                            ? {
                                                                  ...p,
                                                                  goal_amount: parseMoney(
                                                                      e.target.value
                                                                  )
                                                              }
                                                            : p
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updatePot(pot.id, {
                                                    goal_amount: pot.goal_amount
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                        />
                                    </div>
                                </div>
                                {progress != null && (
                                    <div>
                                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                            <div
                                                className="h-full bg-green-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Hedefin %{progress.toFixed(0)}’i
                                        </p>
                                    </div>
                                )}
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => void archivePot(pot.id)}
                                        className="p-1.5 text-muted-foreground hover:text-red-400"
                                        aria-label="Arşivle"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Kasa ekle
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                    <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Acil fon, tatil…"
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                        value={draftGoal}
                        onChange={(e) => setDraftGoal(e.target.value)}
                        inputMode="decimal"
                        placeholder="Hedef tutar (opsiyonel)"
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                </div>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addPot()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                    <Wallet className="w-4 h-4" /> Ekle
                </button>
            </div>

            <div className="rounded-lg border border-border p-4">
                <h2 className="text-sm font-semibold mb-3">Son hareketler</h2>
                {ledger.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Henüz hareket yok.</p>
                ) : (
                    <ul className="space-y-2">
                        {ledger.map((row) => {
                            const potName =
                                pots.find((p) => p.id === row.pot_id)?.name || 'Kasa';
                            return (
                                <li
                                    key={row.id}
                                    className="flex justify-between gap-3 text-sm border-b border-border/60 pb-2"
                                >
                                    <div>
                                        <p className="font-medium">{potName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {row.note || '—'}
                                            {row.created_at
                                                ? ` · ${row.created_at.slice(0, 10)}`
                                                : ''}
                                        </p>
                                    </div>
                                    <p
                                        className={`tabular-nums font-semibold ${
                                            row.amount >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {row.amount >= 0 ? '+' : ''}
                                        {fmtMoney(row.amount)}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
