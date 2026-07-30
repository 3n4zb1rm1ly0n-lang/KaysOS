'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import {
    applySteps,
    CALC_OP_LABELS,
    CALC_OPS,
    describeStep,
    formatCompactMathNote,
    parseCalcSteps,
    resolveLineAmounts,
    stepsFromPercentage,
    type CalcOp,
    type CalcSourceType,
    type CalcStep
} from '@/lib/calc-steps';

interface CalcLine {
    id: string;
    name: string;
    percentage: number;
    sort_order: number;
    is_deduction: boolean;
    source_type: CalcSourceType;
    source_line_id: string | null;
    steps: CalcStep[];
}

type DraftStep = {
    op: CalcOp;
    value: string;
};

type DraftLine = {
    name: string;
    source_type: CalcSourceType;
    source_line_id: string | null;
    steps: DraftStep[];
};

function toCalcSteps(steps: DraftStep[]): CalcStep[] {
    return steps.map((s) => {
        const n = parseFloat(s.value.replace(',', '.'));
        return { op: s.op, value: Number.isFinite(n) ? n : 0 };
    });
}

function toDraftSteps(steps: CalcStep[]): DraftStep[] {
    return steps.map((s) => ({ op: s.op, value: fmtNum(s.value) }));
}

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number): string {
    const rounded = Math.round(n * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function firstPercentValue(steps: CalcStep[]): number {
    const p = steps.find((s) => s.op === 'percent');
    return p ? p.value : 0;
}

function isMissingStepsColumnError(err: { message?: string; code?: string } | null): boolean {
    const msg = (err?.message || '').toLowerCase();
    return (
        msg.includes('steps') ||
        msg.includes('source_type') ||
        msg.includes('source_line_id') ||
        err?.code === '42703'
    );
}

export default function CompanyFinanceCalculatorPage() {
    const [lines, setLines] = useState<CalcLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [schemaHint, setSchemaHint] = useState(false);
    const [grossInput, setGrossInput] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newOp, setNewOp] = useState<CalcOp>('percent');
    const [newValue, setNewValue] = useState('20');
    const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});
    const [addStepOp, setAddStepOp] = useState<Record<string, CalcOp>>({});
    const [addStepValue, setAddStepValue] = useState<Record<string, string>>({});
    const [showMathPicker, setShowMathPicker] = useState<Record<string, boolean>>({});

    const gross = useMemo(() => {
        const n = parseFloat(grossInput.replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }, [grossInput]);

    const syncDrafts = useCallback((rows: CalcLine[]) => {
        const next: Record<string, DraftLine> = {};
        rows.forEach((r) => {
            next[r.id] = {
                name: r.name,
                source_type: r.source_type,
                source_line_id: r.source_line_id,
                steps: toDraftSteps(r.steps)
            };
        });
        setDrafts(next);
    }, []);

    const mapRow = (r: Record<string, unknown>): CalcLine => {
        const percentage = Number(r.percentage) || 0;
        let steps = parseCalcSteps(r.steps);
        if (steps.length === 0 && percentage) {
            steps = stepsFromPercentage(percentage);
        }
        const sourceType = r.source_type === 'line' ? 'line' : 'gross';
        return {
            id: String(r.id),
            name: String(r.name || ''),
            percentage,
            sort_order: Number(r.sort_order) || 0,
            is_deduction: r.is_deduction !== false,
            source_type: sourceType,
            source_line_id: r.source_line_id ? String(r.source_line_id) : null,
            steps
        };
    };

    const fetchLines = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSchemaHint(false);

        const full = await supabase
            .from('company_finance_calc_lines')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (full.error && isMissingStepsColumnError(full.error)) {
            setSchemaHint(true);
            const basic = await supabase
                .from('company_finance_calc_lines')
                .select('id, name, percentage, sort_order, is_deduction, created_at')
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });

            if (basic.error) {
                setError(
                    basic.error.message.includes('company_finance_calc_lines')
                        ? `${basic.error.message} — supabase_setup.sql dosyasını SQL Editor’da çalıştırın.`
                        : basic.error.message
                );
                setLines([]);
            } else {
                const rows = (basic.data || []).map((r) =>
                    mapRow({
                        ...r,
                        source_type: 'gross',
                        source_line_id: null,
                        steps: stepsFromPercentage(Number(r.percentage) || 0)
                    })
                );
                setLines(rows);
                syncDrafts(rows);
            }
            setLoading(false);
            return;
        }

        if (full.error) {
            setError(
                full.error.message.includes('company_finance_calc_lines')
                    ? `${full.error.message} — supabase_setup.sql dosyasını SQL Editor’da çalıştırın.`
                    : full.error.message
            );
            setLines([]);
        } else {
            const rows = (full.data || []).map((r) => mapRow(r as Record<string, unknown>));
            setLines(rows);
            syncDrafts(rows);
        }
        setLoading(false);
    }, [syncDrafts]);

    useEffect(() => {
        fetchLines();
    }, [fetchLines]);

    const workingLines = useMemo(() => {
        return lines.map((line) => {
            const d = drafts[line.id];
            return {
                id: line.id,
                sort_order: line.sort_order,
                is_deduction: line.is_deduction,
                source_type: d?.source_type ?? line.source_type,
                source_line_id: d?.source_line_id ?? line.source_line_id,
                steps: d ? toCalcSteps(d.steps) : line.steps
            };
        });
    }, [lines, drafts]);

    const amounts = useMemo(
        () => resolveLineAmounts(workingLines, gross),
        [workingLines, gross]
    );

    const totalDeductions = useMemo(
        () =>
            workingLines
                .filter((l) => l.is_deduction)
                .reduce((acc, l) => acc + (amounts.get(l.id) ?? 0), 0),
        [workingLines, amounts]
    );

    const totalAdditions = useMemo(
        () =>
            workingLines
                .filter((l) => !l.is_deduction)
                .reduce((acc, l) => acc + (amounts.get(l.id) ?? 0), 0),
        [workingLines, amounts]
    );

    const net = gross - totalDeductions + totalAdditions;

    const updateDraft = (id: string, patch: Partial<DraftLine>) => {
        setDrafts((d) => ({
            ...d,
            [id]: { ...(d[id] || { name: '', source_type: 'gross', source_line_id: null, steps: [] }), ...patch }
        }));
    };

    const updateStep = (lineId: string, index: number, patch: Partial<DraftStep>) => {
        const current = drafts[lineId]?.steps ?? [];
        const next = current.map((s, i) => (i === index ? { ...s, ...patch } : s));
        updateDraft(lineId, { steps: next });
    };

    const removeStep = (lineId: string, index: number) => {
        const current = drafts[lineId]?.steps ?? [];
        updateDraft(lineId, { steps: current.filter((_, i) => i !== index) });
    };

    const appendStep = (lineId: string) => {
        const op = addStepOp[lineId] ?? 'percent';
        const raw = addStepValue[lineId] ?? (op === 'percent' ? '20' : '0');
        const value = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(value)) {
            alert('Geçerli bir sayı girin.');
            return;
        }
        const current = drafts[lineId]?.steps ?? [];
        updateDraft(lineId, { steps: [...current, { op, value: raw.trim() || String(value) }] });
        setShowMathPicker((s) => ({ ...s, [lineId]: false }));
        setAddStepValue((s) => ({ ...s, [lineId]: op === 'percent' ? '20' : '0' }));
    };

    const saveLine = async (id: string) => {
        const draft = drafts[id];
        if (!draft) return;
        const name = draft.name.trim();
        if (!name) {
            alert('Satır adı boş olamaz.');
            return;
        }
        if (draft.steps.length === 0) {
            alert('En az bir matematik adımı ekleyin.');
            return;
        }
        if (draft.source_type === 'line' && !draft.source_line_id) {
            alert('Kaynak satır seçin.');
            return;
        }

        const steps = toCalcSteps(draft.steps);
        const percentage = firstPercentValue(steps);
        const body = {
            name,
            percentage,
            source_type: draft.source_type,
            source_line_id: draft.source_type === 'line' ? draft.source_line_id : null,
            steps
        };

        setSavingId(id);
        let { error: err } = await supabase
            .from('company_finance_calc_lines')
            .update(body)
            .eq('id', id);

        if (err && isMissingStepsColumnError(err)) {
            setSchemaHint(true);
            ({ error: err } = await supabase
                .from('company_finance_calc_lines')
                .update({ name, percentage })
                .eq('id', id));
        }

        setSavingId(null);
        if (err) {
            alert(`Kayıt başarısız: ${err.message}`);
            return;
        }

        setLines((prev) =>
            prev.map((l) =>
                l.id === id
                    ? {
                          ...l,
                          name,
                          percentage,
                          source_type: draft.source_type,
                          source_line_id:
                              draft.source_type === 'line' ? draft.source_line_id : null,
                          steps
                      }
                    : l
            )
        );
        updateDraft(id, { steps: toDraftSteps(steps) });
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
        setLines((prev) =>
            prev.map((l) =>
                l.source_line_id === id
                    ? { ...l, source_type: 'gross' as const, source_line_id: null }
                    : l
            ).filter((l) => l.id !== id)
        );
        setDrafts((d) => {
            const next = { ...d };
            delete next[id];
            for (const key of Object.keys(next)) {
                if (next[key].source_line_id === id) {
                    next[key] = { ...next[key], source_type: 'gross', source_line_id: null };
                }
            }
            return next;
        });
    };

    const addLine = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim();
        const value = parseFloat(newValue.replace(',', '.'));
        if (!name) return;
        if (!Number.isFinite(value)) {
            alert('Geçerli bir sayı girin.');
            return;
        }

        const steps: CalcStep[] = [{ op: newOp, value }];
        const percentage = firstPercentValue(steps);
        const sort_order =
            lines.length === 0 ? 0 : Math.max(...lines.map((l) => l.sort_order)) + 1;

        setAdding(true);
        const fullBody = {
            name,
            percentage,
            sort_order,
            is_deduction: true,
            source_type: 'gross' as const,
            source_line_id: null,
            steps
        };

        let { data, error: err } = await supabase
            .from('company_finance_calc_lines')
            .insert([fullBody])
            .select()
            .single();

        if (err && isMissingStepsColumnError(err)) {
            setSchemaHint(true);
            ({ data, error: err } = await supabase
                .from('company_finance_calc_lines')
                .insert([{ name, percentage, sort_order, is_deduction: true }])
                .select()
                .single());
        }

        setAdding(false);
        if (err || !data) {
            alert(`Eklenemedi: ${err?.message || 'Bilinmeyen hata'}`);
            return;
        }

        const row = mapRow(data as Record<string, unknown>);
        if (row.steps.length === 0) row.steps = steps;
        setLines((prev) => [...prev, row]);
        setDrafts((d) => ({
            ...d,
            [row.id]: {
                name: row.name,
                source_type: row.source_type,
                source_line_id: row.source_line_id,
                steps: toDraftSteps(row.steps)
            }
        }));
        setNewName('');
        setNewOp('percent');
        setNewValue('20');
    };

    const previousLinesFor = (lineId: string) => {
        const idx = lines.findIndex((l) => l.id === lineId);
        if (idx <= 0) return [];
        return lines.slice(0, idx);
    };

    const sourceLabel = (draft: DraftLine) => {
        if (draft.source_type === 'gross') return 'Brüt maaş';
        const src = lines.find((l) => l.id === draft.source_line_id);
        return src?.name || 'Seçili satır';
    };

    const previewChain = (draft: DraftLine) => {
        const steps = toCalcSteps(draft.steps);
        let base = gross;
        if (draft.source_type === 'line' && draft.source_line_id) {
            base = amounts.get(draft.source_line_id) ?? 0;
        }
        const parts = [
            `${sourceLabel(draft)} ${fmtMoney(base)}`,
            ...steps.map(describeStep)
        ];
        return { parts: parts.join(' → '), result: applySteps(base, steps) };
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Hesaplama</h2>
                <p className="text-muted-foreground mt-1">
                    Her kalem kendi kaynak ve matematik zinciriyle hesaplanır. Burada yalnızca deneme /
                    formül kurulumu yapılır.
                </p>
            </div>

            {schemaHint && (
                <p className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
                    Zincir kolonları henüz yok. Supabase SQL Editor’da{' '}
                    <code className="text-xs">add_calc_line_steps.sql</code> dosyasını çalıştırın;
                    şimdilik yüzde uyumluluk modu kullanılıyor.
                </p>
            )}

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
                        Henüz satır yok. Aşağıdan kalem ve matematik adımı ekleyin.
                    </p>
                )}

                <ul className="divide-y divide-border border-y border-border">
                    {lines.map((line) => {
                        const draft = drafts[line.id] ?? {
                            name: line.name,
                            source_type: line.source_type,
                            source_line_id: line.source_line_id,
                            steps: toDraftSteps(line.steps)
                        };
                        const prev = previousLinesFor(line.id);
                        const preview = previewChain(draft);
                        const pickerOpen = showMathPicker[line.id];

                        return (
                            <li key={line.id} className="py-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-xs text-muted-foreground mb-1">
                                            Kalem adı
                                        </label>
                                        <input
                                            type="text"
                                            value={draft.name}
                                            onChange={(e) =>
                                                updateDraft(line.id, { name: e.target.value })
                                            }
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div className="w-full sm:w-48">
                                        <label className="block text-xs text-muted-foreground mb-1">
                                            Kaynak
                                        </label>
                                        <select
                                            value={
                                                draft.source_type === 'line' && draft.source_line_id
                                                    ? `line:${draft.source_line_id}`
                                                    : 'gross'
                                            }
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === 'gross') {
                                                    updateDraft(line.id, {
                                                        source_type: 'gross',
                                                        source_line_id: null
                                                    });
                                                } else {
                                                    updateDraft(line.id, {
                                                        source_type: 'line',
                                                        source_line_id: v.replace(/^line:/, '')
                                                    });
                                                }
                                            }}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                        >
                                            <option value="gross">Brüt maaş</option>
                                            {prev.map((p) => (
                                                <option key={p.id} value={`line:${p.id}`}>
                                                    {p.name || 'İsimsiz kalem'}
                                                </option>
                                            ))}
                                        </select>
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

                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Matematik zinciri
                                    </p>
                                    {draft.steps.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Henüz adım yok. Matematik ekle ile başlayın.
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {draft.steps.map((step, idx) => (
                                                <li
                                                    key={`${line.id}-step-${idx}`}
                                                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border/80 bg-secondary/20 px-3 py-2"
                                                >
                                                    <span className="text-xs text-muted-foreground w-6">
                                                        {idx + 1}.
                                                    </span>
                                                    <select
                                                        value={step.op}
                                                        onChange={(e) =>
                                                            updateStep(line.id, idx, {
                                                                op: e.target.value as CalcOp
                                                            })
                                                        }
                                                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                                    >
                                                        {CALC_OPS.map((op) => (
                                                            <option key={op} value={op}>
                                                                {CALC_OP_LABELS[op]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="relative w-full sm:w-28">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={step.value}
                                                            onChange={(e) =>
                                                                updateStep(line.id, idx, {
                                                                    value: e.target.value
                                                                })
                                                            }
                                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 pr-7 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                                        />
                                                        {step.op === 'percent' && (
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                                %
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeStep(line.id, idx)}
                                                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 self-start sm:self-center"
                                                        aria-label="Adımı sil"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {pickerOpen ? (
                                        <div className="flex flex-col sm:flex-row sm:items-end gap-2 rounded-lg border border-dashed border-border p-3">
                                            <div className="w-full sm:w-36">
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    İşlem
                                                </label>
                                                <select
                                                    value={addStepOp[line.id] ?? 'percent'}
                                                    onChange={(e) =>
                                                        setAddStepOp((s) => ({
                                                            ...s,
                                                            [line.id]: e.target.value as CalcOp
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                                >
                                                    {CALC_OPS.map((op) => (
                                                        <option key={op} value={op}>
                                                            {CALC_OP_LABELS[op]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-full sm:w-28">
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    Değer
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={
                                                        addStepValue[line.id] ??
                                                        ((addStepOp[line.id] ?? 'percent') ===
                                                        'percent'
                                                            ? '20'
                                                            : '0')
                                                    }
                                                    onChange={(e) =>
                                                        setAddStepValue((s) => ({
                                                            ...s,
                                                            [line.id]: e.target.value
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => appendStep(line.id)}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Adımı ekle
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowMathPicker((s) => ({
                                                        ...s,
                                                        [line.id]: false
                                                    }))
                                                }
                                                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                                            >
                                                Vazgeç
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowMathPicker((s) => ({
                                                    ...s,
                                                    [line.id]: true
                                                }))
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary/50"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Matematik ekle
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                                    <p className="text-muted-foreground break-all">
                                        {preview.parts}
                                    </p>
                                    <p className="font-medium tabular-nums text-foreground shrink-0">
                                        {fmtMoney(preview.result)}
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
                    <div className="w-full sm:w-36">
                        <label className="block text-xs text-muted-foreground mb-1">İlk işlem</label>
                        <select
                            value={newOp}
                            onChange={(e) => setNewOp(e.target.value as CalcOp)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            {CALC_OPS.map((op) => (
                                <option key={op} value={op}>
                                    {CALC_OP_LABELS[op]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full sm:w-28">
                        <label className="block text-xs text-muted-foreground mb-1">Değer</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            {newOp === 'percent' && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    %
                                </span>
                            )}
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

                    {workingLines.length > 0 && (
                        <div className="space-y-2 py-2 border-y border-border/60">
                            {workingLines.map((wl) => {
                                const line = lines.find((l) => l.id === wl.id);
                                const name =
                                    drafts[wl.id]?.name?.trim() || line?.name || 'Kalem';
                                let base = gross;
                                if (wl.source_type === 'line' && wl.source_line_id) {
                                    base = amounts.get(wl.source_line_id) ?? 0;
                                }
                                const note = formatCompactMathNote(base, wl.steps);
                                const amount = amounts.get(wl.id) ?? 0;
                                const sign = wl.is_deduction ? '−' : '+';
                                return (
                                    <div
                                        key={wl.id}
                                        className="flex justify-between gap-4 items-start"
                                    >
                                        <dt className="min-w-0">
                                            <span className="text-foreground">{name}</span>
                                            <span className="block text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
                                                {note}
                                            </span>
                                        </dt>
                                        <dd
                                            className={`font-medium tabular-nums shrink-0 ${
                                                wl.is_deduction
                                                    ? 'text-red-400'
                                                    : 'text-emerald-400'
                                            }`}
                                        >
                                            {sign}
                                            {fmtMoney(amount)}
                                        </dd>
                                    </div>
                                );
                            })}
                        </div>
                    )}

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
