'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Fuel,
    Loader2,
    Lock,
    Plus,
    Send,
    Settings2,
    Trash2,
    Unlock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    type FuelLog,
    type FuelLogComputed,
    type FuelSettings,
    FUEL_EXPENSE_KDV_RATE,
    FUEL_EXPENSE_NAME,
    FUEL_EXPENSE_SOURCE,
    FUEL_SETTINGS_TABLE,
    defaultFuelSettings,
    enrichFuelLogs,
    fmtMoney,
    fmtNum,
    litersFrom,
    mapFuelSettings,
    monthBounds,
    summarizeFuelMonth
} from '@/lib/fuel';

const TABLE = 'company_finance_fuel_logs';
const CLOSINGS = 'company_finance_fuel_closings';
const MONTHLY = 'company_finance_monthly_entries';
const EXPENSES = 'company_finance_monthly_expenses';

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

type MonthClosing = {
    is_closed: boolean;
    amount_sent: number;
    fill_count: number;
    expense_id: string | null;
    sent_at: string | null;
    note: string;
};

function todayISO(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function FuelPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIndex, setMonthIndex] = useState(now.getMonth());
    const [rows, setRows] = useState<FuelLogComputed[]>([]);
    const [closing, setClosing] = useState<MonthClosing | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [settings, setSettings] = useState<FuelSettings>(defaultFuelSettings());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const [fillDate, setFillDate] = useState(todayISO());
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [odometer, setOdometer] = useState('');
    const [note, setNote] = useState('');

    const monthNum = monthIndex + 1;
    const monthClosed = Boolean(closing?.is_closed);
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
        const month = m + 1;

        const [monthRes, prevRes, closeRes, settingsRes] = await Promise.all([
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
                .limit(1),
            supabase
                .from(CLOSINGS)
                .select('is_closed, amount_sent, fill_count, expense_id, sent_at, note')
                .eq('year', y)
                .eq('month', month)
                .maybeSingle(),
            supabase.from(FUEL_SETTINGS_TABLE).select('*').limit(1).maybeSingle()
        ]);

        if (monthRes.error) {
            setError(
                monthRes.error.message.includes('does not exist') || monthRes.error.code === '42P01'
                    ? 'Tablo yok. Supabase’te create_fuel_logs.sql çalıştırın.'
                    : monthRes.error.message
            );
            setRows([]);
            setClosing(null);
            setLoading(false);
            return;
        }

        if (closeRes.error && closeRes.error.code !== 'PGRST116') {
            if (
                closeRes.error.message.includes('does not exist') ||
                closeRes.error.code === '42P01'
            ) {
                // Closings henüz yok — sayfa yine çalışır, kapat uyarır
                setClosing(null);
            } else {
                setError(closeRes.error.message);
            }
        } else if (closeRes.data) {
            setClosing({
                is_closed: Boolean(closeRes.data.is_closed),
                amount_sent: Number(closeRes.data.amount_sent) || 0,
                fill_count: Number(closeRes.data.fill_count) || 0,
                expense_id: closeRes.data.expense_id
                    ? String(closeRes.data.expense_id)
                    : null,
                sent_at: closeRes.data.sent_at ? String(closeRes.data.sent_at) : null,
                note: String(closeRes.data.note ?? '')
            });
        } else {
            setClosing(null);
        }

        if (settingsRes.error) {
            if (
                settingsRes.error.message.includes('does not exist') ||
                settingsRes.error.code === '42P01'
            ) {
                setSettings(defaultFuelSettings());
            }
        } else if (settingsRes.data) {
            const s = mapFuelSettings(settingsRes.data as Record<string, unknown>);
            setSettings(s);
            setPrice((prev) => {
                if (prev.trim()) return prev;
                return s.default_price_per_liter > 0
                    ? String(s.default_price_per_liter)
                    : prev;
            });
        } else {
            setSettings(defaultFuelSettings());
        }

        const monthLogs = (monthRes.data ?? []).map(mapLog);
        const prevLog =
            !prevRes.error && prevRes.data?.[0] ? mapLog(prevRes.data[0]) : null;
        const enriched = enrichFuelLogs(prevLog ? [prevLog, ...monthLogs] : monthLogs);
        const monthIds = new Set(monthLogs.map((l) => l.id).filter(Boolean));
        setRows(
            enriched.filter((r) =>
                r.id ? monthIds.has(r.id) : r.fill_date >= from && r.fill_date <= to
            )
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void load(year, monthIndex);
    }, [year, monthIndex, load]);

    const saveFuelSettings = useCallback(async () => {
        setSavingSettings(true);
        setError(null);
        const payload = {
            default_price_per_liter: Math.max(0, settings.default_price_per_liter),
            monthly_budget_tl: Math.max(0, settings.monthly_budget_tl),
            vehicle_name: settings.vehicle_name.trim()
        };
        if (settings.id) {
            const { error: upErr } = await supabase
                .from(FUEL_SETTINGS_TABLE)
                .update(payload)
                .eq('id', settings.id);
            if (upErr) {
                setError(
                    upErr.message.includes('does not exist')
                        ? 'Benzin ayar tablosu yok. Supabase’te create_fuel_settings.sql çalıştırın.'
                        : upErr.message
                );
                setSavingSettings(false);
                return;
            }
        } else {
            const { data, error: insErr } = await supabase
                .from(FUEL_SETTINGS_TABLE)
                .insert(payload)
                .select('*')
                .single();
            if (insErr) {
                setError(
                    insErr.message.includes('does not exist')
                        ? 'Benzin ayar tablosu yok. Supabase’te create_fuel_settings.sql çalıştırın.'
                        : insErr.message
                );
                setSavingSettings(false);
                return;
            }
            setSettings(mapFuelSettings(data as Record<string, unknown>));
        }
        if (payload.default_price_per_liter > 0) {
            setPrice((prev) =>
                prev.trim() ? prev : String(payload.default_price_per_liter)
            );
        }
        setStatus('Benzin ayarları kaydedildi.');
        setSavingSettings(false);
    }, [settings]);

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
        if (monthClosed) {
            setError('Ay kapatılmış. Düzenlemek için kilidi aç.');
            return;
        }
        setSaving(true);
        setError(null);
        setStatus(null);

        const amount_tl = parseFloat(amount.replace(',', '.'));
        const parsedPrice = parseFloat(price.replace(',', '.'));
        const price_per_liter =
            Number.isFinite(parsedPrice) && parsedPrice > 0
                ? parsedPrice
                : settings.default_price_per_liter;
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
            setError('Geçerli litre fiyatı gir (veya Benzin ayarlarına varsayılan ₺/L yaz).');
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
        setPrice(
            settings.default_price_per_liter > 0
                ? String(settings.default_price_per_liter)
                : ''
        );
        setOdometer('');
        setNote('');
        setStatus('Dolum kaydedildi.');
        setSaving(false);
        await load(year, monthIndex);
    };

    const remove = async (id: string | undefined) => {
        if (!id) return;
        if (monthClosed) {
            setError('Ay kapatılmış. Düzenlemek için kilidi aç.');
            return;
        }
        if (!confirm('Bu dolum silinsin mi?')) return;
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

    const closeMonth = useCallback(async () => {
        if (summary.count === 0 || summary.totalAmount <= 0) {
            setError('Bu ayda gönderilecek benzin tutarı yok.');
            return;
        }
        const ok = window.confirm(
            `${MONTH_LABELS[monthIndex]} ${year} benzin toplamı ${fmtMoney(summary.totalAmount)} aylık kazanca KDV’siz gider olarak yazılsın mı?\n\n(Net kazançtan düşülür; indirilecek KDV’ye dahil edilmez.)`
        );
        if (!ok) return;

        setSending(true);
        setError(null);
        setStatus(null);

        const noteText = `Benzin — ${MONTH_LABELS[monthIndex]} ${year} · ${summary.count} dolum`;

        // 1) Aylık kayıt
        const { data: existing, error: exErr } = await supabase
            .from(MONTHLY)
            .select('id')
            .eq('year', year)
            .eq('month', monthNum)
            .maybeSingle();

        if (exErr) {
            setError(exErr.message);
            setSending(false);
            return;
        }

        let entryId = existing?.id ? String(existing.id) : null;
        if (!entryId) {
            const { data: created, error: insM } = await supabase
                .from(MONTHLY)
                .insert({
                    year,
                    month: monthNum,
                    gross_amount: 0,
                    kdv_paid: 0,
                    kdv_deductible: 0,
                    note: ''
                })
                .select('id')
                .single();
            if (insM || !created) {
                setError(insM?.message || 'Aylık kayıt oluşturulamadı.');
                setSending(false);
                return;
            }
            entryId = String(created.id);
        }

        // 2) Gider upsert (source=fuel, KDV 0)
        const expensePayload = {
            monthly_entry_id: entryId,
            name: FUEL_EXPENSE_NAME,
            amount_gross: summary.totalAmount,
            kdv_rate: FUEL_EXPENSE_KDV_RATE,
            include_in_deductible_kdv: false,
            include_in_cash_flow: true,
            note: noteText,
            source: FUEL_EXPENSE_SOURCE,
            sort_order: 0
        };

        let expenseId = closing?.expense_id ?? null;

        if (expenseId) {
            const { error: upE } = await supabase
                .from(EXPENSES)
                .update(expensePayload)
                .eq('id', expenseId);
            if (upE) {
                // Eski id silinmiş olabilir — yeniden bul / ekle
                expenseId = null;
            }
        }

        if (!expenseId) {
            const { data: found, error: findErr } = await supabase
                .from(EXPENSES)
                .select('id')
                .eq('monthly_entry_id', entryId)
                .eq('source', FUEL_EXPENSE_SOURCE)
                .maybeSingle();

            if (findErr && findErr.code !== 'PGRST116') {
                if (
                    findErr.message.includes('source') ||
                    findErr.message.includes('does not exist')
                ) {
                    setError(
                        'Gider source kolonu yok. Supabase’te create_fuel_closings.sql çalıştırın.'
                    );
                    setSending(false);
                    return;
                }
                setError(findErr.message);
                setSending(false);
                return;
            }

            if (found?.id) {
                expenseId = String(found.id);
                const { error: upE } = await supabase
                    .from(EXPENSES)
                    .update(expensePayload)
                    .eq('id', expenseId);
                if (upE) {
                    setError(upE.message);
                    setSending(false);
                    return;
                }
            } else {
                const { data: created, error: insE } = await supabase
                    .from(EXPENSES)
                    .insert([expensePayload])
                    .select('id')
                    .single();
                if (insE || !created) {
                    setError(
                        insE?.message?.includes('source')
                            ? 'source kolonu yok. create_fuel_closings.sql çalıştırın.'
                            : insE?.message || 'Gider yazılamadı.'
                    );
                    setSending(false);
                    return;
                }
                expenseId = String(created.id);
            }
        }

        // 3) Kapanış
        const { error: closeErr } = await supabase.from(CLOSINGS).upsert(
            {
                year,
                month: monthNum,
                is_closed: true,
                amount_sent: summary.totalAmount,
                fill_count: summary.count,
                expense_id: expenseId,
                sent_at: new Date().toISOString(),
                note: noteText
            },
            { onConflict: 'year,month' }
        );

        if (closeErr) {
            setError(
                closeErr.message.includes('does not exist') || closeErr.code === '42P01'
                    ? 'Kapanış tablosu yok. create_fuel_closings.sql çalıştırın. Gider aylık kazanca yazılmış olabilir.'
                    : closeErr.message
            );
            setSending(false);
            return;
        }

        setClosing({
            is_closed: true,
            amount_sent: summary.totalAmount,
            fill_count: summary.count,
            expense_id: expenseId,
            sent_at: new Date().toISOString(),
            note: noteText
        });
        setStatus(
            `${MONTH_LABELS[monthIndex]} ${year} aylık kazanca gider yazıldı: ${fmtMoney(summary.totalAmount)} (KDV’siz).`
        );
        setSending(false);
    }, [summary, monthIndex, year, monthNum, closing?.expense_id]);

    const unlockMonth = useCallback(async () => {
        setSending(true);
        setError(null);
        const { error: upErr } = await supabase.from(CLOSINGS).upsert(
            {
                year,
                month: monthNum,
                is_closed: false,
                amount_sent: closing?.amount_sent ?? 0,
                fill_count: closing?.fill_count ?? 0,
                expense_id: closing?.expense_id ?? null,
                note: closing?.note ?? ''
            },
            { onConflict: 'year,month' }
        );
        if (upErr) {
            setError(upErr.message);
            setSending(false);
            return;
        }
        setClosing((c) =>
            c
                ? { ...c, is_closed: false }
                : {
                      is_closed: false,
                      amount_sent: 0,
                      fill_count: 0,
                      expense_id: null,
                      sent_at: null,
                      note: ''
                  }
        );
        setStatus('Kilit açıldı. Dolumları düzenleyebilirsin; bitince tekrar kapat.');
        setSending(false);
    }, [year, monthNum, closing]);

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2 text-primary">
                        <Fuel className="h-5 w-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            Şirket kartı
                        </span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Benzin tüketimi</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {settings.vehicle_name
                            ? `${settings.vehicle_name} · `
                            : ''}
                        Ayı kapatınca toplam tutar aylık kazanca KDV’siz gider olarak yazılır (netten
                        düşer).
                    </p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            className="rounded-lg border border-border p-2 hover:bg-secondary/50"
                            aria-label="Önceki ay"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="min-w-[140px] text-center font-medium">
                            {MONTH_LABELS[monthIndex]} {year}
                            {monthClosed && (
                                <div className="text-[11px] font-normal text-amber-600 dark:text-amber-400">
                                    Kapatıldı
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            className="rounded-lg border border-border p-2 hover:bg-secondary/50"
                            aria-label="Sonraki ay"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen((o) => !o)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary/50"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                            {settingsOpen ? 'Ayarları gizle' : 'Benzin ayarları'}
                        </button>
                        {monthClosed ? (
                            <button
                                type="button"
                                disabled={sending}
                                onClick={() => void unlockMonth()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary/50 disabled:opacity-50"
                            >
                                <Unlock className="h-3.5 w-3.5" />
                                Kilidi aç
                            </button>
                        ) : null}
                        <button
                            type="button"
                            disabled={loading || sending || summary.totalAmount <= 0}
                            onClick={() => void closeMonth()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : monthClosed ? (
                                <Send className="h-4 w-4" />
                            ) : (
                                <Lock className="h-4 w-4" />
                            )}
                            {monthClosed ? 'Tekrar gönder' : 'Ayı kapat → gider yaz'}
                        </button>
                    </div>
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

            {monthClosed && closing && (
                <p className="text-sm text-muted-foreground">
                    Bu ay kapatıldı · Gider {fmtMoney(closing.amount_sent)}
                    {closing.sent_at
                        ? ` · ${new Date(closing.sent_at).toLocaleString('tr-TR')}`
                        : ''}
                </p>
            )}

            {settingsOpen && (
                <section className="space-y-3 rounded-xl border border-border p-4">
                    <h2 className="text-sm font-semibold">Benzin ayarları</h2>
                    <p className="text-xs text-muted-foreground">
                        Varsayılan litre fiyatı yeni doluma yazılır. Aylık hedef dashboard ve KPI’da
                        görünür.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Araç adı</span>
                            <input
                                value={settings.vehicle_name}
                                onChange={(e) =>
                                    setSettings((s) => ({ ...s, vehicle_name: e.target.value }))
                                }
                                placeholder="Örn. Ticari"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">
                                Varsayılan ₺/L
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={settings.default_price_per_liter || ''}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        default_price_per_liter:
                                            parseFloat(e.target.value.replace(',', '.')) || 0
                                    }))
                                }
                                placeholder="48.50"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Aylık hedef ₺</span>
                            <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={settings.monthly_budget_tl || ''}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        monthly_budget_tl:
                                            parseFloat(e.target.value.replace(',', '.')) || 0
                                    }))
                                }
                                placeholder="8000"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                    </div>
                    <button
                        type="button"
                        disabled={savingSettings}
                        onClick={() => void saveFuelSettings()}
                        className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                        {savingSettings ? 'Kaydediliyor…' : 'Ayarları kaydet'}
                    </button>
                </section>
            )}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                    label="Ay toplamı"
                    value={fmtMoney(summary.totalAmount)}
                    hint={
                        settings.monthly_budget_tl > 0
                            ? `${summary.count} dolum · hedefin %${Math.round(
                                  (summary.totalAmount / settings.monthly_budget_tl) * 100
                              )}`
                            : `${summary.count} dolum`
                    }
                    emphasize
                />
                <Kpi
                    label="Toplam litre"
                    value={`${fmtNum(summary.totalLiters, 2)} L`}
                    hint={
                        settings.monthly_budget_tl > 0
                            ? `Hedef ${fmtMoney(settings.monthly_budget_tl)}`
                            : undefined
                    }
                />
                <Kpi
                    label="Ort. L/100km"
                    value={summary.avgLPer100km != null ? fmtNum(summary.avgLPer100km, 2) : '—'}
                    hint={
                        summary.totalDeltaKm > 0
                            ? `${fmtNum(summary.totalDeltaKm, 0)} km`
                            : undefined
                    }
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

            <section className="space-y-4 rounded-xl border border-border p-4 md:p-5">
                <h2 className="text-sm font-semibold">Yeni dolum</h2>
                {monthClosed && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        Ay kilitli — dolum eklemek için kilidi aç.
                    </p>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <label className="col-span-2 space-y-1 text-sm md:col-span-1">
                        <span className="text-xs text-muted-foreground">Tarih</span>
                        <input
                            type="date"
                            value={fillDate}
                            disabled={monthClosed}
                            onChange={(e) => setFillDate(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                        />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Tutar (₺)</span>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={amount}
                            disabled={monthClosed}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="455"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                        />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Litre fiyatı (₺/L)</span>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={price}
                            disabled={monthClosed}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="48.50"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                        />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Gösterge km</span>
                        <input
                            type="number"
                            step="1"
                            min={0}
                            value={odometer}
                            disabled={monthClosed}
                            onChange={(e) => setOdometer(e.target.value)}
                            placeholder="12780"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                        />
                    </label>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-[160px] flex-1 space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Not (opsiyonel)</span>
                        <input
                            type="text"
                            value={note}
                            disabled={monthClosed}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="İstasyon vb."
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                        />
                    </label>
                    <p className="pb-2 text-xs text-muted-foreground">
                        Litre:{' '}
                        <span className="font-medium tabular-nums text-foreground">
                            {previewLiters != null ? `${fmtNum(previewLiters, 2)} L` : '—'}
                        </span>
                    </p>
                    <button
                        type="button"
                        disabled={saving || monthClosed}
                        onClick={() => void addFill()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        Kaydet
                    </button>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-secondary/20 px-4 py-3">
                    <h2 className="text-sm font-semibold">Dolumlar</h2>
                </div>
                {loading ? (
                    <div className="flex justify-center py-16 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        Bu ay henüz dolum yok.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2 text-left font-medium">Tarih</th>
                                    <th className="px-3 py-2 text-right font-medium">Tutar</th>
                                    <th className="px-3 py-2 text-right font-medium">₺/L</th>
                                    <th className="px-3 py-2 text-right font-medium">Litre</th>
                                    <th className="px-3 py-2 text-right font-medium">Km</th>
                                    <th className="px-3 py-2 text-right font-medium">Δ km</th>
                                    <th className="px-3 py-2 text-right font-medium">L/100km</th>
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((r) => (
                                    <tr key={r.id ?? `${r.fill_date}-${r.odometer_km}`}>
                                        <td className="whitespace-nowrap px-3 py-2">
                                            {formatTrDate(r.fill_date)}
                                            {r.note ? (
                                                <span className="block max-w-[120px] truncate text-[11px] text-muted-foreground">
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
                                                <span className="text-xs text-amber-500">km?</span>
                                            ) : r.delta_km != null ? (
                                                fmtNum(r.delta_km, 0)
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {r.l_per_100km != null
                                                ? fmtNum(r.l_per_100km, 2)
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                type="button"
                                                disabled={saving || monthClosed}
                                                onClick={() => void remove(r.id)}
                                                className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                                                aria-label="Sil"
                                            >
                                                <Trash2 className="h-4 w-4" />
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
            className={`rounded-xl border border-border p-4 ${emphasize ? 'border-primary/30 bg-primary/5' : ''}`}
        >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div
                className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${emphasize ? 'text-primary' : ''}`}
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
