'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Landmark, Loader2, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    type TaxDebt,
    type TaxInstallmentRow,
    type TaxLumpDebt,
    DEFAULT_DUE_DAY,
    DEFAULT_START_MONTH,
    buildInstallmentRows,
    defaultLumpDebtSeeds,
    defaultSeedDebts,
    defaultStartYear,
    formatDueLabel,
    fmtMoney,
    isInstallmentDueThisMonth,
    isInstallmentOverdue,
    monthLabel,
    rebuildUnpaidSchedule,
    summarizeLumpDebts,
    summarizeTaxInstallments
} from '@/lib/tax-installments';

const DEBTS_TABLE = 'company_finance_tax_installment_debts';
const ROWS_TABLE = 'company_finance_tax_installment_rows';
const LUMP_TABLE = 'company_finance_tax_lump_debts';

type BulkDraft = {
    id: string;
    name: string;
    total_amount: string;
    installment_count: number;
};

function mapDebt(row: Record<string, unknown>): TaxDebt {
    return {
        id: String(row.id),
        name: String(row.name ?? ''),
        total_amount: Number(row.total_amount) || 0,
        installment_count: Number(row.installment_count) || 12,
        start_year: Number(row.start_year),
        start_month: Number(row.start_month),
        due_day: Number(row.due_day) || DEFAULT_DUE_DAY,
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

function mapLump(row: Record<string, unknown>): TaxLumpDebt {
    return {
        id: String(row.id),
        name: String(row.name ?? ''),
        amount: Number(row.amount) || 0,
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ? String(row.paid_at) : null,
        note: String(row.note ?? ''),
        sort_order: Number(row.sort_order) || 0
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
    const [lumps, setLumps] = useState<TaxLumpDebt[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [draft, setDraft] = useState<TaxDebt | null>(null);
    const [bulk, setBulk] = useState<BulkDraft[]>([]);

    const summary = useMemo(() => summarizeTaxInstallments(debts, rows), [debts, rows]);
    const lumpSummary = useMemo(() => summarizeLumpDebts(lumps), [lumps]);
    const active = useMemo(
        () => debts.find((d) => d.id === activeId) ?? debts[0] ?? null,
        [debts, activeId]
    );
    const activeRows = useMemo(() => {
        if (!active) return [];
        return rows.filter((r) => r.debt_id === active.id).sort((a, b) => a.seq - b.seq);
    }, [rows, active]);
    const activeDebtSummary = useMemo(
        () => summary.byDebt.find((d) => d.debtId === active?.id),
        [summary, active]
    );

    const syncBulkFromDebts = useCallback((list: TaxDebt[]) => {
        setBulk(
            list.map((d) => ({
                id: d.id,
                name: d.name,
                total_amount: d.total_amount ? String(d.total_amount) : '',
                installment_count: d.installment_count
            }))
        );
    }, []);

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

    const rebuildDebtRows = useCallback(
        async (debt: TaxDebt, existing: TaxInstallmentRow[]) => {
            const { keep, create } = rebuildUnpaidSchedule(debt, existing);
            const unpaidIds = existing
                .filter((r) => r.debt_id === debt.id && !r.is_paid && r.id)
                .map((r) => r.id!);

            if (unpaidIds.length > 0) {
                const { error: delErr } = await supabase.from(ROWS_TABLE).delete().in('id', unpaidIds);
                if (delErr) throw delErr;
            }

            let created: TaxInstallmentRow[] = [];
            if (create.length > 0) {
                const { data, error: insErr } = await supabase
                    .from(ROWS_TABLE)
                    .insert(create)
                    .select('id, debt_id, seq, year, month, amount, is_paid, paid_at, note');
                if (insErr) throw insErr;
                created = (data ?? []).map(mapRow);
            }

            return [
                ...existing.filter((r) => r.debt_id !== debt.id),
                ...keep,
                ...created
            ];
        },
        []
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const [debtsRes, rowsRes, lumpRes] = await Promise.all([
            supabase
                .from(DEBTS_TABLE)
                .select(
                    'id, name, total_amount, installment_count, start_year, start_month, due_day, sort_order, note'
                )
                .order('sort_order'),
            supabase
                .from(ROWS_TABLE)
                .select('id, debt_id, seq, year, month, amount, is_paid, paid_at, note')
                .order('seq'),
            supabase
                .from(LUMP_TABLE)
                .select('id, name, amount, is_paid, paid_at, note, sort_order')
                .order('sort_order')
        ]);

        if (debtsRes.error || rowsRes.error) {
            const msg = debtsRes.error?.message || rowsRes.error?.message || 'Yükleme hatası';
            const missingDue =
                msg.includes('due_day') || debtsRes.error?.message?.includes('due_day');
            setError(
                msg.includes('does not exist') || debtsRes.error?.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_tax_installments.sql çalıştırın.'
                    : missingDue
                      ? 'due_day kolonu yok. Supabase’te create_tax_installments.sql’i yeniden çalıştırın.'
                      : msg
            );
            setLoading(false);
            return;
        }

        if (lumpRes.error) {
            const msg = lumpRes.error.message;
            setError(
                msg.includes('does not exist') || lumpRes.error.code === '42P01'
                    ? 'Vadesi geçmiş borç tablosu yok. Supabase’te create_tax_installments.sql çalıştırın.'
                    : msg
            );
            setLoading(false);
            return;
        }

        let debtList = (debtsRes.data ?? []).map(mapDebt);
        let rowList = (rowsRes.data ?? []).map(mapRow);
        let lumpList = (lumpRes.data ?? []).map(mapLump);

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
                        start_month: s.start_month ?? DEFAULT_START_MONTH,
                        due_day: s.due_day ?? DEFAULT_DUE_DAY,
                        sort_order: s.sort_order,
                        note: s.note ?? ''
                    }))
                )
                .select(
                    'id, name, total_amount, installment_count, start_year, start_month, due_day, sort_order, note'
                );
            if (seedErr) {
                setError(seedErr.message);
                setLoading(false);
                return;
            }
            debtList = (inserted ?? []).map(mapDebt);
        }

        if (lumpList.length === 0) {
            const seeds = defaultLumpDebtSeeds();
            const { data: inserted, error: seedErr } = await supabase
                .from(LUMP_TABLE)
                .insert(seeds)
                .select('id, name, amount, is_paid, paid_at, note, sort_order');
            if (seedErr) {
                setError(seedErr.message);
                setLoading(false);
                return;
            }
            lumpList = (inserted ?? []).map(mapLump);
        }

        try {
            for (const d of debtList) {
                rowList = await ensureRowsForDebt(d, rowList);
            }
            setDebts(debtList);
            setRows(rowList);
            setLumps(lumpList);
            syncBulkFromDebts(debtList);
            setActiveId((prev) => prev ?? debtList[0]?.id ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Seed hatası');
        }
        setLoading(false);
    }, [ensureRowsForDebt, syncBulkFromDebts]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (active) setDraft({ ...active });
    }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const applyBulkEqualSplit = useCallback(async () => {
        if (bulk.length === 0) return;
        setSaving(true);
        setError(null);
        setStatus(null);

        let nextDebts = [...debts];
        let nextRows = [...rows];

        try {
            for (const b of bulk) {
                const existing = nextDebts.find((d) => d.id === b.id);
                if (!existing) continue;
                const total = parseFloat(String(b.total_amount).replace(',', '.'));
                const total_amount = Number.isFinite(total) && total >= 0 ? total : 0;
                const installment_count = Math.min(
                    60,
                    Math.max(1, Math.round(Number(b.installment_count) || existing.installment_count))
                );
                const name = b.name.trim() || existing.name;
                const payload = {
                    name,
                    total_amount,
                    installment_count,
                    start_year: existing.start_year || defaultStartYear(),
                    start_month: existing.start_month || DEFAULT_START_MONTH,
                    due_day: existing.due_day || DEFAULT_DUE_DAY
                };

                // İlk kurulumda Eylül/30’a sabitle (henüz ödeme yoksa)
                const hasPaid = nextRows.some((r) => r.debt_id === b.id && r.is_paid);
                if (!hasPaid) {
                    payload.start_month = DEFAULT_START_MONTH;
                    payload.due_day = DEFAULT_DUE_DAY;
                    payload.start_year = existing.start_year || defaultStartYear();
                }

                const { error: upErr } = await supabase
                    .from(DEBTS_TABLE)
                    .update(payload)
                    .eq('id', b.id);
                if (upErr) throw upErr;

                const updated: TaxDebt = { ...existing, ...payload };
                nextDebts = nextDebts.map((d) => (d.id === b.id ? updated : d));
                nextRows = await rebuildDebtRows(updated, nextRows);
            }

            setDebts(nextDebts);
            setRows(nextRows);
            syncBulkFromDebts(nextDebts);
            setStatus(
                '4 borç kaydedildi; taksitler eşit bölündü (Eylül başlangıç, vade her ayın 30’u).'
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Toplu kayıt hatası');
        }
        setSaving(false);
    }, [bulk, debts, rows, rebuildDebtRows, syncBulkFromDebts]);

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
            installment_count: Math.min(
                60,
                Math.max(1, Math.round(Number(draft.installment_count) || 12))
            ),
            start_year: Number(draft.start_year),
            start_month: Math.min(12, Math.max(1, Number(draft.start_month))),
            due_day: Math.min(31, Math.max(1, Number(draft.due_day) || DEFAULT_DUE_DAY)),
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
        setDebts((prev) => {
            const list = prev.map((d) => (d.id === draft.id ? nextDebt : d));
            syncBulkFromDebts(list);
            return list;
        });
        setStatus('Borç ayarları kaydedildi.');
        setSaving(false);
    }, [draft, syncBulkFromDebts]);

    const regenerateSchedule = useCallback(async () => {
        if (!active) return;
        const debt = draft ? { ...active, ...draft } : active;
        setSaving(true);
        setError(null);
        setStatus(null);

        const debtPayload = {
            name: debt.name.trim() || 'Borç',
            total_amount: Number(debt.total_amount) || 0,
            installment_count: Math.min(
                60,
                Math.max(1, Math.round(Number(debt.installment_count) || 12))
            ),
            start_year: Number(debt.start_year),
            start_month: Math.min(12, Math.max(1, Number(debt.start_month))),
            due_day: Math.min(31, Math.max(1, Number(debt.due_day) || DEFAULT_DUE_DAY)),
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

        try {
            const nextRows = await rebuildDebtRows(updatedDebt, rows);
            setDebts((prev) => {
                const list = prev.map((d) => (d.id === updatedDebt.id ? updatedDebt : d));
                syncBulkFromDebts(list);
                return list;
            });
            setDraft(updatedDebt);
            setRows(nextRows);
            setStatus('Taksitler yenilendi (ödenenler korundu).');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yenileme hatası');
        }
        setSaving(false);
    }, [active, draft, rows, rebuildDebtRows, syncBulkFromDebts]);

    const updateLump = useCallback(
        async (id: string, patch: Partial<TaxLumpDebt>) => {
            const { error: upErr } = await supabase.from(LUMP_TABLE).update(patch).eq('id', id);
            if (upErr) {
                setError(upErr.message);
                return;
            }
            setLumps((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
        },
        []
    );

    const toggleLumpPaid = useCallback(
        async (item: TaxLumpDebt, paid: boolean) => {
            setSaving(true);
            setError(null);
            await updateLump(item.id, {
                is_paid: paid,
                paid_at: paid ? new Date().toISOString().slice(0, 10) : null
            });
            setSaving(false);
        },
        [updateLump]
    );

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
                        Taksitli 4 borç (Eylül’den, her ayın 30’u) + vadesi geçmiş planı olmayan
                        borçlar.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setSettingsOpen((o) => !o)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                >
                    <Settings2 className="h-4 w-4" />
                    {settingsOpen ? 'Detay ayarı gizle' : 'Seçili borç ayarı'}
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

            {/* Toplu tutar girişi */}
            <section className="space-y-4 rounded-xl border border-border p-4">
                <div>
                    <h2 className="text-sm font-semibold">Taksitli borçlar — toplam tutarlar</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        4 borcun toplamını yaz → eşit böl. İlk taksit Eylül, vade her ayın 30’u.
                        Ödenen taksitler korunur.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr className="border-b border-border">
                                <th className="px-2 py-2 text-left font-medium">Borç</th>
                                <th className="px-2 py-2 text-right font-medium">Toplam ₺</th>
                                <th className="px-2 py-2 text-right font-medium">Ay</th>
                                <th className="px-2 py-2 text-right font-medium">≈ Taksit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {bulk.map((b, idx) => {
                                const total =
                                    parseFloat(String(b.total_amount).replace(',', '.')) || 0;
                                const per =
                                    b.installment_count > 0
                                        ? total / b.installment_count
                                        : 0;
                                return (
                                    <tr key={b.id}>
                                        <td className="px-2 py-2">
                                            <input
                                                value={b.name}
                                                onChange={(e) =>
                                                    setBulk((prev) =>
                                                        prev.map((x, i) =>
                                                            i === idx
                                                                ? { ...x, name: e.target.value }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="w-full min-w-[8rem] rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                value={b.total_amount}
                                                onChange={(e) =>
                                                    setBulk((prev) =>
                                                        prev.map((x, i) =>
                                                            i === idx
                                                                ? {
                                                                      ...x,
                                                                      total_amount: e.target.value
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                                placeholder="0"
                                                className="ml-auto w-36 rounded-lg border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                            <input
                                                type="number"
                                                min={1}
                                                max={60}
                                                value={b.installment_count}
                                                onChange={(e) =>
                                                    setBulk((prev) =>
                                                        prev.map((x, i) =>
                                                            i === idx
                                                                ? {
                                                                      ...x,
                                                                      installment_count:
                                                                          parseInt(
                                                                              e.target.value,
                                                                              10
                                                                          ) || 12
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                                className="ml-auto w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                            {fmtMoney(per)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <button
                    type="button"
                    disabled={saving || bulk.length === 0}
                    onClick={() => void applyBulkEqualSplit()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                    {saving ? 'Kaydediliyor…' : 'Kaydet ve eşit böl'}
                </button>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                    label="Taksitli toplam"
                    value={fmtMoney(summary.total)}
                    hint={`${summary.paidCount + summary.unpaidCount} taksit`}
                />
                <Kpi
                    label="Ödenen"
                    value={fmtMoney(summary.paidAmount)}
                    hint={`${summary.paidCount} taksit · %${Math.round(summary.progress * 100)}`}
                />
                <Kpi
                    label="Kalan (taksit)"
                    value={fmtMoney(summary.unpaidAmount)}
                    hint={`${summary.unpaidCount} taksit`}
                    emphasize
                />
                <Kpi
                    label="Bu ay / geciken taksit"
                    value={fmtMoney(summary.dueThisMonth.amount + summary.overdue.amount)}
                    hint={`${summary.dueThisMonth.count} bu ay · ${summary.overdue.count} geciken`}
                    warn={summary.overdue.count > 0}
                />
            </section>

            <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Taksitli ilerleme</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                        %{Math.round(summary.progress * 100)}
                    </p>
                </div>
                <ProgressBar value={summary.progress} />
            </section>

            {/* Vadesi geçmiş — plan yok */}
            <section className="overflow-hidden rounded-xl border border-amber-500/30">
                <div className="flex flex-col gap-1 border-b border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                            <h2 className="text-sm font-semibold">Vadesi geçmiş borçlar</h2>
                            <p className="text-xs text-muted-foreground">
                                Ödeme planı yok — tutarı gir, ödeyince işaretle.
                            </p>
                        </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                        {fmtMoney(lumpSummary.unpaidAmount)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                            kalan · {lumpSummary.unpaidCount} kalem
                        </span>
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr className="border-b border-border">
                                <th className="px-4 py-2 text-left font-medium">Borç</th>
                                <th className="px-4 py-2 text-right font-medium">Tutar</th>
                                <th className="px-4 py-2 text-center font-medium">Ödendi</th>
                                <th className="px-4 py-2 text-left font-medium">Not</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {lumps.map((item) => (
                                <tr
                                    key={item.id}
                                    className={item.is_paid ? 'bg-emerald-500/5' : undefined}
                                >
                                    <td className="px-4 py-2">
                                        <input
                                            defaultValue={item.name}
                                            key={`ln-${item.id}-${item.name}`}
                                            onBlur={(e) => {
                                                const name = e.target.value.trim();
                                                if (name && name !== item.name) {
                                                    void updateLump(item.id, { name });
                                                }
                                            }}
                                            className="w-full min-w-[10rem] rounded border border-transparent bg-transparent px-1 py-1 font-medium outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-primary/30"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            defaultValue={item.amount || ''}
                                            key={`la-${item.id}-${item.amount}`}
                                            onBlur={(e) => {
                                                const n = parseFloat(
                                                    e.target.value.replace(',', '.')
                                                );
                                                if (!Number.isFinite(n) || n < 0) return;
                                                if (n !== item.amount) {
                                                    void updateLump(item.id, { amount: n });
                                                }
                                            }}
                                            placeholder="0"
                                            className="w-32 rounded border border-transparent bg-transparent px-2 py-1 text-right tabular-nums outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-primary/30"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.is_paid}
                                            disabled={saving}
                                            onChange={(e) =>
                                                void toggleLumpPaid(item, e.target.checked)
                                            }
                                            className="h-4 w-4 accent-primary"
                                            aria-label={`${item.name} ödendi`}
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            defaultValue={item.note}
                                            key={`lnote-${item.id}-${item.note}`}
                                            onBlur={(e) => {
                                                if (e.target.value !== item.note) {
                                                    void updateLump(item.id, {
                                                        note: e.target.value
                                                    });
                                                }
                                            }}
                                            placeholder="—"
                                            className="w-full min-w-[8rem] rounded border border-transparent bg-transparent px-2 py-1 outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-primary/30"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
                                {ds?.paidCount ?? 0}/{d.installment_count} · Eylül→ · ayın{' '}
                                {d.due_day || 30}’ü
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
                    <h2 className="text-sm font-semibold">{draft.name} — detay ayar</h2>
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
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Vade günü</span>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={draft.due_day}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        due_day: parseInt(e.target.value, 10) || DEFAULT_DUE_DAY
                                    })
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
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
                                {' · '}
                                vade ayın {active.due_day || 30}’ü
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
                                    <th className="px-4 py-2 text-left font-medium">Vade</th>
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
                                            Üstteki toplu alandan tutar girip “Kaydet ve eşit böl”
                                            de.
                                        </td>
                                    </tr>
                                ) : (
                                    activeRows.map((r) => {
                                        const dueDay = active.due_day || DEFAULT_DUE_DAY;
                                        const overdue = isInstallmentOverdue(
                                            r.year,
                                            r.month,
                                            dueDay,
                                            r.is_paid
                                        );
                                        const dueThis = isInstallmentDueThisMonth(
                                            r.year,
                                            r.month,
                                            r.is_paid
                                        );
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
                                                    {formatDueLabel(r.year, r.month, dueDay)}
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
