'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES_TR } from '@/lib/income-tax';
import {
    PF_EXPENSES,
    PF_INCOMES,
    expenseIsFullyPaid,
    expenseRemaining,
    fmtMoney,
    incomeBlocked,
    incomeUsable,
    mapExpense,
    parseMoney,
    type PersonalExpenseRow
} from '@/lib/personal-finance';

export default function PersonalExpensesPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [expenses, setExpenses] = useState<PersonalExpenseRow[]>([]);
    const [incomeTotal, setIncomeTotal] = useState(0);
    const [blockedTotal, setBlockedTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const [draftName, setDraftName] = useState('');
    const [draftAmount, setDraftAmount] = useState('');
    const [draftPaidAmount, setDraftPaidAmount] = useState('');
    const [draftDue, setDraftDue] = useState('');
    const [draftRepeat, setDraftRepeat] = useState(false);

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    const load = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const [expRes, incRes] = await Promise.all([
            supabase
                .from(PF_EXPENSES)
                .select('*')
                .eq('year', y)
                .eq('month', m)
                .order('sort_order')
                .order('created_at'),
            supabase
                .from(PF_INCOMES)
                .select('amount, blocked_amount')
                .eq('year', y)
                .eq('month', m)
        ]);

        if (expRes.error) {
            const msg = expRes.error.message;
            setError(
                msg.includes('does not exist') || expRes.error.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_personal_finance.sql çalıştırın.'
                    : msg.includes('paid_amount')
                      ? 'Parçalı ödeme alanı eksik. Supabase’te add_personal_expense_paid_amount.sql çalıştırın.'
                      : msg
            );
            setExpenses([]);
            setIncomeTotal(0);
            setBlockedTotal(0);
            setLoading(false);
            return;
        }

        setExpenses((expRes.data ?? []).map((r) => mapExpense(r as Record<string, unknown>)));
        if (!incRes.error) {
            let gross = 0;
            let blocked = 0;
            for (const r of incRes.data ?? []) {
                const amt = parseMoney(r.amount);
                gross += amt;
                blocked += incomeBlocked(amt, parseMoney(r.blocked_amount));
            }
            setIncomeTotal(gross);
            setBlockedTotal(blocked);
        } else if (incRes.error.message.includes('blocked_amount')) {
            setError(
                'Haciz bloke alanı eksik. Supabase’te add_personal_income_blocked_amount.sql çalıştırın.'
            );
            setIncomeTotal(0);
            setBlockedTotal(0);
        } else {
            setIncomeTotal(0);
            setBlockedTotal(0);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load(year, month);
    }, [year, month, load]);

    const expenseTotal = useMemo(
        () => expenses.reduce((a, r) => a + r.amount, 0),
        [expenses]
    );
    const unpaidTotal = useMemo(
        () =>
            expenses.reduce(
                (a, r) => a + expenseRemaining(r.amount, r.paid_amount),
                0
            ),
        [expenses]
    );
    const remaining = incomeUsable(incomeTotal, blockedTotal) - expenseTotal;

    const addExpense = async () => {
        const name = draftName.trim() || 'Gider';
        const amount = parseMoney(draftAmount);
        if (amount <= 0) {
            setError('Tutar gir.');
            return;
        }
        let paid = parseMoney(draftPaidAmount);
        if (paid > amount) paid = amount;
        const fully = expenseIsFullyPaid(amount, paid);
        setBusy(true);
        setError(null);
        const { error: insErr } = await supabase.from(PF_EXPENSES).insert([
            {
                year,
                month,
                name,
                amount,
                paid_amount: paid,
                due_date: draftDue || null,
                is_paid: fully,
                repeats_monthly: draftRepeat,
                note: '',
                sort_order: expenses.length + 1
            }
        ]);
        if (insErr) {
            setError(
                insErr.message.includes('paid_amount')
                    ? 'Parçalı ödeme alanı eksik. Supabase’te add_personal_expense_paid_amount.sql çalıştırın.'
                    : insErr.message
            );
            setBusy(false);
            return;
        }
        setDraftName('');
        setDraftAmount('');
        setDraftPaidAmount('');
        setDraftDue('');
        setDraftRepeat(false);
        setStatus('Gider eklendi');
        setBusy(false);
        await load(year, month);
    };

    const updateRow = async (
        id: string,
        patch: Partial<{
            name: string;
            amount: number;
            paid_amount: number;
            due_date: string | null;
            is_paid: boolean;
            repeats_monthly: boolean;
        }>
    ) => {
        const { error: uErr } = await supabase.from(PF_EXPENSES).update(patch).eq('id', id);
        if (uErr) {
            setError(
                uErr.message.includes('paid_amount')
                    ? 'Parçalı ödeme alanı eksik. Supabase’te add_personal_expense_paid_amount.sql çalıştırın.'
                    : uErr.message
            );
            return;
        }
        setExpenses((prev) =>
            prev.map((r) => {
                if (r.id !== id) return r;
                const next = {
                    ...r,
                    ...patch,
                    due_date: patch.due_date !== undefined ? patch.due_date : r.due_date
                };
                const amt = next.amount;
                const paid = next.paid_amount;
                next.is_paid =
                    patch.is_paid !== undefined
                        ? patch.is_paid
                        : expenseIsFullyPaid(amt, paid);
                return next;
            })
        );
    };

    const persistAmountPaid = (row: PersonalExpenseRow, amount: number, paid: number) => {
        let paidClamped = Math.max(0, paid);
        if (paidClamped > amount) paidClamped = amount;
        const fully = expenseIsFullyPaid(amount, paidClamped);
        setExpenses((prev) =>
            prev.map((r) =>
                r.id === row.id
                    ? {
                          ...r,
                          amount,
                          paid_amount: paidClamped,
                          is_paid: fully
                      }
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
        const { error: dErr } = await supabase.from(PF_EXPENSES).delete().eq('id', id);
        if (dErr) setError(dErr.message);
        setBusy(false);
        await load(year, month);
    };

    const copyRepeatingFromPrev = async () => {
        setBusy(true);
        setError(null);
        let py = year;
        let pm = month - 1;
        if (pm < 1) {
            pm = 12;
            py -= 1;
        }
        const { data, error: qErr } = await supabase
            .from(PF_EXPENSES)
            .select('*')
            .eq('year', py)
            .eq('month', pm)
            .eq('repeats_monthly', true);
        if (qErr) {
            setError(qErr.message);
            setBusy(false);
            return;
        }
        const existingNames = new Set(expenses.map((e) => e.name));
        const toInsert = (data ?? [])
            .map((r) => mapExpense(r as Record<string, unknown>))
            .filter((r) => !existingNames.has(r.name))
            .map((r, i) => ({
                year,
                month,
                name: r.name,
                amount: r.amount,
                paid_amount: 0,
                due_date: null,
                is_paid: false,
                repeats_monthly: true,
                note: r.note,
                sort_order: expenses.length + i + 1
            }));
        if (toInsert.length === 0) {
            setStatus('Aktarılacak tekrarlayan gider yok.');
            setBusy(false);
            return;
        }
        const { error: insErr } = await supabase.from(PF_EXPENSES).insert(toInsert);
        if (insErr) setError(insErr.message);
        else setStatus(`${toInsert.length} tekrarlayan gider kopyalandı.`);
        setBusy(false);
        await load(year, month);
    };

    const draftAmt = parseMoney(draftAmount);
    const draftPaid = Math.min(parseMoney(draftPaidAmount), draftAmt || Infinity);
    const draftLeft =
        draftAmt > 0 ? expenseRemaining(draftAmt, Number.isFinite(draftPaid) ? draftPaid : 0) : 0;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-primary" />
                        Giderler
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Kişisel giderlerini takip et.{' '}
                        <Link
                            href="/app/dashboard/personal-finance/income"
                            className="text-primary hover:underline"
                        >
                            Gelirler
                        </Link>
                    </p>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Gelir
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-primary">
                        {fmtMoney(incomeTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Haciz bloke
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {fmtMoney(blockedTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Gider
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-red-400">
                        {fmtMoney(expenseTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Kalan borç
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {fmtMoney(unpaidTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Kalan (kullanılabilir)
                    </p>
                    <p
                        className={`text-lg font-semibold tabular-nums ${
                            remaining >= 0 ? 'text-primary' : 'text-red-400'
                        }`}
                    >
                        {fmtMoney(remaining)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        Kullanılabilir gelir {fmtMoney(incomeUsable(incomeTotal, blockedTotal))}
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

            <button
                type="button"
                disabled={busy || loading}
                onClick={() => void copyRepeatingFromPrev()}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
            >
                Tekrarlayanları aktar
            </button>

            {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
                </div>
            ) : (
                <ul className="space-y-3">
                    {expenses.length === 0 && (
                        <li className="text-sm text-muted-foreground">
                            Bu ay henüz gider yok. Aşağıdan ekle.
                        </li>
                    )}
                    {expenses.map((row) => {
                        const left = expenseRemaining(row.amount, row.paid_amount);
                        const fully = expenseIsFullyPaid(row.amount, row.paid_amount);
                        return (
                            <li
                                key={row.id}
                                className={`rounded-lg border bg-background p-3 space-y-2 ${
                                    fully ? 'border-border opacity-80' : 'border-border'
                                }`}
                            >
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Ad
                                        </label>
                                        <input
                                            value={row.name}
                                            onChange={(e) =>
                                                setExpenses((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, name: e.target.value }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateRow(row.id, {
                                                    name: row.name.trim() || 'Gider'
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
                                                setExpenses((prev) =>
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
                                                setExpenses((prev) =>
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
                                            Son ödeme
                                        </label>
                                        <input
                                            type="date"
                                            value={row.due_date ?? ''}
                                            onChange={(e) => {
                                                const v = e.target.value || null;
                                                setExpenses((prev) =>
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
                                    <div className="flex flex-wrap items-end justify-between gap-2 pb-1">
                                        <div className="flex flex-wrap gap-3">
                                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    checked={fully}
                                                    onChange={(e) => {
                                                        const v = e.target.checked;
                                                        const paid = v ? row.amount : 0;
                                                        persistAmountPaid(
                                                            row,
                                                            row.amount,
                                                            paid
                                                        );
                                                    }}
                                                />
                                                Ödendi
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    checked={row.repeats_monthly}
                                                    onChange={(e) => {
                                                        const v = e.target.checked;
                                                        setExpenses((prev) =>
                                                            prev.map((r) =>
                                                                r.id === row.id
                                                                    ? {
                                                                          ...r,
                                                                          repeats_monthly: v
                                                                      }
                                                                    : r
                                                            )
                                                        );
                                                        void updateRow(row.id, {
                                                            repeats_monthly: v
                                                        });
                                                    }}
                                                />
                                                Tekrarla
                                            </label>
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
                                </div>
                                {row.paid_amount > 0 && left > 0 && (
                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                        {fmtMoney(row.amount)} borç · {fmtMoney(row.paid_amount)}{' '}
                                        ödendi · {fmtMoney(left)} kaldı
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <h2 className="text-sm font-semibold">Gider ekle</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <div>
                        <label className="text-[10px] text-muted-foreground">Ad</label>
                        <input
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Kira, fatura, borç…"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Tutar</label>
                        <input
                            value={draftAmount}
                            onChange={(e) => setDraftAmount(e.target.value)}
                            inputMode="decimal"
                            placeholder="4000"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Ödenen</label>
                        <input
                            value={draftPaidAmount}
                            onChange={(e) => setDraftPaidAmount(e.target.value)}
                            inputMode="decimal"
                            placeholder="2500"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Son ödeme</label>
                        <input
                            type="date"
                            value={draftDue}
                            onChange={(e) => setDraftDue(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div className="flex flex-wrap items-end gap-3 pb-1">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={draftRepeat}
                                onChange={(e) => setDraftRepeat(e.target.checked)}
                            />
                            Tekrarla (her ay)
                        </label>
                    </div>
                </div>
                {draftAmt > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                        Kalan:{' '}
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                            {fmtMoney(draftLeft)}
                        </span>
                        {parseMoney(draftPaidAmount) > 0 && (
                            <>
                                {' '}
                                ({fmtMoney(draftAmt)} −{' '}
                                {fmtMoney(
                                    Math.min(parseMoney(draftPaidAmount), draftAmt)
                                )}
                                )
                            </>
                        )}
                    </p>
                )}
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addExpense()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> Ekle
                </button>
            </div>
        </div>
    );
}
