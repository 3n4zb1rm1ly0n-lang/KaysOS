'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    DEFAULT_2026_BRACKETS,
    MONTH_NAMES_TR,
    SALES_VAT_RATE,
    expenseBreakdown,
    type TaxBracket
} from '@/lib/income-tax';
import {
    EXPENSE_VAT_RATES,
    type ExpenseVatRate,
    simulateReceiptTarget
} from '@/lib/receipt-target-sim';

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(raw: string): number {
    const t = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return 0;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

type SourceMode = 'manual' | 'monthly';

/** Aylık kazanç formundan canlı veri (kayıt edilmemiş draft dahil) */
export type ReceiptSimEmbed = {
    year: number;
    monthIndex: number;
    grossInput: string;
    kdvPaid: number;
    manualDeductible: number;
    expenseNet: number;
    expenseDeductibleKdv: number;
};

export type ReceiptTargetSimProps = {
    embed?: ReceiptSimEmbed;
};

export function ReceiptTargetSim({ embed }: ReceiptTargetSimProps = {}) {
    const now = new Date();
    const embedded = Boolean(embed);
    const [source, setSource] = useState<SourceMode>(embedded ? 'monthly' : 'manual');
    const [year, setYear] = useState(embed?.year ?? now.getFullYear());
    const [monthIndex, setMonthIndex] = useState(embed?.monthIndex ?? now.getMonth());
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [monthStatus, setMonthStatus] = useState<string | null>(null);

    const [grossInput, setGrossInput] = useState(embed?.grossInput ?? '');
    const [expenseRate, setExpenseRate] = useState<ExpenseVatRate>(20);
    const [targetKdv, setTargetKdv] = useState('');
    const [targetMode, setTargetMode] = useState<'base' | 'tax' | 'none'>('none');
    const [targetBase, setTargetBase] = useState('');
    const [targetTax, setTargetTax] = useState('');

    const [existingDeductible, setExistingDeductible] = useState(0);
    const [existingExpenseNet, setExistingExpenseNet] = useState(0);
    const [existingKdvPaid, setExistingKdvPaid] = useState(0);
    const [brackets, setBrackets] = useState<TaxBracket[]>(DEFAULT_2026_BRACKETS);
    /** Embed’de brüt formdan koptuysa true */
    const [grossDirty, setGrossDirty] = useState(false);

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    const loadBrackets = useCallback(async (y: number) => {
        const { data } = await supabase
            .from('company_finance_income_tax_brackets')
            .select('min_amount, max_amount, rate_percent')
            .eq('year', y)
            .order('sort_order');
        if (data && data.length > 0) {
            setBrackets(
                data.map((b) => ({
                    min_amount: Number(b.min_amount) || 0,
                    max_amount: b.max_amount == null ? null : Number(b.max_amount),
                    rate_percent: Number(b.rate_percent) || 0
                }))
            );
        } else {
            setBrackets(DEFAULT_2026_BRACKETS);
        }
    }, []);

    // Embed: formdaki canlı değerleri senkronla
    useEffect(() => {
        if (!embed) return;
        setYear(embed.year);
        setMonthIndex(embed.monthIndex);
        setSource('monthly');
        if (!grossDirty) {
            setGrossInput(embed.grossInput);
        }
        const deductible = embed.manualDeductible + embed.expenseDeductibleKdv;
        setExistingDeductible(deductible);
        setExistingExpenseNet(embed.expenseNet);
        setExistingKdvPaid(embed.kdvPaid);
        setMonthStatus(
            `${MONTH_NAMES_TR[embed.monthIndex]} ${embed.year} · formdaki brüt/gider ile · net gider ${fmtMoney(embed.expenseNet)} · indirilecek KDV ${fmtMoney(deductible)}`
        );
        void loadBrackets(embed.year);
    }, [embed, grossDirty, loadBrackets]);

    // Ay değişince embed’de brüt kilidini sıfırla
    useEffect(() => {
        if (embed) setGrossDirty(false);
    }, [embed?.year, embed?.monthIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const pullMonthly = useCallback(async () => {
        if (embedded) return;
        setLoadingMonth(true);
        setMonthStatus(null);
        const month = monthIndex + 1;

        await loadBrackets(year);

        const { data: entry, error } = await supabase
            .from('company_finance_monthly_entries')
            .select('id, gross_amount, kdv_paid, kdv_deductible')
            .eq('year', year)
            .eq('month', month)
            .maybeSingle();

        if (error) {
            setMonthStatus(error.message);
            setLoadingMonth(false);
            return;
        }

        if (!entry) {
            setGrossInput('');
            setExistingDeductible(0);
            setExistingExpenseNet(0);
            setExistingKdvPaid(0);
            setMonthStatus(
                `${MONTH_NAMES_TR[monthIndex]} ${year} için aylık kayıt yok — brütü elle girebilirsin.`
            );
            setLoadingMonth(false);
            return;
        }

        const gross = Number(entry.gross_amount) || 0;
        setGrossInput(gross ? String(gross) : '');
        setExistingKdvPaid(Number(entry.kdv_paid) || 0);
        let deductible = Number(entry.kdv_deductible) || 0;
        let expenseNet = 0;

        const { data: expenses } = await supabase
            .from('company_finance_monthly_expenses')
            .select('amount_gross, kdv_rate, include_in_deductible_kdv')
            .eq('monthly_entry_id', entry.id);

        for (const ex of expenses ?? []) {
            const bd = expenseBreakdown(
                Number(ex.amount_gross) || 0,
                Number(ex.kdv_rate) || 0
            );
            expenseNet += bd.amountNet;
            if (ex.include_in_deductible_kdv !== false) {
                deductible += bd.kdvAmount;
            }
        }

        setExistingDeductible(deductible);
        setExistingExpenseNet(expenseNet);
        setMonthStatus(
            `${MONTH_NAMES_TR[monthIndex]} ${year} yüklendi · mevcut gider net ${fmtMoney(expenseNet)} · indirilecek KDV ${fmtMoney(deductible)}`
        );
        setLoadingMonth(false);
    }, [year, monthIndex, loadBrackets, embedded]);

    useEffect(() => {
        if (!embedded && source === 'monthly') {
            void pullMonthly();
        }
    }, [source, year, monthIndex, pullMonthly, embedded]);

    const result = useMemo(() => {
        const gross = parseMoney(grossInput);
        return simulateReceiptTarget({
            grossInclusive: gross,
            salesVatRate: SALES_VAT_RATE,
            expenseVatRate: expenseRate,
            existingDeductibleVat: existingDeductible,
            existingExpenseNet: existingExpenseNet,
            existingKdvPaid: existingKdvPaid,
            targetPayableKdv: targetKdv.trim() === '' ? null : parseMoney(targetKdv),
            targetTaxableBase:
                targetMode === 'base' && targetBase.trim() !== ''
                    ? parseMoney(targetBase)
                    : null,
            targetIncomeTax:
                targetMode === 'tax' && targetTax.trim() !== ''
                    ? parseMoney(targetTax)
                    : null,
            brackets
        });
    }, [
        grossInput,
        expenseRate,
        existingDeductible,
        existingExpenseNet,
        existingKdvPaid,
        targetKdv,
        targetMode,
        targetBase,
        targetTax,
        brackets
    ]);

    const hasTarget =
        targetKdv.trim() !== '' ||
        (targetMode === 'base' && targetBase.trim() !== '') ||
        (targetMode === 'tax' && targetTax.trim() !== '');

    return (
        <section className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-start gap-2 border-b border-border bg-secondary/20 px-4 py-3">
                <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                    <h3 className="text-sm font-semibold">
                        {embedded
                            ? `Bu ay için fiş önerisi — ${MONTH_NAMES_TR[monthIndex]} ${year}`
                            : 'Fiş hedefi simülasyonu'}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {embedded
                            ? 'Üstteki brüt ve giderler canlı alınır. Hedef KDV / matrah gir; toplanacak fiş tutarını gör.'
                            : 'Brüt ciroyu yaz veya aylık kazançtan çek; ödemek istediğin KDV / matrah (veya GV) için toplanacak fiş tutarını gör.'}
                    </p>
                </div>
            </div>

            <div className="space-y-4 p-4">
                {!embedded && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSource('manual')}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                source === 'manual'
                                    ? 'border-primary/50 bg-primary/10 text-primary'
                                    : 'border-border hover:bg-secondary/40'
                            }`}
                        >
                            Elle gir
                        </button>
                        <button
                            type="button"
                            onClick={() => setSource('monthly')}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                source === 'monthly'
                                    ? 'border-primary/50 bg-primary/10 text-primary'
                                    : 'border-border hover:bg-secondary/40'
                            }`}
                        >
                            Aylık kazançtan
                        </button>
                        {source === 'monthly' && (
                            <button
                                type="button"
                                disabled={loadingMonth}
                                onClick={() => void pullMonthly()}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary/40 disabled:opacity-50"
                            >
                                {loadingMonth ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : null}
                                Yenile
                            </button>
                        )}
                    </div>
                )}

                {!embedded && source === 'monthly' && (
                    <div className="flex flex-wrap gap-3">
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Yıl</span>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Ay</span>
                            <select
                                value={monthIndex}
                                onChange={(e) => setMonthIndex(Number(e.target.value))}
                                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                {MONTH_NAMES_TR.map((label, i) => (
                                    <option key={label} value={i}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}

                {monthStatus && (
                    <p className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        {monthStatus}{' '}
                        {!embedded && source === 'monthly' && (
                            <Link
                                href="/app/dashboard/company-finance/monthly"
                                className="text-primary underline-offset-2 hover:underline"
                            >
                                Aylık kazanç →
                            </Link>
                        )}
                        {embedded && grossDirty && (
                            <button
                                type="button"
                                className="ml-2 text-primary underline-offset-2 hover:underline"
                                onClick={() => {
                                    setGrossDirty(false);
                                    if (embed) setGrossInput(embed.grossInput);
                                }}
                            >
                                Formdaki brüte dön
                            </button>
                        )}
                    </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm sm:col-span-2">
                        <span className="text-xs text-muted-foreground">
                            Brüt ciro (KDV dahil) — düzenlenebilir
                        </span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={grossInput}
                            onChange={(e) => {
                                setGrossInput(e.target.value);
                                if (embedded) setGrossDirty(true);
                            }}
                            placeholder="132000"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>

                    <div className="space-y-1 rounded-lg border border-border/70 bg-secondary/10 px-3 py-2 text-xs sm:col-span-2">
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Net ciro</span>
                            <span className="font-medium tabular-nums">
                                {fmtMoney(result.netRevenue)}
                            </span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">
                                Satış KDV (%{SALES_VAT_RATE})
                            </span>
                            <span className="tabular-nums">{fmtMoney(result.salesVat)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Tevfikat</span>
                            <span className="tabular-nums">{fmtMoney(result.tevfikat)}</span>
                        </div>
                        {(existingDeductible > 0 ||
                            existingExpenseNet > 0 ||
                            existingKdvPaid > 0) && (
                            <div className="space-y-1 border-t border-border/50 pt-1">
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">
                                        Mevcut indirilecek KDV
                                    </span>
                                    <span className="tabular-nums">
                                        {fmtMoney(existingDeductible)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">
                                        Mevcut gider (net)
                                    </span>
                                    <span className="tabular-nums">
                                        {fmtMoney(existingExpenseNet)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Ödenen KDV</span>
                                    <span className="tabular-nums">
                                        {fmtMoney(existingKdvPaid)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <label className="space-y-1 text-sm sm:col-span-2">
                        <span className="text-xs text-muted-foreground">
                            Fiş / gider KDV oranı
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {EXPENSE_VAT_RATES.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setExpenseRate(r)}
                                    className={`rounded-lg border px-3 py-2 text-sm tabular-nums ${
                                        expenseRate === r
                                            ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                                            : 'border-border hover:bg-secondary/40'
                                    }`}
                                >
                                    %{r}
                                </button>
                            ))}
                        </div>
                    </label>

                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">
                            Hedef ödenecek KDV (₺)
                        </span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={targetKdv}
                            onChange={(e) => setTargetKdv(e.target.value)}
                            placeholder="örn. 5000"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>

                    <div className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Matrah / GV hedefi</span>
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {(
                                [
                                    ['none', 'Yok'],
                                    ['base', 'Matrah'],
                                    ['tax', 'GV tutarı']
                                ] as const
                            ).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setTargetMode(id)}
                                    className={`rounded-md border px-2 py-1 text-[11px] ${
                                        targetMode === id
                                            ? 'border-primary/50 bg-primary/10 text-primary'
                                            : 'border-border hover:bg-secondary/40'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {targetMode === 'base' && (
                            <input
                                type="text"
                                inputMode="decimal"
                                value={targetBase}
                                onChange={(e) => setTargetBase(e.target.value)}
                                placeholder="Hedef matrah"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        )}
                        {targetMode === 'tax' && (
                            <input
                                type="text"
                                inputMode="decimal"
                                value={targetTax}
                                onChange={(e) => setTargetTax(e.target.value)}
                                placeholder="Hedef GV (yaklaşık)"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        )}
                        {targetMode === 'tax' && (
                            <p className="text-[10px] text-muted-foreground">
                                GV → matrah dönüşümü tek dönem dilimli tahmindir; yıllık kümülatif
                                GV değildir.
                            </p>
                        )}
                    </div>
                </div>

                {result.warnings.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
                        {result.warnings.map((w) => (
                            <li key={w}>{w}</li>
                        ))}
                    </ul>
                )}

                <div
                    className={`space-y-2 rounded-lg border px-4 py-3 ${
                        hasTarget
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border bg-secondary/10'
                    }`}
                >
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Sonuç
                    </p>
                    {!hasTarget ? (
                        <p className="text-sm text-muted-foreground">
                            Hedef ödenecek KDV ve/veya matrah (GV) gir; toplanacak fiş tutarı
                            burada çıkar.
                        </p>
                    ) : (
                        <>
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-medium">
                                    Toplanacak fiş (KDV dahil)
                                </span>
                                <span className="text-xl font-semibold tabular-nums text-primary">
                                    {fmtMoney(result.receiptsNeeded)}
                                </span>
                            </div>
                            <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">→ Net gider</dt>
                                    <dd className="tabular-nums">
                                        {fmtMoney(result.expenseNetFromReceipts)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">→ İndirilecek KDV</dt>
                                    <dd className="tabular-nums">
                                        {fmtMoney(result.deductibleVatFromReceipts)}
                                    </dd>
                                </div>
                                {result.receiptsForKdv > 0 &&
                                    result.receiptsForBase > 0 &&
                                    Math.abs(result.receiptsForKdv - result.receiptsForBase) >
                                        0.01 && (
                                        <>
                                            <div className="flex justify-between gap-2 text-muted-foreground sm:col-span-2">
                                                <dt>Sadece KDV hedefi için</dt>
                                                <dd className="tabular-nums">
                                                    {fmtMoney(result.receiptsForKdv)}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-2 text-muted-foreground sm:col-span-2">
                                                <dt>Sadece matrah/GV için</dt>
                                                <dd className="tabular-nums">
                                                    {fmtMoney(result.receiptsForBase)}
                                                </dd>
                                            </div>
                                        </>
                                    )}
                                <div className="flex justify-between gap-2 border-t border-border/50 pt-1 sm:col-span-2">
                                    <dt className="text-muted-foreground">
                                        Sonrası ödenecek KDV
                                    </dt>
                                    <dd className="font-medium tabular-nums">
                                        {fmtMoney(result.projectedPayableKdv)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2 sm:col-span-2">
                                    <dt className="text-muted-foreground">Sonrası matrah</dt>
                                    <dd className="tabular-nums">
                                        {fmtMoney(result.projectedTaxableBase)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2 sm:col-span-2">
                                    <dt className="text-muted-foreground">
                                        Sonrası GV (tek dönem tahmini)
                                    </dt>
                                    <dd className="tabular-nums">
                                        {fmtMoney(result.projectedIncomeTax)}
                                    </dd>
                                </div>
                            </dl>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
