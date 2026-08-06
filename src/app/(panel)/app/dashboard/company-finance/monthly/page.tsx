'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Info,
    Loader2,
    Plus,
    Receipt,
    Save,
    Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    DEFAULT_2026_BRACKETS,
    SALES_VAT_RATE,
    TEVFIKAT_OF_VAT_PERCENT,
    buildPaymentCalendar,
    cumulativeMonthlyTaxSchedule,
    expenseBreakdown,
    monthlyTaxableBase,
    progressiveIncomeTax,
    salesFromGrossInclusive,
    type TaxBracket
} from '@/lib/income-tax';
import { ReceiptTargetSim } from '@/components/panel/receipt-target-sim';

const MONTH_LABELS = [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık'
] as const;

type ExpenseDraft = {
    /** Geçici istemci id (yeni satırlar) */
    localId: string;
    dbId: string | null;
    name: string;
    amountGross: string;
    kdvRate: string;
    includeInDeductibleKdv: boolean;
    note: string;
    /** Örn. fuel — Benzin sayfasından aktarılan */
    source?: string;
};

type MonthDraft = {
    entryId: string | null;
    grossInput: string;
    kdvPaidInput: string;
    kdvDeductibleInput: string;
    note: string;
    expenses: ExpenseDraft[];
    dirty: boolean;
};

type KdvPreset = {
    id: string;
    name: string;
    rate_percent: number;
    sort_order: number;
};

/** Paket prim → aylık kazanç kapanış özeti */
type PaketPrimClosing = {
    month: number;
    is_closed: boolean;
    gross_sent: number;
    fixed_pay: number;
    daily_prim_total: number;
    monthly_bonus: number;
    total_packages: number;
    work_days: number;
    sent_at: string | null;
};

type BracketRow = TaxBracket & { id?: string; sort_order?: number };

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(raw: string): number {
    const t = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return 0;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function emptyExpense(rate = 20): ExpenseDraft {
    return {
        localId: crypto.randomUUID(),
        dbId: null,
        name: '',
        amountGross: '',
        kdvRate: String(rate),
        includeInDeductibleKdv: true,
        note: ''
    };
}

function emptyMonth(): MonthDraft {
    return {
        entryId: null,
        grossInput: '',
        kdvPaidInput: '',
        kdvDeductibleInput: '',
        note: '',
        expenses: [],
        dirty: false
    };
}

function buildYearDrafts(): MonthDraft[] {
    return Array.from({ length: 12 }, () => emptyMonth());
}

function isFutureMonth(year: number, monthIndex: number, now = new Date()): boolean {
    const y = now.getFullYear();
    const m = now.getMonth();
    return year > y || (year === y && monthIndex > m);
}

export default function MonthlyRevenuePage() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [months, setMonths] = useState<MonthDraft[]>(() => buildYearDrafts());
    const [openMonth, setOpenMonth] = useState<number | null>(null);
    const [brackets, setBrackets] = useState<BracketRow[]>(DEFAULT_2026_BRACKETS);
    const [presets, setPresets] = useState<KdvPreset[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingMonth, setSavingMonth] = useState<number | null>(null);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [paketClosings, setPaketClosings] = useState<Record<number, PaketPrimClosing>>(
        {}
    );
    /** Açık ayda fiş önerisi paneli */
    const [receiptSimMonth, setReceiptSimMonth] = useState<number | null>(null);

    const loadYear = useCallback(async (y: number) => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const [entriesRes, bracketsRes, presetsRes, paketRes] = await Promise.all([
            supabase
                .from('company_finance_monthly_entries')
                .select('*')
                .eq('year', y)
                .order('month'),
            supabase
                .from('company_finance_income_tax_brackets')
                .select('*')
                .eq('year', y)
                .order('sort_order'),
            supabase
                .from('company_finance_kdv_presets')
                .select('*')
                .order('sort_order'),
            supabase
                .from('company_finance_paket_prim_closings')
                .select(
                    'month, is_closed, gross_sent, fixed_pay, daily_prim_total, monthly_bonus, total_packages, work_days, sent_at'
                )
                .eq('year', y)
        ]);

        if (entriesRes.error || bracketsRes.error || presetsRes.error) {
            setError(
                entriesRes.error?.message ||
                    bracketsRes.error?.message ||
                    presetsRes.error?.message ||
                    'Yükleme hatası'
            );
            setLoading(false);
            return;
        }

        const paketByMonth: Record<number, PaketPrimClosing> = {};
        if (!paketRes.error && paketRes.data) {
            for (const row of paketRes.data) {
                const month = Number(row.month);
                if (month < 1 || month > 12) continue;
                paketByMonth[month] = {
                    month,
                    is_closed: Boolean(row.is_closed),
                    gross_sent: Number(row.gross_sent) || 0,
                    fixed_pay: Number(row.fixed_pay) || 0,
                    daily_prim_total: Number(row.daily_prim_total) || 0,
                    monthly_bonus: Number(row.monthly_bonus) || 0,
                    total_packages: Number(row.total_packages) || 0,
                    work_days: Number(row.work_days) || 0,
                    sent_at: row.sent_at ? String(row.sent_at) : null
                };
            }
        }
        setPaketClosings(paketByMonth);

        const drafts = buildYearDrafts();
        const entries = entriesRes.data || [];
        const entryIds = entries.map((e) => e.id as string);

        let expensesByEntry: Record<string, ExpenseDraft[]> = {};
        if (entryIds.length > 0) {
            const expRes = await supabase
                .from('company_finance_monthly_expenses')
                .select('*')
                .in('monthly_entry_id', entryIds)
                .order('sort_order');
            if (expRes.error) {
                setError(expRes.error.message);
                setLoading(false);
                return;
            }
            for (const row of expRes.data || []) {
                const eid = row.monthly_entry_id as string;
                if (!expensesByEntry[eid]) expensesByEntry[eid] = [];
                expensesByEntry[eid].push({
                    localId: row.id as string,
                    dbId: row.id as string,
                    name: (row.name as string) || '',
                    amountGross:
                        row.amount_gross != null ? String(row.amount_gross) : '',
                    kdvRate: row.kdv_rate != null ? String(row.kdv_rate) : '20',
                    includeInDeductibleKdv: row.include_in_deductible_kdv !== false,
                    note: (row.note as string) || '',
                    source: row.source ? String(row.source) : ''
                });
            }
        }

        for (const e of entries) {
            const mi = (e.month as number) - 1;
            if (mi < 0 || mi > 11) continue;
            drafts[mi] = {
                entryId: e.id as string,
                grossInput: e.gross_amount != null ? String(e.gross_amount) : '',
                kdvPaidInput: e.kdv_paid != null ? String(e.kdv_paid) : '',
                kdvDeductibleInput:
                    e.kdv_deductible != null ? String(e.kdv_deductible) : '',
                note: (e.note as string) || '',
                expenses: expensesByEntry[e.id as string] || [],
                dirty: false
            };
        }

        const br = (bracketsRes.data || []).map((b, i) => ({
            id: b.id as string,
            min_amount: Number(b.min_amount) || 0,
            max_amount: b.max_amount == null ? null : Number(b.max_amount),
            rate_percent: Number(b.rate_percent) || 0,
            sort_order: b.sort_order != null ? Number(b.sort_order) : i
        }));

        setMonths(drafts);
        setBrackets(br.length > 0 ? br : DEFAULT_2026_BRACKETS.map((x) => ({ ...x })));
        setPresets(
            (presetsRes.data || []).map((p) => ({
                id: p.id as string,
                name: p.name as string,
                rate_percent: Number(p.rate_percent) || 0,
                sort_order: Number(p.sort_order) || 0
            }))
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadYear(year);
    }, [year, loadYear]);

    const taxBrackets: TaxBracket[] = useMemo(
        () =>
            brackets.map((b) => ({
                min_amount: b.min_amount,
                max_amount: b.max_amount,
                rate_percent: b.rate_percent
            })),
        [brackets]
    );

    const resolved = useMemo(() => {
        return months.map((m, idx) => {
            const future = isFutureMonth(year, idx);
            const hasRecord =
                Boolean(m.entryId) ||
                m.grossInput.trim() !== '' ||
                m.expenses.length > 0 ||
                m.kdvPaidInput.trim() !== '' ||
                m.kdvDeductibleInput.trim() !== '' ||
                m.note.trim() !== '';

            const gross = future && !hasRecord ? 0 : parseMoney(m.grossInput);
            const sales = salesFromGrossInclusive(gross, SALES_VAT_RATE);

            const expenseRows = m.expenses.map((ex) => {
                const bd = expenseBreakdown(
                    parseMoney(ex.amountGross),
                    parseMoney(ex.kdvRate)
                );
                return { ...ex, ...bd };
            });
            const expenseNetTotal = expenseRows.reduce((a, r) => a + r.amountNet, 0);
            const expenseKdvIncluded = expenseRows
                .filter((r) => r.includeInDeductibleKdv)
                .reduce((a, r) => a + r.kdvAmount, 0);
            const expenseKdvAll = expenseRows.reduce((a, r) => a + r.kdvAmount, 0);

            const manualDeductible = parseMoney(m.kdvDeductibleInput);
            const kdvPaid = parseMoney(m.kdvPaidInput);
            const totalDeductible = manualDeductible + expenseKdvIncluded;
            const kdvBalance = sales.salesVat - totalDeductible - kdvPaid;

            const base = future && !hasRecord ? 0 : monthlyTaxableBase(sales.netRevenue, expenseNetTotal);

            return {
                idx,
                future,
                hasRecord,
                gross,
                ...sales,
                expenseRows,
                expenseNetTotal,
                expenseKdvIncluded,
                expenseKdvAll,
                kdvPaid,
                manualDeductible,
                totalDeductible,
                kdvBalance,
                base
            };
        });
    }, [months, year]);

    const schedule = useMemo(() => {
        return cumulativeMonthlyTaxSchedule(
            resolved.map((r) => r.base),
            resolved.map((r) => r.tevfikat),
            taxBrackets
        );
    }, [resolved, taxBrackets]);

    const yearTax = useMemo(
        () => progressiveIncomeTax(Math.max(0, schedule.cumulativeBase), taxBrackets),
        [schedule.cumulativeBase, taxBrackets]
    );

    const yearTotals = useMemo(() => {
        const withData = resolved.filter((r) => r.hasRecord && !r.future);
        const allRecorded = resolved.filter((r) => r.hasRecord);
        const paketList = Object.values(paketClosings).filter(
            (c) => c.is_closed || c.gross_sent > 0 || c.total_packages > 0
        );
        return {
            monthsFilled: allRecorded.length,
            gross: withData.reduce((a, r) => a + r.gross, 0) +
                resolved.filter((r) => r.hasRecord && r.future).reduce((a, r) => a + r.gross, 0),
            netRevenue: resolved.reduce((a, r) => a + (r.hasRecord ? r.netRevenue : 0), 0),
            expenseNet: resolved.reduce((a, r) => a + (r.hasRecord ? r.expenseNetTotal : 0), 0),
            salesVat: resolved.reduce((a, r) => a + (r.hasRecord ? r.salesVat : 0), 0),
            tevfikat: schedule.cumulativeTevfikat,
            paketMonths: paketList.length,
            paketPackages: paketList.reduce((a, c) => a + c.total_packages, 0),
            paketGrossSent: paketList.reduce((a, c) => a + c.gross_sent, 0)
        };
    }, [resolved, schedule.cumulativeTevfikat, paketClosings]);

    const paymentCalendar = useMemo(() => {
        // Hesaplanan KDV yükümlülüğü: satış KDV − indirilecek (ödenen mahsup edilmeden önce)
        const monthlyKdvDue = resolved.map((r) =>
            Math.max(0, r.salesVat - r.totalDeductible)
        );
        return buildPaymentCalendar(year, monthlyKdvDue, schedule);
    }, [resolved, schedule, year]);

    const updateMonth = (idx: number, patch: Partial<MonthDraft>) => {
        setMonths((prev) =>
            prev.map((m, i) => (i === idx ? { ...m, ...patch, dirty: true } : m))
        );
    };

    const updateExpense = (
        monthIdx: number,
        localId: string,
        patch: Partial<ExpenseDraft>
    ) => {
        setMonths((prev) =>
            prev.map((m, i) => {
                if (i !== monthIdx) return m;
                return {
                    ...m,
                    dirty: true,
                    expenses: m.expenses.map((ex) =>
                        ex.localId === localId ? { ...ex, ...patch } : ex
                    )
                };
            })
        );
    };

    const addExpense = (monthIdx: number, rate?: number) => {
        const defaultRate =
            rate ??
            (presets.find((p) => p.name === 'Genel')?.rate_percent ?? 20);
        setMonths((prev) =>
            prev.map((m, i) =>
                i === monthIdx
                    ? {
                          ...m,
                          dirty: true,
                          expenses: [...m.expenses, emptyExpense(defaultRate)]
                      }
                    : m
            )
        );
    };

    const removeExpense = (monthIdx: number, localId: string) => {
        setMonths((prev) =>
            prev.map((m, i) =>
                i === monthIdx
                    ? {
                          ...m,
                          dirty: true,
                          expenses: m.expenses.filter((ex) => ex.localId !== localId)
                      }
                    : m
            )
        );
    };

    const saveMonth = async (idx: number) => {
        const m = months[idx];
        setSavingMonth(idx);
        setError(null);
        setStatus(null);

        const payload = {
            year,
            month: idx + 1,
            gross_amount: parseMoney(m.grossInput),
            kdv_paid: parseMoney(m.kdvPaidInput),
            kdv_deductible: parseMoney(m.kdvDeductibleInput),
            note: m.note.trim(),
            updated_at: new Date().toISOString()
        };

        let entryId = m.entryId;
        if (entryId) {
            const { error: upErr } = await supabase
                .from('company_finance_monthly_entries')
                .update(payload)
                .eq('id', entryId);
            if (upErr) {
                setError(upErr.message);
                setSavingMonth(null);
                return;
            }
        } else {
            const { data, error: inErr } = await supabase
                .from('company_finance_monthly_entries')
                .insert([payload])
                .select('id')
                .single();
            if (inErr || !data) {
                setError(inErr?.message || 'Kayıt oluşturulamadı');
                setSavingMonth(null);
                return;
            }
            entryId = data.id as string;
        }

        const { data: existingExp, error: listErr } = await supabase
            .from('company_finance_monthly_expenses')
            .select('id')
            .eq('monthly_entry_id', entryId);
        if (listErr) {
            setError(listErr.message);
            setSavingMonth(null);
            return;
        }

        const keepIds = new Set(
            m.expenses.map((ex) => ex.dbId).filter(Boolean) as string[]
        );
        const toDelete = (existingExp || [])
            .map((r) => r.id as string)
            .filter((id) => !keepIds.has(id));
        if (toDelete.length > 0) {
            const { error: delErr } = await supabase
                .from('company_finance_monthly_expenses')
                .delete()
                .in('id', toDelete);
            if (delErr) {
                setError(delErr.message);
                setSavingMonth(null);
                return;
            }
        }

        const nextExpenses: ExpenseDraft[] = [];
        for (let i = 0; i < m.expenses.length; i++) {
            const ex = m.expenses[i];
            const name = ex.name.trim() || 'Gider';
            const row = {
                monthly_entry_id: entryId,
                name,
                amount_gross: parseMoney(ex.amountGross),
                kdv_rate: parseMoney(ex.kdvRate),
                include_in_deductible_kdv: ex.includeInDeductibleKdv,
                note: ex.note.trim(),
                sort_order: i,
                source: ex.source?.trim() || ''
            };
            if (ex.dbId) {
                const { error: uErr } = await supabase
                    .from('company_finance_monthly_expenses')
                    .update(row)
                    .eq('id', ex.dbId);
                if (uErr) {
                    setError(uErr.message);
                    setSavingMonth(null);
                    return;
                }
                nextExpenses.push({ ...ex, name, dbId: ex.dbId });
            } else {
                const { data: created, error: cErr } = await supabase
                    .from('company_finance_monthly_expenses')
                    .insert([row])
                    .select('id')
                    .single();
                if (cErr || !created) {
                    setError(cErr?.message || 'Gider kaydı başarısız');
                    setSavingMonth(null);
                    return;
                }
                nextExpenses.push({
                    ...ex,
                    name,
                    dbId: created.id as string,
                    localId: created.id as string
                });
            }
        }

        setMonths((prev) =>
            prev.map((row, i) =>
                i === idx
                    ? {
                          ...row,
                          entryId,
                          expenses: nextExpenses,
                          dirty: false
                      }
                    : row
            )
        );
        setStatus(`${MONTH_LABELS[idx]} kaydedildi`);
        setSavingMonth(null);
    };

    const saveBrackets = async () => {
        setSavingSettings(true);
        setError(null);
        const { error: delErr } = await supabase
            .from('company_finance_income_tax_brackets')
            .delete()
            .eq('year', year);
        if (delErr) {
            setError(delErr.message);
            setSavingSettings(false);
            return;
        }
        const rows = brackets.map((b, i) => ({
            year,
            min_amount: b.min_amount,
            max_amount: b.max_amount,
            rate_percent: b.rate_percent,
            sort_order: i
        }));
        const { data, error: inErr } = await supabase
            .from('company_finance_income_tax_brackets')
            .insert(rows)
            .select('*');
        if (inErr) {
            setError(inErr.message);
            setSavingSettings(false);
            return;
        }
        setBrackets(
            (data || []).map((b, i) => ({
                id: b.id as string,
                min_amount: Number(b.min_amount) || 0,
                max_amount: b.max_amount == null ? null : Number(b.max_amount),
                rate_percent: Number(b.rate_percent) || 0,
                sort_order: i
            }))
        );
        setStatus(`${year} gelir vergisi dilimleri kaydedildi`);
        setSavingSettings(false);
    };

    const savePresets = async () => {
        setSavingSettings(true);
        setError(null);
        const { data: existing, error: listErr } = await supabase
            .from('company_finance_kdv_presets')
            .select('id');
        if (listErr) {
            setError(listErr.message);
            setSavingSettings(false);
            return;
        }
        const keep = new Set(presets.map((p) => p.id).filter((id) => !id.startsWith('new-')));
        const toDelete = (existing || [])
            .map((r) => r.id as string)
            .filter((id) => !keep.has(id));
        if (toDelete.length > 0) {
            const { error: dErr } = await supabase
                .from('company_finance_kdv_presets')
                .delete()
                .in('id', toDelete);
            if (dErr) {
                setError(dErr.message);
                setSavingSettings(false);
                return;
            }
        }

        const next: KdvPreset[] = [];
        for (let i = 0; i < presets.length; i++) {
            const p = presets[i];
            const body = {
                name: p.name.trim() || 'Oran',
                rate_percent: p.rate_percent,
                sort_order: i
            };
            if (p.id.startsWith('new-')) {
                const { data, error: iErr } = await supabase
                    .from('company_finance_kdv_presets')
                    .insert([body])
                    .select('*')
                    .single();
                if (iErr || !data) {
                    setError(iErr?.message || 'Preset kaydı başarısız');
                    setSavingSettings(false);
                    return;
                }
                next.push({
                    id: data.id as string,
                    name: data.name as string,
                    rate_percent: Number(data.rate_percent) || 0,
                    sort_order: i
                });
            } else {
                const { error: uErr } = await supabase
                    .from('company_finance_kdv_presets')
                    .update(body)
                    .eq('id', p.id);
                if (uErr) {
                    setError(uErr.message);
                    setSavingSettings(false);
                    return;
                }
                next.push({ ...p, ...body, sort_order: i });
            }
        }
        setPresets(next);
        setStatus('KDV hazır oranları kaydedildi');
        setSavingSettings(false);
    };

    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div className="space-y-8 max-w-5xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Aylık kazanç</h2>
                <p className="text-muted-foreground mt-1">
                    Brüt ciro KDV dahil girilir; matrah ve gelir vergisi KDV hariç hesaplanır.
                    Kayıt yok veya henüz gelmemiş aylar 0 sayılır. Tevfikat (satış KDV × %
                    {TEVFIKAT_OF_VAT_PERCENT}) peşin vergi olarak GV’den mahsup edilir.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                <Info className="w-4 h-4 shrink-0" />
                <p>
                    Satış KDV %{SALES_VAT_RATE}. Gider tutarı KDV dahil; oran hazır listeden veya
                    serbest. “İndirilecek KDV’ye dahil” açık giderlerin KDV’si aylık indirilecek
                    havuza eklenir.
                </p>
            </div>

            {error && (
                <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                    {error}
                </p>
            )}
            {status && (
                <p className="text-sm text-emerald-300/90 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    {status}
                </p>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <label className="block text-xs text-muted-foreground mb-1">Yıl</label>
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
                <dl className="flex flex-wrap gap-4 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground">Dolu ay</dt>
                        <dd className="font-medium tabular-nums">{yearTotals.monthsFilled}/12</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Yıllık matrah</dt>
                        <dd className="font-medium tabular-nums">
                            {fmtMoney(Math.max(0, schedule.cumulativeBase))}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Hesaplanan GV</dt>
                        <dd className="font-medium tabular-nums">
                            {fmtMoney(schedule.cumulativeGv)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Tevfikat (peşin)</dt>
                        <dd className="font-medium tabular-nums">
                            {fmtMoney(schedule.cumulativeTevfikat)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Kalan GV</dt>
                        <dd className="font-medium tabular-nums">
                            {fmtMoney(schedule.gvDueAfterTevfikat)}
                        </dd>
                    </div>
                    {yearTotals.paketMonths > 0 && (
                        <>
                            <div>
                                <dt className="text-xs text-muted-foreground">Paket (yıl)</dt>
                                <dd className="font-medium tabular-nums">
                                    {yearTotals.paketPackages.toLocaleString('tr-TR')}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    Prim brüt gönderilen
                                </dt>
                                <dd className="font-medium tabular-nums">
                                    {fmtMoney(yearTotals.paketGrossSent)}
                                </dd>
                            </div>
                        </>
                    )}
                </dl>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
                <button
                    type="button"
                    onClick={() => setCalendarOpen((o) => !o)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-secondary/30"
                >
                    {calendarOpen ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                    Beyan / ödeme takvimi ({year})
                </button>
                {calendarOpen && (
                    <div className="border-t border-border overflow-x-auto">
                        <table className="w-full text-sm min-w-[720px]">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-secondary/20">
                                    <th className="px-3 py-2 font-medium">Dönem</th>
                                    <th className="px-3 py-2 font-medium">İşlem</th>
                                    <th className="px-3 py-2 font-medium">Neden hesaplanır?</th>
                                    <th className="px-3 py-2 font-medium text-right">Tutar</th>
                                    <th className="px-3 py-2 font-medium">Beyan</th>
                                    <th className="px-3 py-2 font-medium">Ödeme</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {paymentCalendar.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={
                                            row.isYearEnd || row.geciciNo
                                                ? 'bg-secondary/15'
                                                : undefined
                                        }
                                    >
                                        <td className="px-3 py-2.5 font-medium whitespace-nowrap align-top">
                                            {row.periodLabel}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                            {row.islem}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[18rem] align-top">
                                            {row.reason}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap align-top">
                                            <div>{fmtMoney(row.totalDue)}</div>
                                            {(row.kdvDue > 0 || row.incomeDue > 0) &&
                                                !row.isYearEnd && (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {row.kdvDue > 0 && (
                                                            <span>KDV {fmtMoney(row.kdvDue)}</span>
                                                        )}
                                                        {row.kdvDue > 0 && row.incomeDue > 0 && (
                                                            <span> · </span>
                                                        )}
                                                        {row.incomeDue > 0 && (
                                                            <span>
                                                                Gelir {fmtMoney(row.incomeDue)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            {row.isYearEnd &&
                                                row.installmentMarch != null &&
                                                row.installmentMarch > 0 && (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        Taksit {fmtMoney(row.installmentMarch)} × 2
                                                    </div>
                                                )}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                            {row.declarationLabel}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                            {row.paymentLabel}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                            Geçici vergi dönemleri: Mart, Haziran, Eylül (3 dönem). Aralık yalnızca
                            KDV. Yıllık beyanname sonraki yıl Mart; kalan GV Mart &amp; Temmuz iki
                            taksit. KDV = satış − indirilecek; geçici = kümülatif GV − tevfikat −
                            önceki geçici.
                        </p>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
                <button
                    type="button"
                    onClick={() => setSettingsOpen((o) => !o)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-secondary/30"
                >
                    {settingsOpen ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                    Vergi dilimleri ve KDV hazır oranları ({year})
                </button>
                {settingsOpen && (
                    <div className="border-t border-border px-4 py-4 space-y-6 bg-secondary/10">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">Gelir vergisi dilimleri</h3>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setBrackets((prev) => [
                                                ...prev,
                                                {
                                                    min_amount: 0,
                                                    max_amount: null,
                                                    rate_percent: 15
                                                }
                                            ])
                                        }
                                        className="text-xs inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary"
                                    >
                                        <Plus className="w-3 h-3" /> Dilim
                                    </button>
                                    <button
                                        type="button"
                                        disabled={savingSettings}
                                        onClick={() => void saveBrackets()}
                                        className="text-xs inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary disabled:opacity-50"
                                    >
                                        {savingSettings ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Save className="w-3 h-3" />
                                        )}
                                        Kaydet
                                    </button>
                                </div>
                            </div>
                            <ul className="space-y-2">
                                {brackets.map((b, i) => (
                                    <li
                                        key={b.id || `b-${i}`}
                                        className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end"
                                    >
                                        <div>
                                            <label className="text-[10px] text-muted-foreground">
                                                Alt
                                            </label>
                                            <input
                                                type="number"
                                                value={b.min_amount}
                                                onChange={(e) =>
                                                    setBrackets((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      min_amount:
                                                                          Number(e.target.value) ||
                                                                          0
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground">
                                                Üst (boş = ∞)
                                            </label>
                                            <input
                                                type="number"
                                                value={b.max_amount ?? ''}
                                                onChange={(e) =>
                                                    setBrackets((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      max_amount:
                                                                          e.target.value === ''
                                                                              ? null
                                                                              : Number(
                                                                                    e.target.value
                                                                                ) || 0
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground">
                                                Oran %
                                            </label>
                                            <input
                                                type="number"
                                                value={b.rate_percent}
                                                onChange={(e) =>
                                                    setBrackets((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      rate_percent:
                                                                          Number(e.target.value) ||
                                                                          0
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setBrackets((prev) =>
                                                    prev.filter((_, j) => j !== i)
                                                )
                                            }
                                            className="justify-self-start sm:justify-self-end p-2 text-muted-foreground hover:text-red-400"
                                            aria-label="Dilim sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {yearTax.slices.length > 0 && (
                                <dl className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                                    {yearTax.slices.map((s, i) => (
                                        <div key={i} className="flex justify-between gap-2">
                                            <dt>
                                                {fmtMoney(s.min)} –{' '}
                                                {s.max == null ? '∞' : fmtMoney(s.max)} (%{s.rate})
                                            </dt>
                                            <dd className="tabular-nums">
                                                {fmtMoney(s.taxInSlice)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">KDV hazır oranları</h3>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPresets((prev) => [
                                                ...prev,
                                                {
                                                    id: `new-${crypto.randomUUID()}`,
                                                    name: '',
                                                    rate_percent: 20,
                                                    sort_order: prev.length
                                                }
                                            ])
                                        }
                                        className="text-xs inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary"
                                    >
                                        <Plus className="w-3 h-3" /> Oran
                                    </button>
                                    <button
                                        type="button"
                                        disabled={savingSettings}
                                        onClick={() => void savePresets()}
                                        className="text-xs inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary disabled:opacity-50"
                                    >
                                        {savingSettings ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Save className="w-3 h-3" />
                                        )}
                                        Kaydet
                                    </button>
                                </div>
                            </div>
                            <ul className="space-y-2">
                                {presets.map((p, i) => (
                                    <li key={p.id} className="flex flex-wrap gap-2 items-end">
                                        <div className="flex-1 min-w-[8rem]">
                                            <label className="text-[10px] text-muted-foreground">
                                                Ad
                                            </label>
                                            <input
                                                value={p.name}
                                                onChange={(e) =>
                                                    setPresets((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i
                                                                ? { ...x, name: e.target.value }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] text-muted-foreground">
                                                %
                                            </label>
                                            <input
                                                type="number"
                                                value={p.rate_percent}
                                                onChange={(e) =>
                                                    setPresets((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      rate_percent:
                                                                          Number(e.target.value) ||
                                                                          0
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPresets((prev) =>
                                                    prev.filter((_, j) => j !== i)
                                                )
                                            }
                                            className="p-2 text-muted-foreground hover:text-red-400"
                                            aria-label="Oran sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yükleniyor…
                </div>
            ) : (
                <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {resolved.map((r) => {
                        const open = openMonth === r.idx;
                        const draft = months[r.idx];
                        const cum = schedule.months[r.idx];
                        return (
                            <li key={r.idx} className="bg-background">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (open) {
                                            setOpenMonth(null);
                                            setReceiptSimMonth(null);
                                        } else {
                                            setOpenMonth(r.idx);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors"
                                >
                                    {open ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                {MONTH_LABELS[r.idx]} {year}
                                            </span>
                                            {r.future && !r.hasRecord && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                                    gelecek · 0
                                                </span>
                                            )}
                                            {!r.hasRecord && !r.future && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                                    veri yok · 0
                                                </span>
                                            )}
                                            {r.hasRecord && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-300/90">
                                                    kayıtlı
                                                </span>
                                            )}
                                            {draft.dirty && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200/90">
                                                    kaydedilmedi
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">Brüt</p>
                                        <p className="font-medium tabular-nums text-sm">
                                            {fmtMoney(r.gross)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 hidden sm:block w-28">
                                        <p className="text-xs text-muted-foreground">Matrah</p>
                                        <p className="font-medium tabular-nums text-sm">
                                            {fmtMoney(r.base)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 hidden md:block w-28">
                                        <p className="text-xs text-muted-foreground">
                                            Küm. GV
                                        </p>
                                        <p className="font-medium tabular-nums text-sm">
                                            {fmtMoney(cum?.cumulativeGv ?? 0)}
                                        </p>
                                    </div>
                                </button>

                                {open && (
                                    <div className="px-4 pb-5 pt-1 space-y-6 border-t border-border/60 bg-secondary/10">
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    Brüt ciro (KDV dahil)
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0"
                                                    value={draft.grossInput}
                                                    onChange={(e) =>
                                                        updateMonth(r.idx, {
                                                            grossInput: e.target.value
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    Ödenen KDV
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0"
                                                    value={draft.kdvPaidInput}
                                                    onChange={(e) =>
                                                        updateMonth(r.idx, {
                                                            kdvPaidInput: e.target.value
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    İndirilecek KDV (manuel)
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0"
                                                    value={draft.kdvDeductibleInput}
                                                    onChange={(e) =>
                                                        updateMonth(r.idx, {
                                                            kdvDeductibleInput: e.target.value
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    Not
                                                </label>
                                                <input
                                                    type="text"
                                                    value={draft.note}
                                                    onChange={(e) =>
                                                        updateMonth(r.idx, {
                                                            note: e.target.value
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Giderler
                                                </h4>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setReceiptSimMonth((m) =>
                                                                m === r.idx ? null : r.idx
                                                            )
                                                        }
                                                        className={`inline-flex items-center gap-1 text-[11px] rounded-md border px-2 py-1 ${
                                                            receiptSimMonth === r.idx
                                                                ? 'border-primary/50 bg-primary/10 text-primary'
                                                                : 'border-border hover:bg-secondary'
                                                        }`}
                                                    >
                                                        <Receipt className="w-3 h-3" />
                                                        {receiptSimMonth === r.idx
                                                            ? 'Öneriyi gizle'
                                                            : 'Bu ay için öner'}
                                                    </button>
                                                    {presets.map((p) => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() =>
                                                                addExpense(r.idx, p.rate_percent)
                                                            }
                                                            className="text-[11px] rounded-md border border-border px-2 py-1 hover:bg-secondary"
                                                        >
                                                            + {p.name} %{p.rate_percent}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => addExpense(r.idx)}
                                                        className="text-[11px] inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary"
                                                    >
                                                        <Plus className="w-3 h-3" /> Gider
                                                    </button>
                                                </div>
                                            </div>

                                            {receiptSimMonth === r.idx && (
                                                <ReceiptTargetSim
                                                    embed={{
                                                        year,
                                                        monthIndex: r.idx,
                                                        grossInput: draft.grossInput,
                                                        kdvPaid: parseMoney(draft.kdvPaidInput),
                                                        manualDeductible: parseMoney(
                                                            draft.kdvDeductibleInput
                                                        ),
                                                        expenseNet: r.expenseNetTotal,
                                                        expenseDeductibleKdv: r.expenseKdvIncluded
                                                    }}
                                                />
                                            )}

                                            {draft.expenses.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">
                                                    Henüz gider yok. Benzin, yemek vb. ekleyebilirsin.
                                                </p>
                                            ) : (
                                                <ul className="space-y-3">
                                                    {draft.expenses.map((ex) => {
                                                        const bd = expenseBreakdown(
                                                            parseMoney(ex.amountGross),
                                                            parseMoney(ex.kdvRate)
                                                        );
                                                        return (
                                                            <li
                                                                key={ex.localId}
                                                                className="rounded-lg border border-border bg-background p-3 space-y-2"
                                                            >
                                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                                    <div>
                                                                        <label className="text-[10px] text-muted-foreground">
                                                                            Ad
                                                                            {ex.source === 'fuel' && (
                                                                                <span className="ml-1 text-primary">
                                                                                    · Benzin sayfası
                                                                                </span>
                                                                            )}
                                                                        </label>
                                                                        <input
                                                                            value={ex.name}
                                                                            placeholder="Benzin"
                                                                            onChange={(e) =>
                                                                                updateExpense(
                                                                                    r.idx,
                                                                                    ex.localId,
                                                                                    {
                                                                                        name: e
                                                                                            .target
                                                                                            .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] text-muted-foreground">
                                                                            Tutar (KDV dahil)
                                                                        </label>
                                                                        <input
                                                                            value={ex.amountGross}
                                                                            inputMode="decimal"
                                                                            onChange={(e) =>
                                                                                updateExpense(
                                                                                    r.idx,
                                                                                    ex.localId,
                                                                                    {
                                                                                        amountGross:
                                                                                            e.target
                                                                                                .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] text-muted-foreground">
                                                                            KDV %
                                                                        </label>
                                                                        <div className="flex gap-1">
                                                                            <input
                                                                                value={ex.kdvRate}
                                                                                inputMode="decimal"
                                                                                onChange={(e) =>
                                                                                    updateExpense(
                                                                                        r.idx,
                                                                                        ex.localId,
                                                                                        {
                                                                                            kdvRate:
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                        }
                                                                                    )
                                                                                }
                                                                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                                                            />
                                                                            {presets.length > 0 && (
                                                                                <select
                                                                                    value=""
                                                                                    onChange={(e) => {
                                                                                        if (
                                                                                            !e.target
                                                                                                .value
                                                                                        )
                                                                                            return;
                                                                                        updateExpense(
                                                                                            r.idx,
                                                                                            ex.localId,
                                                                                            {
                                                                                                kdvRate:
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                            }
                                                                                        );
                                                                                    }}
                                                                                    className="rounded-md border border-border bg-background text-xs max-w-[5.5rem]"
                                                                                    aria-label="Hazır oran"
                                                                                >
                                                                                    <option value="">
                                                                                        Hazır
                                                                                    </option>
                                                                                    {presets.map(
                                                                                        (p) => (
                                                                                            <option
                                                                                                key={
                                                                                                    p.id
                                                                                                }
                                                                                                value={String(
                                                                                                    p.rate_percent
                                                                                                )}
                                                                                            >
                                                                                                {p.name}{' '}
                                                                                                %
                                                                                                {
                                                                                                    p.rate_percent
                                                                                                }
                                                                                            </option>
                                                                                        )
                                                                                    )}
                                                                                </select>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-end justify-between gap-2">
                                                                        <label className="flex items-center gap-2 text-xs text-muted-foreground pb-1.5">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={
                                                                                    ex.includeInDeductibleKdv
                                                                                }
                                                                                onChange={(e) =>
                                                                                    updateExpense(
                                                                                        r.idx,
                                                                                        ex.localId,
                                                                                        {
                                                                                            includeInDeductibleKdv:
                                                                                                e
                                                                                                    .target
                                                                                                    .checked
                                                                                        }
                                                                                    )
                                                                                }
                                                                            />
                                                                            İndirilecek KDV
                                                                        </label>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                removeExpense(
                                                                                    r.idx,
                                                                                    ex.localId
                                                                                )
                                                                            }
                                                                            className="p-1.5 text-muted-foreground hover:text-red-400"
                                                                            aria-label="Gider sil"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground tabular-nums">
                                                                    Net {fmtMoney(bd.amountNet)} ·
                                                                    KDV {fmtMoney(bd.kdvAmount)}
                                                                </p>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                            <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Özet (matrah + nakit)
                                                </h4>
                                                <dl className="space-y-1.5 text-sm">
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            Net ciro
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(r.netRevenue)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            Satış KDV
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(r.salesVat)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            Tevfikat (peşin)
                                                        </dt>
                                                        <dd className="tabular-nums text-amber-600 dark:text-amber-400">
                                                            −{fmtMoney(r.tevfikat)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            Gider (net)
                                                        </dt>
                                                        <dd className="tabular-nums text-red-400">
                                                            −{fmtMoney(r.expenseNetTotal)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2 pt-1.5 border-t border-border">
                                                        <dt className="text-muted-foreground">
                                                            Aylık matrah
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(r.base)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2 pt-1.5 border-t border-primary/25">
                                                        <dt className="font-medium">
                                                            Aylık net (nakit)
                                                        </dt>
                                                        <dd className="font-semibold tabular-nums text-primary">
                                                            {fmtMoney(
                                                                r.netRevenue -
                                                                    r.tevfikat -
                                                                    r.expenseNetTotal
                                                            )}
                                                        </dd>
                                                    </div>
                                                </dl>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Nakit = net ciro − tevfikat − gider · Matrah =
                                                    net ciro − gider (GV tabanı)
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    KDV takibi + kümülatif GV
                                                </h4>
                                                <dl className="space-y-1.5 text-sm">
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            İndirilecek (toplam)
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(r.totalDeductible)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            Ödenen
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(r.kdvPaid)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            KDV bakiye
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(r.kdvBalance)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2 pt-1.5 border-t border-border">
                                                        <dt className="text-muted-foreground">
                                                            Yıl başı → bu ay GV
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(cum?.cumulativeGv ?? 0)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="text-muted-foreground">
                                                            Bu aya düşen GV
                                                        </dt>
                                                        <dd className="tabular-nums">
                                                            {fmtMoney(cum?.monthGvDelta ?? 0)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <dt className="font-medium">
                                                            Kalan GV (tevfikat sonrası)
                                                        </dt>
                                                        <dd className="font-medium tabular-nums">
                                                            {fmtMoney(
                                                                cum?.gvDueAfterTevfikat ?? 0
                                                            )}
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </div>

                                            <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-2 md:col-span-2 xl:col-span-1">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Paket prim
                                                </h4>
                                                {(() => {
                                                    const pp = paketClosings[r.idx + 1];
                                                    const hasPp =
                                                        pp &&
                                                        (pp.is_closed ||
                                                            pp.gross_sent > 0 ||
                                                            pp.total_packages > 0);
                                                    if (!hasPp || !pp) {
                                                        return (
                                                            <p className="text-sm text-muted-foreground py-2">
                                                                Bu ay paket primden henüz
                                                                gönderilmedi.
                                                            </p>
                                                        );
                                                    }
                                                    return (
                                                        <dl className="space-y-1.5 text-sm">
                                                            <div className="flex justify-between gap-2">
                                                                <dt className="text-muted-foreground">
                                                                    Toplam paket
                                                                </dt>
                                                                <dd className="tabular-nums">
                                                                    {pp.total_packages.toLocaleString(
                                                                        'tr-TR'
                                                                    )}
                                                                </dd>
                                                            </div>
                                                            <div className="flex justify-between gap-2">
                                                                <dt className="text-muted-foreground">
                                                                    Çalışılan gün
                                                                </dt>
                                                                <dd className="tabular-nums">
                                                                    {pp.work_days}
                                                                </dd>
                                                            </div>
                                                            <div className="flex justify-between gap-2">
                                                                <dt className="text-muted-foreground">
                                                                    Sabit (gün × ücret)
                                                                </dt>
                                                                <dd className="tabular-nums">
                                                                    {fmtMoney(pp.fixed_pay)}
                                                                </dd>
                                                            </div>
                                                            <div className="flex justify-between gap-2">
                                                                <dt className="text-muted-foreground">
                                                                    Günlük prim toplamı
                                                                </dt>
                                                                <dd className="tabular-nums">
                                                                    {fmtMoney(
                                                                        pp.daily_prim_total
                                                                    )}
                                                                </dd>
                                                            </div>
                                                            <div className="flex justify-between gap-2">
                                                                <dt className="text-muted-foreground">
                                                                    Aylık bonus
                                                                </dt>
                                                                <dd className="tabular-nums">
                                                                    {fmtMoney(pp.monthly_bonus)}
                                                                </dd>
                                                            </div>
                                                            <div className="flex justify-between gap-2 pt-1.5 border-t border-border">
                                                                <dt className="font-medium">
                                                                    Gönderilen brüt
                                                                </dt>
                                                                <dd className="font-medium tabular-nums text-primary">
                                                                    {fmtMoney(pp.gross_sent)}
                                                                </dd>
                                                            </div>
                                                            {pp.sent_at && (
                                                                <p className="text-[11px] text-muted-foreground pt-1">
                                                                    {new Date(
                                                                        pp.sent_at
                                                                    ).toLocaleString('tr-TR')}
                                                                    {pp.is_closed
                                                                        ? ' · kapatıldı'
                                                                        : ''}
                                                                </p>
                                                            )}
                                                        </dl>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                disabled={savingMonth === r.idx}
                                                onClick={() => void saveMonth(r.idx)}
                                                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                                            >
                                                {savingMonth === r.idx ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Ayı kaydet
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
