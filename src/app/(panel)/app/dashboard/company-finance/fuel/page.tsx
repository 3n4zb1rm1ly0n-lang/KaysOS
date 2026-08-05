'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Fuel, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    type FuelLog,
    type FuelLogComputed,
    enrichFuelLogs,
    fmtMoney,
    fmtNum,
    litersFrom,
    monthBounds,
    summarizeFuelMonth
} from '@/lib/fuel';

const TABLE = 'company_finance_fuel_logs';

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

function todayISO(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function FuelPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIndex, setMonthIndex] = useState(now.getMonth());
    const [rows, setRows] = useState<FuelLogComputed[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const [fillDate, setFillDate] = useState(todayISO());
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [odometer, setOdometer] = useState('');
    const [note, setNote] = useState('');

    const summary = useMemo(() => summarizeFuelMonth(rows), [rows]);

    const previewLiters = useMemo(() => {
        const a = parseFloat(amount.replace(',', '.'));
        const p = parseFloat(price.replace(',', '.'));
        if (!Number.isFinite(a) || !Number.isFinite(p) || p <= 0) return null;
        return litersFrom(a, p);
    }, [amount, price]);

    const load = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        setStatus(null);
        const { from, to } = monthBounds(y, m);

        const [monthRes, prevRes] = await Promise.all([
            supabase
                .from(TABLE)
                .select('id, fill_date, amount_tl, price_per_liter, odometer_km, note')
                .gte('fill_date', from)
                .lte('fill_date', to)
                .order('fill_date', { ascending: true })
                .order('odometer_km', { ascending: true }),
            supabase
                .from(TABLE)
                .select('id, fill_date, amount_tl, price_per_liter, odometer_km, note')
                .lt('fill_date', from)
                .order('fill_date', { ascending: false })
                .order('odometer_km', { ascending: false })
                .limit(1)
        ]);

        if (monthRes.error) {
            setError(
                monthRes.error.message.includes('does not exist') || monthRes.error.code === '42P01'
                    ? 'Tablo yok. Supabase’te create_fuel_logs.sql çalıştırın.'
                    : monthRes.error.message
            );
            setRows([]);
            setLoading(false);
            return;
        }

        const monthLogs = (monthRes.data ?? []).map(mapLog);
        const prevLog =
            !prevRes.error && prevRes.data?.[0] ? mapLog(prevRes.data[0]) : null;
        const enriched = enrichFuelLogs(prevLog ? [prevLog, ...monthLogs] : monthLogs);
        // Ay satırları (önceki ay köprüsü hariç)
        const monthIds = new Set(monthLogs.map((l) => l.id).filter(Boolean));
        setRows(
            enriched.filter((r) => (r.id ? monthIds.has(r.id) : r.fill_date >= from && r.fill_date <= to))
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void load(year, monthIndex);
    }, [year, monthIndex, load]);

    const shiftMonth = (delta: number) => {
        setMonthIndex((m) => {
            let next = m + delta;
            let y = year;
            if (next < 0) {
                next = 11;
                y -= 1;
            } else if (next > 11) {
                next = 0;
                y += 1;
            }
            setYear(y);
            return next;
        });
    };

    const addFill = async () => {
        setSaving(true);
        setError(null);
        setStatus(null);

        const amount_tl = parseFloat(amount.replace(',', '.'));
        const price_per_liter = parseFloat(price.replace(',', '.'));
        const odometer_km = parseFloat(odometer.replace(',', '.'));

        if (!fillDate) {
            setError('Tarih gerekli.');
            setSaving(false);
            return;
        }
        if (!Number.isFinite(amount_tl) || amount_tl <= 0) {
            setError('Geçerli tutar gir.');
            setSaving(false);
            return;
        }
        if (!Number.isFinite(price_per_liter) || price_per_liter <= 0) {
            setError('Geçerli litre fiyatı gir.');
            setSaving(false);
            return;
        }
        if (!Number.isFinite(odometer_km) || odometer_km < 0) {
            setError('Geçerli gösterge km gir.');
            setSaving(false);
            return;
        }

        const { error: insErr } = await supabase.from(TABLE).insert({
            fill_date: fillDate,
            amount_tl,
            price_per_liter,
            odometer_km,
            note: note.trim()
        });

        if (insErr) {
            setError(insErr.message);
            setSaving(false);
            return;
        }

        setAmount('');
        setPrice('');
        setOdometer('');
        setNote('');
        setStatus('Dolum kaydedildi.');
        setSaving(false);
        await load(year, monthIndex);
    };

    const remove = async (id: string | undefined) => {
        if (!id || !confirm('Bu dolum silinsin mi?')) return;
        setSaving(true);
        const { error: delErr } = await supabase.from(TABLE).delete().eq('id', id);
        setSaving(false);
        if (delErr) {
            setError(delErr.message);
            return;
        }
        setStatus('Silindi.');
        await load(year, monthIndex);
    };

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Fuel className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            Şirket kartı
                        </span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Benzin tüketimi</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gösterge km’sini yaz; litre ve Δ km otomatik. Ay sonu toplam tutar
                        kazançtan düşülür.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        className="p-2 rounded-lg border border-border hover:bg-secondary/50"
                        aria-label="Önceki ay"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-[140px] text-center font-medium">
                        {MONTH_LABELS[monthIndex]} {year}
                    </div>
                    <button
                        type="button"
                        onClick={() => shiftMonth(1)}
                        className="p-2 rounded-lg border border-border hover:bg-secondary/50"
                        aria-label="Sonraki ay"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
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

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Ay toplamı" value={fmtMoney(summary.totalAmount)} hint={`${summary.count} dolum`} emphasize />
                <Kpi label="Toplam litre" value={`${fmtNum(summary.totalLiters, 2)} L`} />
                <Kpi
                    label="Ort. L/100km"
                    value={summary.avgLPer100km != null ? fmtNum(summary.avgLPer100km, 2) : '—'}
                    hint={summary.totalDeltaKm > 0 ? `${fmtNum(summary.totalDeltaKm, 0)} km` : undefined}
                />
                <Kpi
                    label="₺/km"
                    value={summary.tlPerKm != null ? fmtMoney(summary.tlPerKm) : '—'}
                    hint={
                        summary.avgPricePerLiter > 0
                            ? `Ort. ${fmtNum(summary.avgPricePerLiter, 2)} ₺/L`
                            : undefined
                    }
                />
            </section>

            {/* Yeni dolum */}
            <section className="rounded-xl border border-border p-4 md:p-5 space-y-4">
                <h2 className="text-sm font-semibold">Yeni dolum</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="space-y-1 text-sm col-span-2 md:col-span-1">
                        <span className="text-xs text-muted-foreground">Tarih</span>
                        <input
                            type="date"
                            value={fillDate}
                            onChange={(e) => setFillDate(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Tutar (₺)</span>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="455"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Litre fiyatı (₺/L)</span>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="48.50"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Gösterge km</span>
                        <input
                            type="number"
                            step="1"
                            min={0}
                            value={odometer}
                            onChange={(e) => setOdometer(e.target.value)}
                            placeholder="12780"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1 text-sm flex-1 min-w-[160px]">
                        <span className="text-xs text-muted-foreground">Not (opsiyonel)</span>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="İstasyon vb."
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <p className="text-xs text-muted-foreground pb-2">
                        Litre:{' '}
                        <span className="text-foreground font-medium tabular-nums">
                            {previewLiters != null ? `${fmtNum(previewLiters, 2)} L` : '—'}
                        </span>
                    </p>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => void addFill()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        Kaydet
                    </button>
                </div>
            </section>

            {/* Liste */}
            <section className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/20">
                    <h2 className="text-sm font-semibold">Dolumlar</h2>
                </div>
                {loading ? (
                    <div className="flex justify-center py-16 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                        Bu ay henüz dolum yok.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th className="text-left font-medium px-3 py-2">Tarih</th>
                                    <th className="text-right font-medium px-3 py-2">Tutar</th>
                                    <th className="text-right font-medium px-3 py-2">₺/L</th>
                                    <th className="text-right font-medium px-3 py-2">Litre</th>
                                    <th className="text-right font-medium px-3 py-2">Km</th>
                                    <th className="text-right font-medium px-3 py-2">Δ km</th>
                                    <th className="text-right font-medium px-3 py-2">L/100km</th>
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((r) => (
                                    <tr key={r.id ?? `${r.fill_date}-${r.odometer_km}`}>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatTrDate(r.fill_date)}
                                            {r.note ? (
                                                <span className="block text-[11px] text-muted-foreground truncate max-w-[120px]">
                                                    {r.note}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtMoney(r.amount_tl)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtNum(r.price_per_liter, 2)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtNum(r.liters, 2)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {fmtNum(r.odometer_km, 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.odometer_warning ? (
                                                <span className="text-amber-500 text-xs">km?</span>
                                            ) : r.delta_km != null ? (
                                                fmtNum(r.delta_km, 0)
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.l_per_100km != null ? fmtNum(r.l_per_100km, 2) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                type="button"
                                                disabled={saving}
                                                onClick={() => void remove(r.id)}
                                                className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                                                aria-label="Sil"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
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

function mapLog(row: Record<string, unknown>): FuelLog {
    return {
        id: row.id ? String(row.id) : undefined,
        fill_date: String(row.fill_date).slice(0, 10),
        amount_tl: Number(row.amount_tl) || 0,
        price_per_liter: Number(row.price_per_liter) || 0,
        odometer_km: Number(row.odometer_km) || 0,
        note: String(row.note ?? '')
    };
}

function formatTrDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}
