'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    type TaxDebt,
    type TaxInstallmentRow,
    buildInstallmentRows,
    defaultSeedDebts,
    fmtMoney,
    monthLabel,
    rebuildUnpaidSchedule,
    summarizeTaxInstallments
} from '@/lib/tax-installments';

const DEBTS_TABLE = 'company_finance_tax_installment_debts';
const ROWS_TABLE = 'company_finance_tax_installment_rows';

function mapDebt(row: Record<string, unknown>): TaxDebt {
    return {
        id: String(row.id),
        name: String(row.name ?? ''),
        total_amount: Number(row.total_amount) || 0,
        installment_count: Number(row.installment_count) || 12,
        start_year: Number(row.start_year),
        start_month: Number(row.start_month),
        sort_order: Number(row.sort_order) || 0,
        note: String(row.note ?? '')
    };
}

function mapRow(row: Record<string, unknown>): TaxInstallmentRow {
    return {
        id: row.id ? String(row.id) : undefined,
        debt_id: String(row.debt_id),
        seq: Number(row.seq),
        year: Number(row.year),
        month: Number(row.month),
        amount: Number(row.amount) || 0,
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ? String(row.paid_at) : null,
        note: String(row.note ?? '')
    };
}

function ProgressBar({ value }: { value: number }) {
    const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

function Kpi({
    label,
    value,
    hint,
    emphasize,
    warn
}: {
    label: string;
    value: string;
    hint?: string;
    emphasize?: boolean;
    warn?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border px-4 py-3 ${
                warn
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : emphasize
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border'
            }`}
        >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

export default function TaxInstallmentsPage() {
    const [debts, setDebts] = useState<TaxDebt[]>([]);
    const [rows, setRows] = useState<TaxInstallmentRow[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [draft, setDraft] = useState<TaxDebt | null>(null);

    const summary = useMemo(() => summarizeTaxInstallments(debts, rows), [debts, rows]);
    const active = useMemo(
        () => debts.find((d) => d.id === activeId) ?? debts[0] ?? null,
        [debts, activeId]
    );
    const activeRows = useMemo(() => {
        if (!active) return [];
        return rows
            .filter((r) => r.debt_id === active.id)
            .sort((a, b) => a.seq - b.seq);
    }, [rows, active]);
    const activeDebtSummary = useMemo(
        () => summary.byDebt.find((d) => d.debtId === active?.id),
        [summary, active]
    );

    const ensureRowsForDebt = useCallback(async (debt: TaxDebt, existing: TaxInstallmentRow[]) => {
        const forDebt = existing.filter((r) => r.debt_id === debt.id);
        if (forDebt.length > 0) return existing;

        const payload = buildInstallmentRows(
            debt.id,
            debt.start_year,
            debt.start_month,
            debt.total_amount,
            debt.installment_count
        );
        if (payload.length === 0) return existing;

        const { data, error: insErr } = await supabase
            .from(ROWS_TABLE)
            .insert(payload)
            .select('id, debt_id, seq, year, month, amount, is_paid, paid_at, note');
        if (insErr) throw insErr;
        return [...existing, ...(data ?? []).map(mapRow)];
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const [debtsRes, rowsRes] = await Promise.all([
            supabase
                .from(DEBTS_TABLE)
                .select('id, name, total_amount, installment_count, start_year, start_month, sort_order, note')
                .order('sort_order'),
            supabase
                .from(ROWS_TABLE)
                .select('id, debt_id, seq, year, month, amount, is_paid, paid_at, note')
                .order('seq')
        ]);

        if (debtsRes.error || rowsRes.error) {
            const msg = debtsRes.error?.message || rowsRes.error?.message || 'Yükleme hatası';
            setError(
                msg.includes('does not exist') || debtsRes.error?.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_tax_installments.sql çalıştırın.'
                    : msg
            );
            setLoading(false);
            return;
        }

        let debtList = (debtsRes.data ?? []).map(mapDebt);
        let rowList = (rowsRes.data ?? []).map(mapRow);

        if (debtList.length === 0) {
            const seeds = defaultSeedDebts();
            const { data: inserted, error: seedErr } = await supabase
                .from(DEBTS_TABLE)
                .insert(
                    seeds.map((s) => ({
                        name: s.name,
                        total_amount: s.total_amount ?? 0,
                        installment_count: s.installment_count,
                        start_year: s.start_year!,
                        start_month: s.start_month!,
                        sort_order: s.sort_order,
                        note: s.note ?? ''
                    }))
                )
                .select(
                    'id, name, total_amount, installment_count, start_year, start_month, sort_order, note'
                );
            if (seedErr) {
                setError(seedErr.message);
                setLoading(false);
                return;
            }
            debtList = (inserted ?? []).map(mapDebt);
        }

        try {
            for (const d of debtList) {
                rowList = await ensureRowsForDebt(d, rowList);
            }
            setDebts(debtList);
            setRows(rowList);
            setActiveId((prev) => prev ?? debtList[0]?.id ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Seed hatası');
        }
        setLoading(false);
    }, [ensureRowsForDebt]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (active) setDraft({ ...active });
    }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const togglePaid = useCallback(async (row: TaxInstallmentRow, paid: boolean) => {
        if (!row.id) return;
        setSaving(true);
        setError(null);
        const payload = {
            is_paid: paid,
            paid_at: paid ? new Date().toISOString().slice(0, 10) : null
        };
        const { error: upErr } = await supabase.from(ROWS_TABLE).update(payload).eq('id', row.id);
        if (upErr) {
            setError(upErr.message);
            setSaving(false);
            return;
        }
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...payload } : r)));
        setSaving(false);
    }, []);

    const updateAmount = useCallback(async (row: TaxInstallmentRow, raw: string) => {
        if (!row.id) return;
        const n = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) return;
        const { error: upErr } = await supabase
            .from(ROWS_TABLE)
            .update({ amount: n })
            .eq('id', row.id);
        if (upErr) {
            setError(upErr.message);
            return;
        }
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, amount: n } : r)));
    }, []);

    const updateNote = useCallback(async (row: TaxInstallmentRow, note: string) => {
        if (!row.id) return;
        const { error: upErr } = await supabase.from(ROWS_TABLE).update({ note }).eq('id', row.id);
        if (upErr) {
            setError(upErr.message);
            return;
        }
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, note } : r)));
    }, []);

    const saveDebtSettings = useCallback(async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        setStatus(null);

        const payload = {
            name: draft.name.trim() || 'Borç',
            total_amount: Number(draft.total_amount) || 0,
            installment_count: Math.min(60, Math.max(1, Math.round(Number(draft.installment_count) || 12))),
            start_year: Number(draft.start_year),
            start_month: Math.min(12, Math.max(1, Number(draft.start_month))),
            note: draft.note ?? ''
        };

        const { error: upErr } = await supabase
            .from(DEBTS_TABLE)
            .update(payload)
            .eq('id', draft.id);
        if (upErr) {
            setError(upErr.message);
            setSaving(false);
            return;
        }

        const nextDebt: TaxDebt = { ...draft, ...payload };
        setDebts((prev) => prev.map((d) => (d.id === draft.id ? nextDebt : d)));
        setStatus('Borç ayarları kaydedildi.');
        setSaving(false);
    }, [draft]);

    const regenerateSchedule = useCallback(async () => {
        if (!active) return;
        const debt = draft ? { ...active, ...draft } : active;
        setSaving(true);
        setError(null);
        setStatus(null);

        // Önce ayarları kaydet
        const debtPayload = {
            name: debt.name.trim() || 'Borç',
            total_amount: Number(debt.total_amount) || 0,
            installment_count: Math.min(60, Math.max(1, Math.round(Number(debt.installment_count) || 12))),
            start_year: Number(debt.start_year),
            start_month: Math.min(12, Math.max(1, Number(debt.start_month))),
            note: debt.note ?? ''
        };
        const { error: debtErr } = await supabase
            .from(DEBTS_TABLE)
            .update(debtPayload)
            .eq('id', debt.id);
        if (debtErr) {
            setError(debtErr.message);
            setSaving(false);
            return;
        }
        const updatedDebt: TaxDebt = { ...debt, ...debtPayload };

        const { keep, create } = rebuildUnpaidSchedule(updatedDebt, rows);
        const unpaidIds = rows
            .filter((r) => r.debt_id === updatedDebt.id && !r.is_paid && r.id)
            .map((r) => r.id!);

        if (unpaidIds.length > 0) {
            const { error: delErr } = await supabase.from(ROWS_TABLE).delete().in('id', unpaidIds);
            if (delErr) {
                setError(delErr.message);
                setSaving(false);
                return;
            }
        }

        let created: TaxInstallmentRow[] = [];
        if (create.length > 0) {
            const { data, error: insErr } = await supabase
                .from(ROWS_TABLE)
                .insert(create)
                .select('id, debt_id, seq, year, month, amount, is_paid, paid_at, note');
            if (insErr) {
                setError(insErr.message);
                setSaving(false);
                return;
            }
            created = (data ?? []).map(mapRow);
        }

        setDebts((prev) => prev.map((d) => (d.id === updatedDebt.id ? updatedDebt : d)));
        setDraft(updatedDebt);
        setRows((prev) => [
            ...prev.filter((r) => r.debt_id !== updatedDebt.id),
            ...keep,
            ...created
        ]);
        setStatus(
            keep.length > 0
                ? `Taksitler yenilendi. ${keep.length} ödenen korundu, ${created.length} yeni satır.`
                : `${created.length} taksit eşit tutarla oluşturuldu.`
        );
        setSaving(false);
    }, [active, draft, rows]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2 text-primary">
                        <Landmark className="h-5 w-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">Vergi</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Vergi borcu taksitlendirme
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Dört borcun taksitlerini tek sayfada takip et; ödenenleri işaretle, kalanı
                        analiz et.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setSettingsOpen((o) => !o)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                >
                    <Settings2 className="h-4 w-4" />
                    {settingsOpen ? 'Ayarları gizle' : 'Borç ayarları'}
                </button>
            </header>

            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}
            {status && !error && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
                    {status}
                </div>
            )}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Toplam" value={fmtMoney(summary.total)} hint={`${summary.paidCount + summary.unpaidCount} taksit`} />
                <Kpi
                    label="Ödenen"
                    value={fmtMoney(summary.paidAmount)}
                    hint={`${summary.paidCount} taksit · %${Math.round(summary.progress * 100)}`}
                />
                <Kpi
                    label="Kalan"
                    value={fmtMoney(summary.unpaidAmount)}
                    hint={`${summary.unpaidCount} taksit`}
                    emphasize
                />
                <Kpi
                    label="Bu ay / geciken"
                    value={fmtMoney(summary.dueThisMonth.amount + summary.overdue.amount)}
                    hint={`${summary.dueThisMonth.count} bu ay · ${summary.overdue.count} geciken`}
                    warn={summary.overdue.count > 0}
                />
            </section>

            <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Genel ilerleme</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                        %{Math.round(summary.progress * 100)}
                    </p>
                </div>
                <ProgressBar value={summary.progress} />
            </section>

            {/* Borç seçici */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {debts.map((d) => {
                    const ds = summary.byDebt.find((x) => x.debtId === d.id);
                    const selected = active?.id === d.id;
                    return (
                        <button
                            key={d.id}
                            type="button"
                            onClick={() => setActiveId(d.id)}
                            className={`rounded-xl border p-4 text-left transition ${
                                selected
                                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                                    : 'border-border hover:bg-secondary/40'
                            }`}
                        >
                            <p className="truncate text-sm font-semibold">{d.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {ds?.paidCount ?? 0}/{d.installment_count} taksit ·{' '}
                                {d.installment_count} ay
                            </p>
                            <p className="mt-2 text-base font-semibold tabular-nums">
                                {fmtMoney(ds?.unpaidAmount ?? 0)}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    kalan
                                </span>
                            </p>
                            <div className="mt-3">
                                <ProgressBar value={ds?.progress ?? 0} />
                            </div>
                        </button>
                    );
                })}
            </section>

            {active && settingsOpen && draft && draft.id === active.id && (
                <section className="space-y-4 rounded-xl border border-border p-4">
                    <h2 className="text-sm font-semibold">{draft.name} — ayarlar</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Ad</span>
                            <input
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Toplam tutar (₺)</span>
                            <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={draft.total_amount}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        total_amount: parseFloat(e.target.value) || 0
                                    })
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Taksit sayısı</span>
                            <input
                                type="number"
                                min={1}
                                max={60}
                                value={draft.installment_count}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        installment_count: parseInt(e.target.value, 10) || 12
                                    })
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Başlangıç yılı</span>
                            <input
                                type="number"
                                value={draft.start_year}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        start_year: parseInt(e.target.value, 10) || draft.start_year
                                    })
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Başlangıç ayı</span>
                            <select
                                value={draft.start_month}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        start_month: parseInt(e.target.value, 10)
                                    })
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>
                                        {monthLabel(m)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-1">
                            <span className="text-xs text-muted-foreground">Not</span>
                            <input
                                value={draft.note}
                                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveDebtSettings()}
                            className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            Kaydet
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void regenerateSchedule()}
                            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary/50 disabled:opacity-50"
                        >
                            Taksitleri yeniden oluştur
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Yeniden oluştur: ödenen taksitler korunur; kalan tutar eşit bölünür. Toplam
                        ve başlangıç değişince bunu kullan.
                    </p>
                </section>
            )}

            {active && (
                <section className="overflow-hidden rounded-xl border border-border">
                    <div className="flex flex-col gap-1 border-b border-border bg-secondary/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold">{active.name}</h2>
                            <p className="text-xs text-muted-foreground">
                                {activeDebtSummary
                                    ? `${activeDebtSummary.paidCount}/${active.installment_count} ödendi · kalan ${fmtMoney(activeDebtSummary.unpaidAmount)}`
                                    : `${active.installment_count} taksit`}
                            </p>
                        </div>
                        {activeDebtSummary && (
                            <div className="w-full max-w-[180px]">
                                <ProgressBar value={activeDebtSummary.progress} />
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th className="px-4 py-2 text-left font-medium">#</th>
                                    <th className="px-4 py-2 text-left font-medium">Ay</th>
                                    <th className="px-4 py-2 text-right font-medium">Tutar</th>
                                    <th className="px-4 py-2 text-center font-medium">Ödendi</th>
                                    <th className="px-4 py-2 text-left font-medium">Not</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {activeRows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-8 text-center text-muted-foreground"
                                        >
                                            Taksit yok. Ayarlardan toplam girip yeniden oluştur.
                                        </td>
                                    </tr>
                                ) : (
                                    activeRows.map((r) => {
                                        const now = new Date();
                                        const overdue =
                                            !r.is_paid &&
                                            r.year * 12 + (r.month - 1) <
                                                now.getFullYear() * 12 + now.getMonth();
                                        const dueThis =
                                            !r.is_paid &&
                                            r.year === now.getFullYear() &&
                                            r.month === now.getMonth() + 1;
                                        return (
                                            <tr
                                                key={r.id ?? `${r.debt_id}-${r.seq}`}
                                                className={
                                                    r.is_paid
                                                        ? 'bg-emerald-500/5'
                                                        : overdue
                                                          ? 'bg-amber-500/5'
                                                          : dueThis
                                                            ? 'bg-primary/5'
                                                            : undefined
                                                }
                                            >
                                                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                                                    {r.seq}
                                                </td>
                                                <td className="px-4 py-2 font-medium">
                                                    {monthLabel(r.month)} {r.year}
                                                    {overdue && (
                                                        <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                                            gecikmiş
                                                        </span>
                                                    )}
                                                    {dueThis && (
                                                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                                                            bu ay
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min={0}
                                                        defaultValue={r.amount}
                                                        key={`amt-${r.id}-${r.amount}`}
                                                        onBlur={(e) =>
                                                            void updateAmount(r, e.target.value)
                                                        }
                                                        className="w-28 rounded border border-transparent bg-transparent px-2 py-1 text-right tabular-nums outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-primary/30"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={r.is_paid}
                                                        disabled={saving}
                                                        onChange={(e) =>
                                                            void togglePaid(r, e.target.checked)
                                                        }
                                                        className="h-4 w-4 accent-primary"
                                                        aria-label={`${r.seq}. taksit ödendi`}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        defaultValue={r.note}
                                                        key={`note-${r.id}-${r.note}`}
                                                        onBlur={(e) =>
                                                            void updateNote(r, e.target.value)
                                                        }
                                                        placeholder="—"
                                                        className="w-full min-w-[8rem] rounded border border-transparent bg-transparent px-2 py-1 outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-primary/30"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
