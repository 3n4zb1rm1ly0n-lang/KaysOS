'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    DEFAULT_2026_BRACKETS,
    MONTH_NAMES_TR,
    SALES_VAT_RATE,
    TEVFIKAT_OF_VAT_PERCENT,
    buildPaymentCalendar,
    cumulativeMonthlyTaxSchedule,
    expenseBreakdown,
    isTaxLikeExpenseName,
    monthlyCashNet,
    monthlyTaxableBase,
    salesFromGrossInclusive,
    yearEndInstallments,
    type TaxBracket
} from '@/lib/income-tax';

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(raw: unknown): number {
    if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : 0;
    const t = String(raw ?? '')
        .trim()
        .replace(/\s/g, '')
        .replace(',', '.');
    if (!t) return 0;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

type ExpenseRow = {
    name: string;
    amount_gross: number;
    kdv_rate: number;
    include_in_deductible_kdv: boolean;
    include_in_cash_flow: boolean;
    source: string;
};

type MonthLoaded = {
    month: number;
    hasRecord: boolean;
    gross: number;
    netRevenue: number;
    salesVat: number;
    tevfikat: number;
    expenseNetTotal: number;
    taxExpenseNet: number;
    totalDeductible: number;
    kdvPaid: number;
    kdvBalance: number;
    base: number;
    cashNet: number;
};

export default function TaxesPage() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [months, setMonths] = useState<MonthLoaded[]>([]);
    const [brackets, setBrackets] = useState<TaxBracket[]>(DEFAULT_2026_BRACKETS);

    const load = useCallback(async (y: number) => {
        setLoading(true);
        setError(null);

        const [entriesRes, bracketsRes] = await Promise.all([
            supabase
                .from('company_finance_monthly_entries')
                .select('*')
                .eq('year', y)
                .order('month'),
            supabase
                .from('company_finance_income_tax_brackets')
                .select('*')
                .eq('year', y)
                .order('sort_order')
        ]);

        if (entriesRes.error) {
            setError(entriesRes.error.message);
            setLoading(false);
            return;
        }

        const entries = entriesRes.data ?? [];
        const entryIds = entries.map((e) => e.id as string);
        const expensesByEntry: Record<string, ExpenseRow[]> = {};

        if (entryIds.length > 0) {
            let expRows: Array<{
                monthly_entry_id: string;
                name: unknown;
                amount_gross: unknown;
                kdv_rate: unknown;
                include_in_deductible_kdv: unknown;
                include_in_cash_flow?: unknown;
                source?: unknown;
            }> = [];

            const full = await supabase
                .from('company_finance_monthly_expenses')
                .select(
                    'monthly_entry_id, name, amount_gross, kdv_rate, include_in_deductible_kdv, include_in_cash_flow, source'
                )
                .in('monthly_entry_id', entryIds);

            if (!full.error && full.data) {
                expRows = full.data;
            } else {
                const msg = full.error?.message ?? '';
                const withSource = await supabase
                    .from('company_finance_monthly_expenses')
                    .select(
                        'monthly_entry_id, name, amount_gross, kdv_rate, include_in_deductible_kdv, source'
                    )
                    .in('monthly_entry_id', entryIds);

                if (!withSource.error && withSource.data) {
                    expRows = withSource.data.map((r) => ({
                        ...r,
                        include_in_cash_flow: true
                    }));
                } else {
                    const basic = await supabase
                        .from('company_finance_monthly_expenses')
                        .select(
                            'monthly_entry_id, name, amount_gross, kdv_rate, include_in_deductible_kdv'
                        )
                        .in('monthly_entry_id', entryIds);
                    if (basic.error) {
                        setError(
                            msg.includes('include_in_cash_flow') || msg.includes('source')
                                ? basic.error.message
                                : full.error?.message || basic.error.message
                        );
                        setLoading(false);
                        return;
                    }
                    expRows = (basic.data ?? []).map((r) => ({
                        ...r,
                        source: '',
                        include_in_cash_flow: true
                    }));
                }
            }

            for (const row of expRows) {
                const eid = String(row.monthly_entry_id);
                if (!expensesByEntry[eid]) expensesByEntry[eid] = [];
                expensesByEntry[eid].push({
                    name: String(row.name ?? ''),
                    amount_gross: parseMoney(row.amount_gross),
                    kdv_rate: parseMoney(row.kdv_rate),
                    include_in_deductible_kdv: row.include_in_deductible_kdv !== false,
                    include_in_cash_flow: row.include_in_cash_flow !== false,
                    source: row.source ? String(row.source) : ''
                });
            }
        }

        const br =
            !bracketsRes.error && bracketsRes.data && bracketsRes.data.length > 0
                ? bracketsRes.data.map((b) => ({
                      min_amount: Number(b.min_amount) || 0,
                      max_amount: b.max_amount == null ? null : Number(b.max_amount),
                      rate_percent: Number(b.rate_percent) || 0
                  }))
                : DEFAULT_2026_BRACKETS;

        setBrackets(br);

        const byMonth = new Map(
            entries.map((e) => [Number(e.month), e] as const)
        );

        const loaded: MonthLoaded[] = Array.from({ length: 12 }, (_, idx) => {
            const month = idx + 1;
            const e = byMonth.get(month);
            if (!e) {
                return {
                    month,
                    hasRecord: false,
                    gross: 0,
                    netRevenue: 0,
                    salesVat: 0,
                    tevfikat: 0,
                    expenseNetTotal: 0,
                    taxExpenseNet: 0,
                    totalDeductible: 0,
                    kdvPaid: 0,
                    kdvBalance: 0,
                    base: 0,
                    cashNet: 0
                };
            }

            const expenses = expensesByEntry[e.id as string] ?? [];
            const gross = parseMoney(e.gross_amount);
            const sales = salesFromGrossInclusive(gross, SALES_VAT_RATE);
            let expenseNetTotal = 0;
            let expenseCashNet = 0;
            let expenseKdvIncluded = 0;
            let taxExpenseNet = 0;
            for (const ex of expenses) {
                const bd = expenseBreakdown(ex.amount_gross, ex.kdv_rate);
                expenseNetTotal += bd.amountNet;
                if (ex.include_in_cash_flow) expenseCashNet += bd.amountNet;
                if (ex.include_in_deductible_kdv) expenseKdvIncluded += bd.kdvAmount;
                if (isTaxLikeExpenseName(ex.name, ex.source)) {
                    taxExpenseNet += bd.amountNet;
                }
            }
            const manualDeductible = parseMoney(e.kdv_deductible);
            const kdvPaid = parseMoney(e.kdv_paid);
            const totalDeductible = manualDeductible + expenseKdvIncluded;
            const kdvBalance = sales.salesVat - totalDeductible - kdvPaid;
            const base = monthlyTaxableBase(sales.netRevenue, expenseNetTotal);

            return {
                month,
                hasRecord: true,
                gross,
                netRevenue: sales.netRevenue,
                salesVat: sales.salesVat,
                tevfikat: sales.tevfikat,
                expenseNetTotal,
                taxExpenseNet,
                totalDeductible,
                kdvPaid,
                kdvBalance,
                base,
                cashNet: monthlyCashNet(
                    sales.netRevenue,
                    sales.tevfikat,
                    expenseCashNet
                )
            };
        });

        setMonths(loaded);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load(year);
    }, [year, load]);

    const schedule = useMemo(
        () =>
            cumulativeMonthlyTaxSchedule(
                months.map((m) => m.base),
                months.map((m) => m.tevfikat),
                brackets
            ),
        [months, brackets]
    );

    const paymentCalendar = useMemo(() => {
        const monthlyKdvDue = months.map((m) =>
            Math.max(0, m.salesVat - m.totalDeductible)
        );
        return buildPaymentCalendar(year, monthlyKdvDue, schedule);
    }, [months, schedule, year]);

    const geciciByMonth = useMemo(() => {
        const map: Record<number, number> = {};
        for (const row of paymentCalendar) {
            if (row.geciciNo != null && !row.isYearEnd) {
                // periodLabel like "Mart 2026" — match month index from GECICI
                const m = MONTH_NAMES_TR.findIndex((n) => row.periodLabel.startsWith(n));
                if (m >= 0) map[m + 1] = row.incomeDue;
            }
        }
        return map;
    }, [paymentCalendar]);

    const yearEnd = useMemo(() => {
        const row = paymentCalendar.find((r) => r.isYearEnd);
        return row?.incomeDue ?? 0;
    }, [paymentCalendar]);

    const totals = useMemo(() => {
        const withData = months.filter((m) => m.hasRecord);
        return {
            salesVat: withData.reduce((a, m) => a + m.salesVat, 0),
            kdvPaid: withData.reduce((a, m) => a + m.kdvPaid, 0),
            kdvDue: withData.reduce((a, m) => a + Math.max(0, m.kdvBalance), 0),
            tevfikat: schedule.cumulativeTevfikat,
            taxExpense: withData.reduce((a, m) => a + m.taxExpenseNet, 0),
            gv: schedule.cumulativeGv,
            gvDue: schedule.gvDueAfterTevfikat,
            cashNet: withData.reduce((a, m) => a + m.cashNet, 0)
        };
    }, [months, schedule]);

    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2 text-primary">
                        <FileText className="h-5 w-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            Operasyonel
                        </span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Vergiler</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Aylık kazançtan gelen KDV, tevfikat ve gelir vergisi — ay ay ödenecek net
                        görünüm. Veri kaynağı:{' '}
                        <Link
                            href="/app/dashboard/company-finance/monthly"
                            className="text-primary underline-offset-2 hover:underline"
                        >
                            Aylık kazanç
                        </Link>
                        .
                    </p>
                </div>
                <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Yıl</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : (
                <>
                    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Kpi
                            label="Satış KDV (yıl)"
                            value={fmtMoney(totals.salesVat)}
                            hint={`Tevfikat %${TEVFIKAT_OF_VAT_PERCENT} → ${fmtMoney(totals.tevfikat)}`}
                        />
                        <Kpi
                            label="Ödenecek KDV (bakiye+)"
                            value={fmtMoney(totals.kdvDue)}
                            hint={`Ödenen ${fmtMoney(totals.kdvPaid)}`}
                            emphasize
                        />
                        <Kpi
                            label="GV (kümülatif)"
                            value={fmtMoney(totals.gv)}
                            hint={`Tevfikat sonrası ${fmtMoney(totals.gvDue)}`}
                        />
                        <Kpi
                            label="Vergi gider (işaretli)"
                            value={fmtMoney(totals.taxExpense)}
                            hint="Adında vergi/KDV veya source=tax"
                        />
                    </section>

                    <section className="overflow-hidden rounded-xl border border-border">
                        <div className="border-b border-border bg-secondary/20 px-4 py-3">
                            <h2 className="text-sm font-semibold">Aylık vergi özeti</h2>
                            <p className="text-xs text-muted-foreground">
                                Ödenecek KDV = satış KDV − indirilecek − ödenen. Net vergi =
                                ödenecek KDV + geçici (varsa) − gider olarak yazılan vergi. “Bu ay
                                GV” tahakkuk; peşin ödeme tevfikat / geçici ile mahsup edilir.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[960px] text-sm">
                                <thead className="text-xs text-muted-foreground">
                                    <tr className="border-b border-border">
                                        <th className="px-3 py-2 text-left font-medium">Ay</th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Satış KDV
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Tevfikat
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Ödenen KDV
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Ödenecek KDV
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Bu ay GV
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Geçici
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Vergi gider
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Net vergi
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Nakit
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {months.map((m) => {
                                        const cum = schedule.months[m.month - 1];
                                        const kdvDue = Math.max(0, m.kdvBalance);
                                        const monthGv = cum?.monthGvDelta ?? 0;
                                        const gecici = geciciByMonth[m.month] ?? 0;
                                        // Nakit çıkışı: ödenecek KDV + geçici (varsa) − gider yazılan vergi
                                        const netTax = Math.max(
                                            0,
                                            kdvDue + gecici - m.taxExpenseNet
                                        );
                                        if (!m.hasRecord) {
                                            return (
                                                <tr
                                                    key={m.month}
                                                    className="text-muted-foreground/60"
                                                >
                                                    <td className="px-3 py-2 font-medium">
                                                        {MONTH_NAMES_TR[m.month - 1]}
                                                    </td>
                                                    <td
                                                        colSpan={9}
                                                        className="px-3 py-2 text-xs"
                                                    >
                                                        Kayıt yok
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return (
                                            <tr key={m.month}>
                                                <td className="px-3 py-2 font-medium">
                                                    {MONTH_NAMES_TR[m.month - 1]}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {fmtMoney(m.salesVat)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {fmtMoney(m.tevfikat)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {fmtMoney(m.kdvPaid)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {fmtMoney(kdvDue)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {fmtMoney(monthGv)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {gecici > 0 ? fmtMoney(gecici) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                                    {m.taxExpenseNet > 0
                                                        ? `−${fmtMoney(m.taxExpenseNet)}`
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums">
                                                    {fmtMoney(netTax)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-primary">
                                                    {fmtMoney(m.cashNet)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-border bg-secondary/15 text-sm font-medium">
                                        <td className="px-3 py-2">Yıl</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(totals.salesVat)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(totals.tevfikat)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(totals.kdvPaid)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(totals.kdvDue)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(totals.gv)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            —
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {totals.taxExpense > 0
                                                ? `−${fmtMoney(totals.taxExpense)}`
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(
                                                Math.max(
                                                    0,
                                                    totals.kdvDue +
                                                        totals.gvDue -
                                                        totals.taxExpense
                                                )
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-primary">
                                            {fmtMoney(totals.cashNet)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    {yearEnd > 0 && (
                        <p className="text-sm text-muted-foreground">
                            Yıllık beyanname kalan GV (geçici + tevfikat mahsubu sonrası):{' '}
                            <span className="font-medium text-foreground">
                                {fmtMoney(yearEnd)}
                            </span>
                            {' · '}
                            {fmtMoney(yearEndInstallments(yearEnd).march)} × 2 taksit (Mart /
                            Temmuz {year + 1})
                        </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Planlı taksitler (KDV/MTV vb. taksitlendirme) için{' '}
                        <Link
                            href="/app/dashboard/company-finance/vergi-taksit"
                            className="text-primary underline-offset-2 hover:underline"
                        >
                            Vergi taksit
                        </Link>{' '}
                        sayfasına bak.
                    </p>
                </>
            )}
        </div>
    );
}

function Kpi({
    label,
    value,
    hint,
    emphasize
}: {
    label: string;
    value: string;
    hint?: string;
    emphasize?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border px-4 py-3 ${
                emphasize ? 'border-primary/40 bg-primary/5' : 'border-border'
            }`}
        >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}
