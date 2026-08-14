'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, PiggyBank, Plus, Send, Sparkles, Trash2, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES_TR } from '@/lib/income-tax';
import { FinancePie, BUDGET_PIE_COLORS } from '@/components/panel/finance-pie';
import {
    BUDGET_LINE_TYPES,
    BUDGET_TEMPLATES,
    PF_BUDGET_LINES,
    PF_BUDGET_MONTHS,
    PF_DEBTS,
    PF_EXPENSES,
    PF_INCOMES,
    PF_SAVINGS_LEDGER,
    PF_SAVINGS_POTS,
    budgetLineTypeLabel,
    fmtMoney,
    incomeNetCash,
    lineRemaining,
    mapBudgetLine,
    mapBudgetMonth,
    mapDebt,
    mapExpense,
    mapIncome,
    mapSavingsPot,
    parseMoney,
    plannedAmount,
    type BudgetLineRow,
    type BudgetLineType,
    type BudgetMonthRow,
    type PersonalDebtRow,
    type PersonalExpenseRow,
    type PersonalIncomeRow,
    type SavingsPotRow
} from '@/lib/personal-finance';

export default function PersonalBudgetPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [incomes, setIncomes] = useState<PersonalIncomeRow[]>([]);
    const [lines, setLines] = useState<BudgetLineRow[]>([]);
    const [monthMeta, setMonthMeta] = useState<BudgetMonthRow | null>(null);
    const [pots, setPots] = useState<SavingsPotRow[]>([]);
    const [expenses, setExpenses] = useState<PersonalExpenseRow[]>([]);
    const [debts, setDebts] = useState<PersonalDebtRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const [draftName, setDraftName] = useState('');
    const [draftPercent, setDraftPercent] = useState('50');
    const [draftType, setDraftType] = useState<BudgetLineType>('savings');
    const [draftPotId, setDraftPotId] = useState('');

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    const load = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        const [incRes, lineRes, metaRes, potRes, expRes, debtRes] = await Promise.all([
            supabase.from(PF_INCOMES).select('*').eq('year', y).eq('month', m),
            supabase
                .from(PF_BUDGET_LINES)
                .select('*')
                .eq('year', y)
                .eq('month', m)
                .order('sort_order')
                .order('created_at'),
            supabase.from(PF_BUDGET_MONTHS).select('*').eq('year', y).eq('month', m).maybeSingle(),
            supabase
                .from(PF_SAVINGS_POTS)
                .select('*')
                .eq('is_archived', false)
                .order('sort_order'),
            supabase.from(PF_EXPENSES).select('*').eq('year', y).eq('month', m),
            supabase.from(PF_DEBTS).select('*').order('sort_order').limit(100)
        ]);

        if (incRes.error) {
            setError(
                incRes.error.message.includes('does not exist')
                    ? 'Tablo yok. Supabase’te create_personal_finance.sql çalıştırın.'
                    : incRes.error.message
            );
        }
        if (lineRes.error?.message?.includes('does not exist') || lineRes.error?.code === '42P01') {
            setError(
                'Bütçe tabloları yok. Supabase’te create_personal_budget_savings.sql çalıştırın.'
            );
        } else if (lineRes.error) {
            setError(lineRes.error.message);
        }

        setIncomes((incRes.data ?? []).map((r) => mapIncome(r as Record<string, unknown>)));
        setLines((lineRes.data ?? []).map((r) => mapBudgetLine(r as Record<string, unknown>)));
        setMonthMeta(
            metaRes.data ? mapBudgetMonth(metaRes.data as Record<string, unknown>) : null
        );
        setPots((potRes.data ?? []).map((r) => mapSavingsPot(r as Record<string, unknown>)));
        setExpenses((expRes.data ?? []).map((r) => mapExpense(r as Record<string, unknown>)));
        setDebts((debtRes.data ?? []).map((r) => mapDebt(r as Record<string, unknown>)));
        setLoading(false);
    }, []);

    useEffect(() => {
        void load(year, month);
    }, [year, month, load]);

    const grossTotal = useMemo(
        () => incomes.reduce((a, r) => a + r.amount, 0),
        [incomes]
    );
    const withheldTotal = useMemo(
        () => incomes.reduce((a, r) => a + Math.min(r.withheld_amount, r.amount), 0),
        [incomes]
    );
    const netIncome = useMemo(
        () => incomes.reduce((a, r) => a + incomeNetCash(r.amount, r.withheld_amount), 0),
        [incomes]
    );

    const baseAmount = useMemo(() => {
        if (monthMeta?.base_mode === 'manual') return monthMeta.manual_base;
        return netIncome;
    }, [monthMeta, netIncome]);

    const percentSum = useMemo(
        () => lines.reduce((a, r) => a + r.percent, 0),
        [lines]
    );
    const sentTotal = useMemo(
        () => lines.reduce((a, r) => a + r.sent_amount, 0),
        [lines]
    );
    const plannedTotal = useMemo(
        () => lines.reduce((a, r) => a + plannedAmount(baseAmount, r.percent), 0),
        [lines, baseAmount]
    );

    const planPie = useMemo(() => {
        const slices = lines.map((l) => ({
            name: l.name,
            value: plannedAmount(baseAmount, l.percent),
            color: BUDGET_PIE_COLORS[l.line_type] || BUDGET_PIE_COLORS.free
        }));
        const leftoverPct = Math.max(0, 100 - percentSum);
        if (leftoverPct > 0.05) {
            slices.push({
                name: 'Dağıtılmamış',
                value: plannedAmount(baseAmount, leftoverPct),
                color: BUDGET_PIE_COLORS.unallocated
            });
        }
        return slices;
    }, [lines, baseAmount, percentSum]);

    const cashPie = useMemo(
        () => [
            {
                name: 'Net nakit',
                value: netIncome,
                color: BUDGET_PIE_COLORS.net
            },
            {
                name: 'Bloke / haciz',
                value: withheldTotal,
                color: BUDGET_PIE_COLORS.withheld
            }
        ],
        [netIncome, withheldTotal]
    );

    const ensureMonthMeta = async (patch?: Partial<{
        base_mode: string;
        manual_base: number;
        note: string;
        is_closed: boolean;
    }>) => {
        const payload = {
            year,
            month,
            base_mode: patch?.base_mode ?? monthMeta?.base_mode ?? 'net_income',
            manual_base: patch?.manual_base ?? monthMeta?.manual_base ?? 0,
            note: patch?.note ?? monthMeta?.note ?? '',
            is_closed: patch?.is_closed ?? monthMeta?.is_closed ?? false,
            updated_at: new Date().toISOString()
        };
        const { data, error: uErr } = await supabase
            .from(PF_BUDGET_MONTHS)
            .upsert(payload, { onConflict: 'year,month' })
            .select('*')
            .single();
        if (uErr) throw new Error(uErr.message);
        setMonthMeta(mapBudgetMonth(data as Record<string, unknown>));
    };

    const applyTemplate = async (templateId: string) => {
        const tpl = BUDGET_TEMPLATES.find((t) => t.id === templateId);
        if (!tpl) return;
        setBusy(true);
        setError(null);
        if (lines.length > 0) {
            const { error: dErr } = await supabase
                .from(PF_BUDGET_LINES)
                .delete()
                .eq('year', year)
                .eq('month', month);
            if (dErr) {
                setError(dErr.message);
                setBusy(false);
                return;
            }
        }
        const defaultPot = pots[0]?.id ?? null;
        const rows = tpl.lines.map((l, i) => ({
            year,
            month,
            name: l.name,
            percent: l.percent,
            line_type: l.line_type,
            linked_savings_id: l.line_type === 'savings' ? defaultPot : null,
            sent_amount: 0,
            sort_order: i + 1,
            note: ''
        }));
        const { error: iErr } = await supabase.from(PF_BUDGET_LINES).insert(rows);
        if (iErr) setError(iErr.message);
        else setStatus(`Şablon uygulandı: ${tpl.label}`);
        setBusy(false);
        await load(year, month);
    };

    const addLine = async () => {
        const name = draftName.trim() || budgetLineTypeLabel(draftType);
        const percent = parseMoney(draftPercent);
        if (percent <= 0) {
            setError('Yüzde gir.');
            return;
        }
        setBusy(true);
        setError(null);
        const { error: iErr } = await supabase.from(PF_BUDGET_LINES).insert([
            {
                year,
                month,
                name,
                percent,
                line_type: draftType,
                linked_savings_id:
                    draftType === 'savings' ? draftPotId || pots[0]?.id || null : null,
                sent_amount: 0,
                sort_order: lines.length + 1,
                note: ''
            }
        ]);
        if (iErr) setError(iErr.message);
        else {
            setDraftName('');
            setDraftPercent('10');
            setStatus('Satır eklendi');
        }
        setBusy(false);
        await load(year, month);
    };

    const updateLine = async (id: string, patch: Record<string, unknown>) => {
        const { error: uErr } = await supabase.from(PF_BUDGET_LINES).update(patch).eq('id', id);
        if (uErr) {
            setError(uErr.message);
            return;
        }
        setLines((prev) =>
            prev.map((r) => (r.id === id ? mapBudgetLine({ ...r, ...patch }) : r))
        );
    };

    const removeLine = async (id: string) => {
        setBusy(true);
        const { error: dErr } = await supabase.from(PF_BUDGET_LINES).delete().eq('id', id);
        if (dErr) setError(dErr.message);
        setBusy(false);
        await load(year, month);
    };

    const sendAllocation = async (line: BudgetLineRow, mode: 'full' | 'remaining') => {
        if (monthMeta?.is_closed) {
            setError('Ay kapatılmış; gönderim yok.');
            return;
        }
        const planned = plannedAmount(baseAmount, line.percent);
        const amount =
            mode === 'full' ? Math.max(0, planned - line.sent_amount) : lineRemaining(baseAmount, line.percent, line.sent_amount);
        // full and remaining are same mathematically here; keep both buttons for UX clarity
        const sendAmt = amount;
        if (sendAmt <= 0) {
            setError('Gönderilecek kalan yok.');
            return;
        }

        setBusy(true);
        setError(null);
        setStatus(null);

        try {
            if (line.line_type === 'savings') {
                let potId = line.linked_savings_id;
                if (!potId) {
                    if (pots[0]) potId = pots[0].id;
                    else {
                        const { data: pot, error: pErr } = await supabase
                            .from(PF_SAVINGS_POTS)
                            .insert([{ name: 'Genel birikim', balance: 0, goal_amount: 0, sort_order: 1 }])
                            .select('*')
                            .single();
                        if (pErr) throw new Error(pErr.message);
                        potId = String(pot.id);
                    }
                    await supabase
                        .from(PF_BUDGET_LINES)
                        .update({ linked_savings_id: potId })
                        .eq('id', line.id);
                }

                const pot = pots.find((p) => p.id === potId);
                const newBal = (pot?.balance ?? 0) + sendAmt;
                const { error: uPot } = await supabase
                    .from(PF_SAVINGS_POTS)
                    .update({ balance: newBal, updated_at: new Date().toISOString() })
                    .eq('id', potId);
                if (uPot) throw new Error(uPot.message);

                const { error: ledErr } = await supabase.from(PF_SAVINGS_LEDGER).insert([
                    {
                        pot_id: potId,
                        amount: sendAmt,
                        year,
                        month,
                        budget_line_id: line.id,
                        note: `Bütçe · ${line.name}`
                    }
                ]);
                if (ledErr) throw new Error(ledErr.message);
            }

            if (line.line_type === 'expense' && line.linked_expense_id) {
                const exp = expenses.find((e) => e.id === line.linked_expense_id);
                if (exp) {
                    const paid = exp.paid_amount + sendAmt;
                    const { error: eErr } = await supabase
                        .from(PF_EXPENSES)
                        .update({
                            paid_amount: paid,
                            is_paid: paid >= exp.amount - 0.005
                        })
                        .eq('id', exp.id);
                    if (eErr) throw new Error(eErr.message);
                }
            }

            if (line.line_type === 'debt' && line.linked_debt_id) {
                const debt = debts.find((d) => d.id === line.linked_debt_id);
                if (debt) {
                    const paid = debt.paid_amount + sendAmt;
                    const { error: dErr } = await supabase
                        .from(PF_DEBTS)
                        .update({
                            paid_amount: paid,
                            is_paid: paid >= debt.amount - 0.005
                        })
                        .eq('id', debt.id);
                    if (dErr) throw new Error(dErr.message);
                }
            }

            const { error: sErr } = await supabase
                .from(PF_BUDGET_LINES)
                .update({ sent_amount: line.sent_amount + sendAmt })
                .eq('id', line.id);
            if (sErr) throw new Error(sErr.message);

            setStatus(`${line.name}: ${fmtMoney(sendAmt)} gönderildi`);
            await load(year, month);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gönderim başarısız');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-primary" />
                        Bütçe
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Net nakit (bloke/haciz düşülmüş) üzerinden yüzde dağıtımı.{' '}
                        <Link
                            href="/app/dashboard/personal-finance/income"
                            className="text-primary hover:underline"
                        >
                            Gelirler
                        </Link>
                        {' · '}
                        <Link
                            href="/app/dashboard/personal-finance/savings"
                            className="text-primary hover:underline"
                        >
                            Birikim
                        </Link>
                        {' · '}
                        <Link
                            href="/app/dashboard/assistant"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Asistan önerisi
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Brüt gelir
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{fmtMoney(grossTotal)}</p>
                </div>
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Bloke / haciz
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-orange-400">
                        {fmtMoney(withheldTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Net nakit (taban)
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-cyan-400">
                        {fmtMoney(baseAmount)}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Gönderilen / plan
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                        {fmtMoney(sentTotal)}
                        <span className="text-muted-foreground text-sm font-normal">
                            {' '}
                            / {fmtMoney(plannedTotal)}
                        </span>
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
                    <h2 className="text-sm font-semibold mb-1">Net vs kesinti</h2>
                    <FinancePie data={cashPie} emptyLabel="Gelir yok" />
                </div>
                <div className="rounded-lg border border-border p-4">
                    <h2 className="text-sm font-semibold mb-1">
                        Plan dağılımı ({percentSum.toFixed(0)}%)
                    </h2>
                    <FinancePie data={planPie} emptyLabel="Satır ekle veya şablon uygula" />
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground mr-1">Şablon:</span>
                {BUDGET_TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        disabled={busy || loading || monthMeta?.is_closed}
                        title={t.hint}
                        onClick={() => void applyTemplate(t.id)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                    >
                        {t.label}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        void ensureMonthMeta({
                            base_mode:
                                monthMeta?.base_mode === 'manual' ? 'net_income' : 'manual',
                            manual_base: monthMeta?.manual_base || netIncome
                        }).then(() => setStatus('Taban modu güncellendi'))
                    }
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                >
                    Taban: {monthMeta?.base_mode === 'manual' ? 'Manuel' : 'Net gelir'}
                </button>
                {monthMeta?.base_mode === 'manual' && (
                    <input
                        className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums"
                        value={String(monthMeta.manual_base)}
                        inputMode="decimal"
                        onChange={(e) =>
                            setMonthMeta((m) =>
                                m
                                    ? { ...m, manual_base: parseMoney(e.target.value) }
                                    : m
                            )
                        }
                        onBlur={() =>
                            void ensureMonthMeta({ manual_base: monthMeta.manual_base })
                        }
                    />
                )}
                <Link
                    href="/app/dashboard/assistant"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary/15 text-primary border border-primary/30 px-3 py-1.5 text-xs font-medium hover:bg-primary/25"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Asistana sor: bütçe öner
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
                </div>
            ) : (
                <ul className="space-y-3">
                    {lines.length === 0 && (
                        <li className="text-sm text-muted-foreground">
                            Bu ay bütçe satırı yok. Şablon uygula veya aşağıdan ekle.
                        </li>
                    )}
                    {lines.map((line) => {
                        const planned = plannedAmount(baseAmount, line.percent);
                        const remain = lineRemaining(baseAmount, line.percent, line.sent_amount);
                        return (
                            <li
                                key={line.id}
                                className="rounded-lg border border-border bg-background p-3 space-y-3"
                            >
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Ad
                                        </label>
                                        <input
                                            value={line.name}
                                            onChange={(e) =>
                                                setLines((prev) =>
                                                    prev.map((r) =>
                                                        r.id === line.id
                                                            ? { ...r, name: e.target.value }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateLine(line.id, {
                                                    name: line.name.trim() || 'Satır'
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            %
                                        </label>
                                        <input
                                            value={String(line.percent)}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setLines((prev) =>
                                                    prev.map((r) =>
                                                        r.id === line.id
                                                            ? {
                                                                  ...r,
                                                                  percent: parseMoney(
                                                                      e.target.value
                                                                  )
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateLine(line.id, {
                                                    percent: line.percent
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Tip
                                        </label>
                                        <select
                                            value={line.line_type}
                                            onChange={(e) =>
                                                void updateLine(line.id, {
                                                    line_type: e.target.value
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        >
                                            {BUDGET_LINE_TYPES.map((t) => (
                                                <option key={t.value} value={t.value}>
                                                    {t.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Plan / gönderilen
                                        </label>
                                        <p className="text-sm tabular-nums pt-1.5">
                                            {fmtMoney(planned)} ·{' '}
                                            <span className="text-muted-foreground">
                                                {fmtMoney(line.sent_amount)}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Kalan
                                        </label>
                                        <p className="text-sm font-semibold tabular-nums text-primary pt-1.5">
                                            {fmtMoney(remain)}
                                        </p>
                                    </div>
                                </div>

                                {line.line_type === 'savings' && (
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Birikim kasası
                                        </label>
                                        <select
                                            value={line.linked_savings_id ?? ''}
                                            onChange={(e) =>
                                                void updateLine(line.id, {
                                                    linked_savings_id: e.target.value || null
                                                })
                                            }
                                            className="mt-0.5 w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        >
                                            <option value="">Otomatik / ilk kasa</option>
                                            {pots.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({fmtMoney(p.balance)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {line.line_type === 'expense' && (
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Bağlı gider
                                        </label>
                                        <select
                                            value={line.linked_expense_id ?? ''}
                                            onChange={(e) =>
                                                void updateLine(line.id, {
                                                    linked_expense_id: e.target.value || null
                                                })
                                            }
                                            className="mt-0.5 w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        >
                                            <option value="">Bağlama</option>
                                            {expenses.map((e) => (
                                                <option key={e.id} value={e.id}>
                                                    {e.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {line.line_type === 'debt' && (
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Bağlı borç
                                        </label>
                                        <select
                                            value={line.linked_debt_id ?? ''}
                                            onChange={(e) =>
                                                void updateLine(line.id, {
                                                    linked_debt_id: e.target.value || null
                                                })
                                            }
                                            className="mt-0.5 w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        >
                                            <option value="">Bağlama</option>
                                            {debts
                                                .filter((d) => !d.is_paid)
                                                .map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2 justify-between">
                                    <button
                                        type="button"
                                        disabled={busy || remain <= 0 || monthMeta?.is_closed}
                                        onClick={() => void sendAllocation(line, 'remaining')}
                                        className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        Kalanı gönder ({fmtMoney(remain)})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void removeLine(line.id)}
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
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Satır ekle
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="text-[10px] text-muted-foreground">Ad</label>
                        <input
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Birikim, kira…"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Yüzde</label>
                        <input
                            value={draftPercent}
                            onChange={(e) => setDraftPercent(e.target.value)}
                            inputMode="decimal"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Tip</label>
                        <select
                            value={draftType}
                            onChange={(e) => setDraftType(e.target.value as BudgetLineType)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        >
                            {BUDGET_LINE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {draftType === 'savings' && (
                        <div>
                            <label className="text-[10px] text-muted-foreground">Kasa</label>
                            <select
                                value={draftPotId}
                                onChange={(e) => setDraftPotId(e.target.value)}
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            >
                                <option value="">İlk / otomatik</option>
                                {pots.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addLine()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                    <PiggyBank className="w-4 h-4" /> Ekle
                </button>
            </div>
        </div>
    );
}
