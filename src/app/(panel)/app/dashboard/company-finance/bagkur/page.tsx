'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    type BagkurMonthRow,
    type BagkurSettings,
    buildSchedule,
    calibrateRatio,
    defaultPrimFor,
    defaultSettings,
    defaultThrough,
    editablePrimYears,
    fmtMoney,
    fmtPct,
    isFutureMonth,
    mergeYearlyPrims,
    monthInterestAmount,
    monthLabel,
    summarizeBagkur
} from '@/lib/bagkur';

const SETTINGS_TABLE = 'company_finance_bagkur_settings';
const MONTHS_TABLE = 'company_finance_bagkur_months';

export default function BagkurPage() {
    const [settings, setSettings] = useState<BagkurSettings>(defaultSettings());
    const [rows, setRows] = useState<BagkurMonthRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [ratioInput, setRatioInput] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);

    const summary = useMemo(
        () => summarizeBagkur(rows, settings.penalty_ratio),
        [rows, settings.penalty_ratio]
    );

    const ensureSeed = useCallback(async (s: BagkurSettings, existing: BagkurMonthRow[]) => {
        const through = defaultThrough();
        const schedule = buildSchedule(
            s.company_start_year,
            s.company_start_month,
            through.year,
            through.month,
            existing,
            s.yearly_prims
        );
        const missing = schedule.filter(
            (r) => !existing.some((e) => e.year === r.year && e.month === r.month)
        );
        if (missing.length === 0) return schedule;

        const payload = missing.map((r) => ({
            year: r.year,
            month: r.month,
            prim_amount: r.prim_amount,
            is_paid: false,
            paid_at: null,
            note: ''
        }));
        const { error: upErr } = await supabase.from(MONTHS_TABLE).upsert(payload, {
            onConflict: 'year,month'
        });
        if (upErr) throw upErr;

        const { data, error: qErr } = await supabase
            .from(MONTHS_TABLE)
            .select('id, year, month, prim_amount, is_paid, paid_at, note')
            .order('year')
            .order('month');
        if (qErr) throw qErr;
        return (data ?? []).map(mapMonth);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const [settingsRes, monthsRes] = await Promise.all([
            supabase.from(SETTINGS_TABLE).select('*').limit(1).maybeSingle(),
            supabase
                .from(MONTHS_TABLE)
                .select('id, year, month, prim_amount, is_paid, paid_at, note')
                .order('year')
                .order('month')
        ]);

        if (settingsRes.error || monthsRes.error) {
            const msg = settingsRes.error?.message || monthsRes.error?.message || 'Yükleme hatası';
            setError(
                msg.includes('does not exist') || settingsRes.error?.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_bagkur.sql (veya add_bagkur_yearly_prims.sql) çalıştırın.'
                    : msg
            );
            setLoading(false);
            return;
        }

        let s: BagkurSettings = defaultSettings();
        if (settingsRes.data) {
            s = mapSettings(settingsRes.data);
        } else {
            const { data: inserted, error: insErr } = await supabase
                .from(SETTINGS_TABLE)
                .insert({
                    company_start_year: s.company_start_year,
                    company_start_month: s.company_start_month,
                    penalty_ratio: s.penalty_ratio,
                    sgk_principal_ref: s.sgk_principal_ref,
                    sgk_penalty_ref: s.sgk_penalty_ref,
                    sgk_total_ref: s.sgk_total_ref,
                    yearly_prims: s.yearly_prims,
                    note: ''
                })
                .select('*')
                .single();
            if (insErr) {
                setError(insErr.message);
                setLoading(false);
                return;
            }
            s = mapSettings(inserted);
        }

        try {
            const existing = (monthsRes.data ?? []).map(mapMonth);
            const seeded = await ensureSeed(s, existing);
            setSettings(s);
            setRatioInput(String(Math.round(s.penalty_ratio * 10000) / 100));
            setRows(seeded);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Seed hatası');
        }
        setLoading(false);
    }, [ensureSeed]);

    useEffect(() => {
        void load();
    }, [load]);

    const saveSettings = useCallback(async () => {
        setSaving(true);
        setError(null);
        const pct = parseFloat(ratioInput.replace(',', '.'));
        const ratio = Number.isFinite(pct) ? pct / 100 : settings.penalty_ratio;
        const next = {
            ...settings,
            penalty_ratio: ratio,
            yearly_prims: mergeYearlyPrims(settings.yearly_prims)
        };

        const { error: upErr } = await supabase
            .from(SETTINGS_TABLE)
            .update({
                penalty_ratio: next.penalty_ratio,
                sgk_principal_ref: next.sgk_principal_ref,
                sgk_penalty_ref: next.sgk_penalty_ref,
                sgk_total_ref: next.sgk_total_ref,
                yearly_prims: next.yearly_prims,
                note: next.note
            })
            .eq('id', settings.id!);

        if (upErr) {
            setError(
                upErr.message.includes('yearly_prims')
                    ? 'yearly_prims kolonu yok. Supabase’te add_bagkur_yearly_prims.sql çalıştırın.'
                    : upErr.message
            );
            setSaving(false);
            return;
        }

        // Ödenmemiş ayların primini yıl ayarına göre güncelle
        const updates: { year: number; month: number; prim_amount: number }[] = [];
        for (const r of rows) {
            if (r.is_paid) continue;
            const target = defaultPrimFor(r.year, r.month, next.yearly_prims);
            if (Math.abs(target - Number(r.prim_amount)) > 0.001) {
                updates.push({ year: r.year, month: r.month, prim_amount: target });
            }
        }
        if (updates.length > 0) {
            for (const u of updates) {
                const { error: mErr } = await supabase
                    .from(MONTHS_TABLE)
                    .update({ prim_amount: u.prim_amount })
                    .eq('year', u.year)
                    .eq('month', u.month)
                    .eq('is_paid', false);
                if (mErr) {
                    setError(mErr.message);
                    setSaving(false);
                    return;
                }
            }
            setRows((prev) =>
                prev.map((r) => {
                    if (r.is_paid) return r;
                    const t = defaultPrimFor(r.year, r.month, next.yearly_prims);
                    return { ...r, prim_amount: t };
                })
            );
        }

        setSettings(next);
        setStatus(
            updates.length > 0
                ? `Ayarlar kaydedildi. ${updates.length} ödenmemiş ay primi güncellendi.`
                : 'Ayarlar kaydedildi.'
        );
        setSaving(false);
    }, [ratioInput, settings, rows]);

    const calibrate = useCallback(() => {
        const ratio = calibrateRatio(summary.unpaidPrincipal, settings.sgk_penalty_ref);
        setRatioInput(String(Math.round(ratio * 10000) / 100));
        setSettings((s) => ({ ...s, penalty_ratio: ratio }));
        setStatus(
            `Oran kalibre edildi: ${fmtPct(ratio)} (SGK ceza ÷ ödenmemiş ana). Kaydet’e bas.`
        );
    }, [summary.unpaidPrincipal, settings.sgk_penalty_ref]);

    const togglePaid = useCallback(
        async (row: BagkurMonthRow, paid: boolean) => {
            setSaving(true);
            setError(null);
            const payload = {
                is_paid: paid,
                paid_at: paid ? new Date().toISOString().slice(0, 10) : null
            };
            const { error: upErr } = await supabase
                .from(MONTHS_TABLE)
                .update(payload)
                .eq('year', row.year)
                .eq('month', row.month);
            if (upErr) {
                setError(upErr.message);
                setSaving(false);
                return;
            }
            setRows((prev) =>
                prev.map((r) =>
                    r.year === row.year && r.month === row.month
                        ? { ...r, ...payload }
                        : r
                )
            );
            setSaving(false);
        },
        []
    );

    const updatePrim = useCallback(async (row: BagkurMonthRow, raw: string) => {
        const n = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) return;
        const { error: upErr } = await supabase
            .from(MONTHS_TABLE)
            .update({ prim_amount: n })
            .eq('year', row.year)
            .eq('month', row.month);
        if (upErr) {
            setError(upErr.message);
            return;
        }
        setRows((prev) =>
            prev.map((r) =>
                r.year === row.year && r.month === row.month ? { ...r, prim_amount: n } : r
            )
        );
    }, []);

    const years = useMemo(() => {
        const set = new Set(rows.map((r) => r.year));
        return Array.from(set).sort((a, b) => a - b);
    }, [rows]);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Shield className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">4/b</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Bağkur</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Açılış 18.12.2024 — Aralık 2024’ten itibaren indirimsiz taban prim.
                        Faiz oranı e-Devlet bakiyesinden türetilmiş, düzenlenebilir.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setSettingsOpen((o) => !o)}
                    className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary/50"
                >
                    {settingsOpen ? 'Ayarları gizle' : 'Faiz / prim ayarları'}
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

            {settingsOpen && (
                <section className="rounded-xl border border-border p-4 space-y-4">
                    <h2 className="text-sm font-semibold">Faiz ve e-Devlet referansı</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Faiz oranı (%)</span>
                            <input
                                value={ratioInput}
                                onChange={(e) => setRatioInput(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">SGK ana borç ref.</span>
                            <input
                                type="number"
                                step="0.01"
                                value={settings.sgk_principal_ref}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        sgk_principal_ref: parseFloat(e.target.value) || 0
                                    }))
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">SGK ceza ref.</span>
                            <input
                                type="number"
                                step="0.01"
                                value={settings.sgk_penalty_ref}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        sgk_penalty_ref: parseFloat(e.target.value) || 0
                                    }))
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">SGK toplam ref.</span>
                            <input
                                type="number"
                                step="0.01"
                                value={settings.sgk_total_ref}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        sgk_total_ref: parseFloat(e.target.value) || 0
                                    }))
                                }
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                    </div>

                    <div className="pt-2 border-t border-border space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold">Yıllık Bağkur primi (indirimsiz)</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Yeni yıllar için tutar belli olunca buradan gir. Kayınca ödenmemiş
                                aylar güncellenir (ödenen aylara dokunulmaz). 0 = henüz belli değil.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {editablePrimYears(
                                settings.company_start_year,
                                defaultThrough().year
                            ).map((y) => (
                                <label key={y} className="space-y-1 text-sm">
                                    <span className="text-xs text-muted-foreground">{y}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={settings.yearly_prims[String(y)] ?? 0}
                                        onChange={(e) => {
                                            const n = parseFloat(e.target.value);
                                            setSettings((s) => ({
                                                ...s,
                                                yearly_prims: {
                                                    ...s.yearly_prims,
                                                    [String(y)]: Number.isFinite(n) ? n : 0
                                                }
                                            }));
                                        }}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={saving || !settings.id}
                            onClick={() => void saveSettings()}
                            className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            Kaydet
                        </button>
                        <button
                            type="button"
                            onClick={calibrate}
                            className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary/50"
                        >
                            SGK cezasına kalibre et
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Varsayılan oran{' '}
                        {fmtPct(settings.sgk_penalty_ref / settings.sgk_principal_ref)} ={' '}
                        {fmtMoney(settings.sgk_penalty_ref)} ÷{' '}
                        {fmtMoney(settings.sgk_principal_ref)}. Faiz = tahakkuk etmiş ödenmemiş
                        prim × oran. Gelecek aylar listede görünür ama borca dahil edilmez.
                    </p>
                </section>
            )}

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Ana borç" value={fmtMoney(summary.unpaidPrincipal)} hint={`${summary.unpaidMonths} ay ödenmedi`} />
                <Kpi
                    label="Faiz / ceza"
                    value={fmtMoney(summary.interest)}
                    hint={fmtPct(settings.penalty_ratio)}
                />
                <Kpi
                    label="Toplam borç"
                    value={fmtMoney(summary.grandTotal)}
                    hint="Ana + faiz"
                    emphasize
                />
                <Kpi
                    label="e-Devlet ref."
                    value={fmtMoney(settings.sgk_total_ref)}
                    hint={`Ana ${fmtMoney(settings.sgk_principal_ref)}`}
                />
            </section>

            {/* Yıllık özet */}
            <section className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/20">
                    <h2 className="text-sm font-semibold">Yıllık özet</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr className="border-b border-border">
                                <th className="text-left font-medium px-4 py-2">Yıl</th>
                                <th className="text-right font-medium px-4 py-2">Ödenmemiş ana</th>
                                <th className="text-right font-medium px-4 py-2">Faiz</th>
                                <th className="text-right font-medium px-4 py-2">Toplam</th>
                                <th className="text-right font-medium px-4 py-2">Ödenen ay</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {summary.byYear.map((y) => (
                                <tr key={y.year}>
                                    <td className="px-4 py-2 font-medium">{y.year}</td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                        {fmtMoney(y.unpaidPrincipal)}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">
                                        {fmtMoney(y.interest)}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                                        {fmtMoney(y.total)}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                                        {y.paidMonths}/{y.months}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Yükleniyor…</span>
                </div>
            ) : (
                years.map((year) => (
                    <section key={year} className="rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-secondary/20 flex justify-between">
                            <h2 className="text-sm font-semibold">{year}</h2>
                            <span className="text-xs text-muted-foreground">
                                Prim düzenlenebilir · varsayılan ödenmedi
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-muted-foreground">
                                    <tr className="border-b border-border">
                                        <th className="text-left font-medium px-4 py-2">Ay</th>
                                        <th className="text-right font-medium px-4 py-2">Prim</th>
                                        <th className="text-right font-medium px-4 py-2">Faiz</th>
                                        <th className="text-center font-medium px-4 py-2">Ödendi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows
                                        .filter((r) => r.year === year)
                                        .map((row) => {
                                            const future = isFutureMonth(row);
                                            const faiz = monthInterestAmount(
                                                row,
                                                settings.penalty_ratio
                                            );
                                            return (
                                                <tr
                                                    key={`${row.year}-${row.month}`}
                                                    className={
                                                        row.is_paid
                                                            ? 'opacity-60'
                                                            : future
                                                              ? 'opacity-50'
                                                              : ''
                                                    }
                                                >
                                                    <td className="px-4 py-2">
                                                        {monthLabel(row.month)} {row.year}
                                                        {future && (
                                                            <span className="ml-2 text-[11px] text-muted-foreground">
                                                                planlanan
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            defaultValue={row.prim_amount}
                                                            key={`prim-${row.year}-${row.month}-${row.prim_amount}`}
                                                            onBlur={(e) =>
                                                                void updatePrim(row, e.target.value)
                                                            }
                                                            className="w-32 ml-auto block rounded-lg border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                                                        {faiz === null
                                                            ? '—'
                                                            : row.is_paid
                                                              ? fmtMoney(0)
                                                              : fmtMoney(faiz)}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={row.is_paid}
                                                            disabled={saving || future}
                                                            onChange={(e) =>
                                                                void togglePaid(
                                                                    row,
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="h-4 w-4 accent-primary"
                                                            aria-label={`${monthLabel(row.month)} ödendi`}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))
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
            className={`rounded-xl border border-border p-4 ${emphasize ? 'bg-primary/5 border-primary/30' : ''}`}
        >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div
                className={`mt-1 text-lg sm:text-xl font-semibold tabular-nums ${emphasize ? 'text-primary' : ''}`}
            >
                {value}
            </div>
            {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
    );
}

function mapSettings(row: Record<string, unknown>): BagkurSettings {
    return {
        id: String(row.id),
        company_start_year: Number(row.company_start_year) || 2024,
        company_start_month: Number(row.company_start_month) || 12,
        penalty_ratio: Number(row.penalty_ratio) || defaultSettings().penalty_ratio,
        sgk_principal_ref: Number(row.sgk_principal_ref) || 182304.32,
        sgk_penalty_ref: Number(row.sgk_penalty_ref) || 78392.89,
        sgk_total_ref: Number(row.sgk_total_ref) || 284313.69,
        yearly_prims: mergeYearlyPrims(row.yearly_prims),
        note: String(row.note ?? '')
    };
}

function mapMonth(row: Record<string, unknown>): BagkurMonthRow {
    return {
        id: row.id ? String(row.id) : undefined,
        year: Number(row.year),
        month: Number(row.month),
        prim_amount: Number(row.prim_amount) || 0,
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ? String(row.paid_at) : null,
        note: String(row.note ?? '')
    };
}
