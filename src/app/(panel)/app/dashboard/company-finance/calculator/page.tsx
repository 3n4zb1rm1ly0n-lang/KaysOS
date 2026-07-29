'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface CalcLine {
    id: string;
    name: string;
    percentage: number;
    sort_order: number;
    is_deduction: boolean;
}

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export default function CompanyFinanceCalculatorPage() {
    const [lines, setLines] = useState<CalcLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [grossInput, setGrossInput] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPct, setNewPct] = useState('20');
    const [draftNames, setDraftNames] = useState<Record<string, string>>({});
    const [draftPcts, setDraftPcts] = useState<Record<string, string>>({});

    const gross = useMemo(() => {
        const n = parseFloat(grossInput.replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }, [grossInput]);

    const syncDrafts = useCallback((rows: CalcLine[]) => {
        const names: Record<string, string> = {};
        const pcts: Record<string, string> = {};
        rows.forEach((r) => {
            names[r.id] = r.name;
            pcts[r.id] = fmtPct(Number(r.percentage));
        });
        setDraftNames(names);
        setDraftPcts(pcts);
    }, []);

    const fetchLines = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('company_finance_calc_lines')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (err) {
            setError(
                err.message.includes('company_finance_calc_lines')
                    ? `${err.message} — supabase_setup.sql dosyasını SQL Editor’da çalıştırın.`
                    : err.message
            );
            setLines([]);
        } else {
            const rows = (data || []).map((r) => ({
                id: r.id as string,
                name: String(r.name || ''),
                percentage: Number(r.percentage) || 0,
                sort_order: Number(r.sort_order) || 0,
                is_deduction: r.is_deduction !== false
            }));
            setLines(rows);
            syncDrafts(rows);
        }
        setLoading(false);
    }, [syncDrafts]);

    useEffect(() => {
        fetchLines();
    }, [fetchLines]);

    const lineAmounts = useMemo(() => {
        return lines.map((line) => {
            const pct = parseFloat((draftPcts[line.id] ?? String(line.percentage)).replace(',', '.'));
            const p = Number.isFinite(pct) ? pct : 0;
            const amount = (gross * p) / 100;
            return { id: line.id, percentage: p, amount, is_deduction: line.is_deduction };
        });
    }, [lines, draftPcts, gross]);

    const totalDeductions = useMemo(
        () =>
            lineAmounts
                .filter((l) => l.is_deduction)
                .reduce((acc, l) => acc + l.amount, 0),
        [lineAmounts]
    );

    const totalAdditions = useMemo(
        () =>
            lineAmounts
                .filter((l) => !l.is_deduction)
                .reduce((acc, l) => acc + l.amount, 0),
        [lineAmounts]
    );

    const net = gross - totalDeductions + totalAdditions;

    const saveLine = async (id: string) => {
        const name = (draftNames[id] || '').trim();
        const pct = parseFloat((draftPcts[id] || '0').replace(',', '.'));
        if (!name) {
            alert('Satır adı boş olamaz.');
            return;
        }
        if (!Number.isFinite(pct) || pct < 0) {
            alert('Geçerli bir yüzde girin (0 veya üzeri).');
            return;
        }

        setSavingId(id);
        const { error: err } = await supabase
            .from('company_finance_calc_lines')
            .update({ name, percentage: pct })
            .eq('id', id);

        setSavingId(null);
        if (err) {
            alert(`Kayıt başarısız: ${err.message}`);
            return;
        }
        setLines((prev) =>
            prev.map((l) => (l.id === id ? { ...l, name, percentage: pct } : l))
        );
    };

    const deleteLine = async (id: string) => {
        if (!confirm('Bu satırı silmek istiyor musunuz?')) return;
        const { error: err } = await supabase
            .from('company_finance_calc_lines')
            .delete()
            .eq('id', id);
        if (err) {
            alert(`Silinemedi: ${err.message}`);
            return;
        }
        setLines((prev) => prev.filter((l) => l.id !== id));
        setDraftNames((d) => {
            const next = { ...d };
            delete next[id];
            return next;
        });
        setDraftPcts((d) => {
            const next = { ...d };
            delete next[id];
            return next;
        });
    };

    const addLine = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim();
        const pct = parseFloat(newPct.replace(',', '.'));
        if (!name) return;
        if (!Number.isFinite(pct) || pct < 0) {
            alert('Geçerli bir yüzde girin.');
            return;
        }

        setAdding(true);
        const sort_order =
            lines.length === 0 ? 0 : Math.max(...lines.map((l) => l.sort_order)) + 1;

        const { data, error: err } = await supabase
            .from('company_finance_calc_lines')
            .insert([{ name, percentage: pct, sort_order, is_deduction: true }])
            .select()
            .single();

        setAdding(false);
        if (err || !data) {
            alert(`Eklenemedi: ${err?.message || 'Bilinmeyen hata'}`);
            return;
        }

        const row: CalcLine = {
            id: data.id,
            name: data.name,
            percentage: Number(data.percentage),
            sort_order: Number(data.sort_order) || 0,
            is_deduction: data.is_deduction !== false
        };
        setLines((prev) => [...prev, row]);
        setDraftNames((d) => ({ ...d, [row.id]: row.name }));
        setDraftPcts((d) => ({ ...d, [row.id]: fmtPct(row.percentage) }));
        setNewName('');
        setNewPct('20');
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Hesaplama</h2>
                <p className="text-muted-foreground mt-1">
                    Brüt maaş üzerinden yüzde kalemlerini düzenleyin; tutarlar anında hesaplanır.
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="gross-salary" className="block text-sm font-medium text-foreground">
                    Brüt maaş
                </label>
                <div className="relative max-w-sm">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        ₺
                    </span>
                    <input
                        id="gross-salary"
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={grossInput}
                        onChange={(e) => setGrossInput(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background pl-8 pr-4 py-3 text-lg font-medium tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>
            </div>

            {error && (
                <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    {error}
                </p>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                        Formül satırları
                    </h3>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                {!loading && lines.length === 0 && !error && (
                    <p className="text-sm text-muted-foreground">
                        Henüz satır yok. Aşağıdan vergi veya kesinti yüzdesi ekleyin.
                    </p>
                )}

                <ul className="divide-y divide-border border-y border-border">
                    {lines.map((line) => {
                        const computed = lineAmounts.find((l) => l.id === line.id);
                        const pctDisplay = draftPcts[line.id] ?? fmtPct(line.percentage);
                        const pctNum = computed?.percentage ?? Number(line.percentage);

                        return (
                            <li key={line.id} className="py-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-xs text-muted-foreground mb-1">
                                            Kalem adı
                                        </label>
                                        <input
                                            type="text"
                                            value={draftNames[line.id] ?? ''}
                                            onChange={(e) =>
                                                setDraftNames((d) => ({
                                                    ...d,
                                                    [line.id]: e.target.value
                                                }))
                                            }
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div className="w-full sm:w-28">
                                        <label className="block text-xs text-muted-foreground mb-1">
                                            Yüzde
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={pctDisplay}
                                                onChange={(e) =>
                                                    setDraftPcts((d) => ({
                                                        ...d,
                                                        [line.id]: e.target.value
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                                %
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 pb-0.5">
                                        <button
                                            type="button"
                                            onClick={() => saveLine(line.id)}
                                            disabled={savingId === line.id}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {savingId === line.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            Kaydet
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteLine(line.id)}
                                            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            aria-label="Satırı sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                                    <p className="text-muted-foreground">
                                        Brüt maaşın %{fmtPct(pctNum)}&apos;i
                                    </p>
                                    <p className="font-medium tabular-nums text-foreground">
                                        {fmtMoney(computed?.amount ?? 0)}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>

                <form
                    onSubmit={addLine}
                    className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2"
                >
                    <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-1">Yeni kalem</label>
                        <input
                            type="text"
                            placeholder="Örn. Gelir vergisi"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <div className="w-full sm:w-28">
                        <label className="block text-xs text-muted-foreground mb-1">Yüzde</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={newPct}
                                onChange={(e) => setNewPct(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                %
                            </span>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={adding || !newName.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/50 disabled:opacity-50"
                    >
                        {adding ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        Ekle
                    </button>
                </form>
            </div>

            <div className="border-t border-border pt-6 space-y-3">
                <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                    Özet
                </h3>
                <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Brüt</dt>
                        <dd className="font-medium tabular-nums">{fmtMoney(gross)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Toplam kesinti</dt>
                        <dd className="font-medium tabular-nums text-red-400">
                            −{fmtMoney(totalDeductions)}
                        </dd>
                    </div>
                    {totalAdditions > 0 && (
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Toplam ek</dt>
                            <dd className="font-medium tabular-nums text-emerald-400">
                                +{fmtMoney(totalAdditions)}
                            </dd>
                        </div>
                    )}
                    <div className="flex justify-between gap-4 pt-2 border-t border-border text-base">
                        <dt className="font-semibold">Net</dt>
                        <dd className="font-bold tabular-nums">{fmtMoney(net)}</dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
