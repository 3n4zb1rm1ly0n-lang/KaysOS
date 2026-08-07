'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Scale, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    DEBT_TYPES,
    PF_DEBTS,
    debtTypeLabel,
    expenseIsFullyPaid,
    expenseRemaining,
    fmtMoney,
    mapDebt,
    parseMoney,
    type PersonalDebtRow
} from '@/lib/personal-finance';

type FilterStatus = 'open' | 'all' | 'paid';
type FilterType = 'all' | (typeof DEBT_TYPES)[number]['value'];

export default function PersonalDebtsPage() {
    const [debts, setDebts] = useState<PersonalDebtRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('open');
    const [filterType, setFilterType] = useState<FilterType>('all');

    const [draftName, setDraftName] = useState('');
    const [draftType, setDraftType] = useState<(typeof DEBT_TYPES)[number]['value']>('loan');
    const [draftCreditor, setDraftCreditor] = useState('');
    const [draftAmount, setDraftAmount] = useState('');
    const [draftPaidAmount, setDraftPaidAmount] = useState('');
    const [draftDue, setDraftDue] = useState('');
    const [draftNote, setDraftNote] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const { data, error: qErr } = await supabase
            .from(PF_DEBTS)
            .select('*')
            .order('is_paid')
            .order('sort_order')
            .order('created_at', { ascending: false });

        if (qErr) {
            setError(
                qErr.message.includes('does not exist') || qErr.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_personal_finance_debts.sql çalıştırın.'
                    : qErr.message
            );
            setDebts([]);
            setLoading(false);
            return;
        }

        setDebts((data ?? []).map((r) => mapDebt(r as Record<string, unknown>)));
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = useMemo(() => {
        return debts.filter((d) => {
            const left = expenseRemaining(d.amount, d.paid_amount);
            const fully = expenseIsFullyPaid(d.amount, d.paid_amount) || d.is_paid;
            if (filterStatus === 'open' && fully) return false;
            if (filterStatus === 'paid' && !fully) return false;
            if (filterType !== 'all' && d.debt_type !== filterType) return false;
            if (filterStatus === 'open' && left <= 0 && d.amount > 0) return false;
            return true;
        });
    }, [debts, filterStatus, filterType]);

    const totals = useMemo(() => {
        const open = debts.filter(
            (d) => !expenseIsFullyPaid(d.amount, d.paid_amount) && !d.is_paid
        );
        const total = debts.reduce((a, d) => a + d.amount, 0);
        const paid = debts.reduce((a, d) => a + Math.min(d.paid_amount, d.amount), 0);
        const remaining = debts.reduce(
            (a, d) => a + expenseRemaining(d.amount, d.paid_amount),
            0
        );
        const openCount = open.length;
        return { total, paid, remaining, openCount };
    }, [debts]);

    const addDebt = async () => {
        const name = draftName.trim() || debtTypeLabel(draftType);
        const amount = parseMoney(draftAmount);
        if (amount <= 0) {
            setError('Borç tutarı gir.');
            return;
        }
        let paid = parseMoney(draftPaidAmount);
        if (paid > amount) paid = amount;
        const fully = expenseIsFullyPaid(amount, paid);
        setBusy(true);
        setError(null);
        const { error: insErr } = await supabase.from(PF_DEBTS).insert([
            {
                name,
                debt_type: draftType,
                creditor: draftCreditor.trim(),
                amount,
                paid_amount: paid,
                due_date: draftDue || null,
                is_paid: fully,
                note: draftNote.trim(),
                sort_order: debts.length
            }
        ]);
        if (insErr) {
            setError(insErr.message);
            setBusy(false);
            return;
        }
        setDraftName('');
        setDraftCreditor('');
        setDraftAmount('');
        setDraftPaidAmount('');
        setDraftDue('');
        setDraftNote('');
        setStatus('Borç eklendi');
        setBusy(false);
        await load();
    };

    const updateRow = async (
        id: string,
        patch: Partial<{
            name: string;
            debt_type: string;
            creditor: string;
            amount: number;
            paid_amount: number;
            due_date: string | null;
            is_paid: boolean;
            note: string;
        }>
    ) => {
        const { error: uErr } = await supabase.from(PF_DEBTS).update(patch).eq('id', id);
        if (uErr) {
            setError(uErr.message);
            return;
        }
        setDebts((prev) =>
            prev.map((r) => {
                if (r.id !== id) return r;
                const next = { ...r, ...patch };
                if (patch.due_date !== undefined) next.due_date = patch.due_date;
                next.is_paid =
                    patch.is_paid !== undefined
                        ? patch.is_paid
                        : expenseIsFullyPaid(next.amount, next.paid_amount);
                return next;
            })
        );
    };

    const persistAmountPaid = (row: PersonalDebtRow, amount: number, paid: number) => {
        let paidClamped = Math.max(0, paid);
        if (paidClamped > amount) paidClamped = amount;
        const fully = expenseIsFullyPaid(amount, paidClamped);
        setDebts((prev) =>
            prev.map((r) =>
                r.id === row.id
                    ? { ...r, amount, paid_amount: paidClamped, is_paid: fully }
                    : r
            )
        );
        void updateRow(row.id, {
            amount,
            paid_amount: paidClamped,
            is_paid: fully
        });
    };

    const removeRow = async (id: string) => {
        setBusy(true);
        const { error: dErr } = await supabase.from(PF_DEBTS).delete().eq('id', id);
        if (dErr) setError(dErr.message);
        setBusy(false);
        await load();
    };

    const draftAmt = parseMoney(draftAmount);
    const draftPaid = Math.min(parseMoney(draftPaidAmount), draftAmt || 0);
    const draftLeft = draftAmt > 0 ? expenseRemaining(draftAmt, draftPaid) : 0;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Scale className="w-6 h-6 text-primary" />
                        Borçlar
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Kredi kartı, kredi, icra gibi büyük borçlar.{' '}
                        <Link
                            href="/app/dashboard/personal-finance/expenses"
                            className="text-primary hover:underline"
                        >
                            Giderler
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
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        <option value="open">Açık</option>
                        <option value="all">Tümü</option>
                        <option value="paid">Kapalı</option>
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as FilterType)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        <option value="all">Tüm türler</option>
                        {DEBT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Toplam borç
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{fmtMoney(totals.total)}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Ödenen
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-primary">
                        {fmtMoney(totals.paid)}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Kalan
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {fmtMoney(totals.remaining)}
                    </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Açık kayıt
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{totals.openCount}</p>
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

            {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
                </div>
            ) : (
                <ul className="space-y-3">
                    {visible.length === 0 && (
                        <li className="text-sm text-muted-foreground">
                            Bu filtrede borç yok. Aşağıdan ekle.
                        </li>
                    )}
                    {visible.map((row) => {
                        const left = expenseRemaining(row.amount, row.paid_amount);
                        const fully =
                            expenseIsFullyPaid(row.amount, row.paid_amount) || row.is_paid;
                        return (
                            <li
                                key={row.id}
                                className={`rounded-lg border bg-background p-3 space-y-2 ${
                                    fully ? 'opacity-75' : ''
                                }`}
                            >
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Ad
                                        </label>
                                        <input
                                            value={row.name}
                                            onChange={(e) =>
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, name: e.target.value }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateRow(row.id, {
                                                    name: row.name.trim() || 'Borç'
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Tür
                                        </label>
                                        <select
                                            value={row.debt_type}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, debt_type: v }
                                                            : r
                                                    )
                                                );
                                                void updateRow(row.id, { debt_type: v });
                                            }}
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        >
                                            {DEBT_TYPES.map((t) => (
                                                <option key={t.value} value={t.value}>
                                                    {t.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Alacaklı / banka
                                        </label>
                                        <input
                                            value={row.creditor}
                                            onChange={(e) =>
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? {
                                                                  ...r,
                                                                  creditor: e.target.value
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateRow(row.id, {
                                                    creditor: row.creditor.trim()
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                            placeholder="Banka, icra dairesi…"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Tutar
                                        </label>
                                        <input
                                            value={String(row.amount)}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? {
                                                                  ...r,
                                                                  amount: parseMoney(
                                                                      e.target.value
                                                                  )
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                persistAmountPaid(
                                                    row,
                                                    row.amount,
                                                    row.paid_amount
                                                )
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Ödenen
                                        </label>
                                        <input
                                            value={String(row.paid_amount)}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? {
                                                                  ...r,
                                                                  paid_amount: parseMoney(
                                                                      e.target.value
                                                                  )
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                persistAmountPaid(
                                                    row,
                                                    row.amount,
                                                    row.paid_amount
                                                )
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Kalan
                                        </label>
                                        <p
                                            className={`rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-sm tabular-nums ${
                                                left > 0
                                                    ? 'text-amber-700 dark:text-amber-300'
                                                    : 'text-muted-foreground'
                                            }`}
                                        >
                                            {fmtMoney(left)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Son ödeme / vade
                                        </label>
                                        <input
                                            type="date"
                                            value={row.due_date ?? ''}
                                            onChange={(e) => {
                                                const v = e.target.value || null;
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, due_date: v }
                                                            : r
                                                    )
                                                );
                                                void updateRow(row.id, { due_date: v });
                                            }}
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] text-muted-foreground">
                                            Not
                                        </label>
                                        <input
                                            value={row.note}
                                            onChange={(e) =>
                                                setDebts((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, note: e.target.value }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateRow(row.id, {
                                                    note: row.note.trim()
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                            placeholder="Dosya no, taksit…"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <input
                                                type="checkbox"
                                                checked={fully}
                                                onChange={(e) => {
                                                    const v = e.target.checked;
                                                    persistAmountPaid(
                                                        row,
                                                        row.amount,
                                                        v ? row.amount : 0
                                                    );
                                                }}
                                            />
                                            Kapandı / ödendi
                                        </label>
                                        {row.paid_amount > 0 && left > 0 && (
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {fmtMoney(row.amount)} ·{' '}
                                                {fmtMoney(row.paid_amount)} ödendi ·{' '}
                                                {fmtMoney(left)} kaldı
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void removeRow(row.id)}
                                        className="p-1.5 text-muted-foreground hover:text-red-400"
                                        aria-label="Sil"
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
                <h2 className="text-sm font-semibold">Borç ekle</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <label className="text-[10px] text-muted-foreground">Ad</label>
                        <input
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="İhtiyaç kredisi, KK limiti…"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Tür</label>
                        <select
                            value={draftType}
                            onChange={(e) =>
                                setDraftType(
                                    e.target.value as (typeof DEBT_TYPES)[number]['value']
                                )
                            }
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        >
                            {DEBT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">
                            Alacaklı / banka
                        </label>
                        <input
                            value={draftCreditor}
                            onChange={(e) => setDraftCreditor(e.target.value)}
                            placeholder="Ziraat, icra…"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Tutar</label>
                        <input
                            value={draftAmount}
                            onChange={(e) => setDraftAmount(e.target.value)}
                            inputMode="decimal"
                            placeholder="50000"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Ödenen</label>
                        <input
                            value={draftPaidAmount}
                            onChange={(e) => setDraftPaidAmount(e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">
                            Son ödeme / vade
                        </label>
                        <input
                            type="date"
                            value={draftDue}
                            onChange={(e) => setDraftDue(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-[10px] text-muted-foreground">Not</label>
                        <input
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            placeholder="Dosya no, faiz, taksit bilgisi…"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                </div>
                {draftAmt > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                        Kalan:{' '}
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                            {fmtMoney(draftLeft)}
                        </span>
                    </p>
                )}
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addDebt()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> Ekle
                </button>
            </div>
        </div>
    );
}
