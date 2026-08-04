'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    DAILY_FIXED,
    FULL_MONTH_WORK_DAYS,
    HOURLY_RATE,
    HOURS_PER_DAY,
    type BonusTip,
    type PackageDayEntry,
    canSetLeave,
    dailyPrim,
    emptyMonthEntries,
    formatDayLabel,
    mergeMonthFromRows,
    monthDateRange,
    monthlyTargetRows,
    nextDailyThreshold,
    paceProjection,
    projectScenario,
    readLocalMonthEntries,
    remainingWorkDaySlots,
    summarizeMonth,
    toDbPayload
} from '@/lib/paket-prim';

const TABLE = 'company_finance_paket_prim_days';

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

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function todayStr(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function PaketPrimPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIndex, setMonthIndex] = useState(now.getMonth());
    const [entries, setEntries] = useState<PackageDayEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingDate, setSavingDate] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [scenarioTip, setScenarioTip] = useState<BonusTip>('sanal');
    const [scenarioPkg, setScenarioPkg] = useState('38');

    const loadMonth = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        setStatus(null);
        const { from, to } = monthDateRange(y, m);

        const { data, error: qErr } = await supabase
            .from(TABLE)
            .select('work_date, status, packages, tip, note')
            .gte('work_date', from)
            .lte('work_date', to)
            .order('work_date');

        if (qErr) {
            setError(
                qErr.message.includes('does not exist') || qErr.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_paket_prim_days.sql dosyasını çalıştırın.'
                    : qErr.message
            );
            setEntries(emptyMonthEntries(y, m));
            setLoading(false);
            return;
        }

        let merged = mergeMonthFromRows(y, m, data ?? []);
        const hasDb = (data ?? []).length > 0;
        if (!hasDb) {
            const local = readLocalMonthEntries(y, m);
            const localFilled = local.filter((e) => e.status === 'work' || e.status === 'leave');
            if (localFilled.length > 0) {
                const payloads = localFilled
                    .map(toDbPayload)
                    .filter((p): p is NonNullable<typeof p> => p !== null);
                const { error: upErr } = await supabase.from(TABLE).upsert(payloads, {
                    onConflict: 'work_date'
                });
                if (!upErr) {
                    merged = local;
                    setStatus(`${localFilled.length} yerel kayıt veritabanına aktarıldı.`);
                }
            }
        }

        setEntries(merged);
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadMonth(year, monthIndex);
    }, [year, monthIndex, loadMonth]);

    const summary = useMemo(() => summarizeMonth(entries), [entries]);

    const remainDays = useMemo(
        () => remainingWorkDaySlots(entries, todayStr()),
        [entries]
    );

    const targetRows = useMemo(
        () => monthlyTargetRows(summary.totalPackages, remainDays),
        [summary.totalPackages, remainDays]
    );

    const pace = useMemo(
        () =>
            paceProjection(
                summary.totalPackages,
                summary.avgPackagesPerWorkDay,
                remainDays
            ),
        [summary.totalPackages, summary.avgPackagesPerWorkDay, remainDays]
    );

    const shiftMonth = useCallback(
        (delta: number) => {
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
        },
        [year]
    );

    const persistEntry = useCallback(
        async (entry: PackageDayEntry) => {
            setSavingDate(entry.date);
            setError(null);
            setStatus(null);

            if (entry.status === 'empty') {
                const { error: delErr } = await supabase.from(TABLE).delete().eq('work_date', entry.date);
                if (delErr) {
                    setError(delErr.message);
                    setSavingDate(null);
                    return false;
                }
                setEntries((prev) =>
                    prev.map((e) =>
                        e.date === entry.date
                            ? { date: e.date, status: 'empty', packages: 0, tip: null }
                            : e
                    )
                );
                setStatus('Gün temizlendi.');
                setSavingDate(null);
                return true;
            }

            const payload = toDbPayload(entry);
            if (!payload) {
                setError('Hemen veya Sanal seçimi gerekli.');
                setSavingDate(null);
                return false;
            }

            const { error: upErr } = await supabase.from(TABLE).upsert(payload, {
                onConflict: 'work_date'
            });
            if (upErr) {
                setError(upErr.message);
                setSavingDate(null);
                return false;
            }

            setEntries((prev) => prev.map((e) => (e.date === entry.date ? entry : e)));
            setStatus(
                entry.status === 'leave'
                    ? `${formatDayLabel(entry.date)} izin kaydedildi.`
                    : `${formatDayLabel(entry.date)} kaydedildi.`
            );
            setSavingDate(null);
            return true;
        },
        []
    );

    const saveWorkDay = useCallback(
        async (date: string, packages: number, tip: BonusTip) => {
            await persistEntry({
                date,
                status: 'work',
                packages: Math.max(0, Math.floor(packages)),
                tip
            });
        },
        [persistEntry]
    );

    const setLeave = useCallback(
        async (date: string) => {
            if (!canSetLeave(entries, date)) {
                setError('Bu hafta zaten bir izin günü var.');
                return;
            }
            await persistEntry({ date, status: 'leave', packages: 0, tip: null });
        },
        [entries, persistEntry]
    );

    const clearDay = useCallback(
        async (date: string) => {
            await persistEntry({ date, status: 'empty', packages: 0, tip: null });
        },
        [persistEntry]
    );

    const scenarioWorkDays =
        summary.workDays > 0 ? summary.workDays : FULL_MONTH_WORK_DAYS;
    const pkgNum = Math.max(0, parseInt(scenarioPkg, 10) || 0);
    const scenario = projectScenario(scenarioWorkDays, pkgNum, scenarioTip);
    const today = todayStr();

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Package className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            Paket Taxi
                        </span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Paket prim takibi</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Günlük paket + Hemen/Sanal seçimi. Sabit ücret {HOURLY_RATE} TL ×{' '}
                        {HOURS_PER_DAY} saat = {fmtMoney(DAILY_FIXED)} / iş günü.
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
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-foreground">
                    {status}
                </div>
            )}

            {/* KPI */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi
                    label="Sabit ücret"
                    value={fmtMoney(summary.fixedPay)}
                    hint={`${summary.workDays} iş günü`}
                />
                <Kpi
                    label="Günlük primler"
                    value={fmtMoney(summary.dailyPrimTotal)}
                    hint={`${summary.totalPackages} paket`}
                />
                <Kpi
                    label="Aylık bonus"
                    value={fmtMoney(summary.monthlyBonusAmount)}
                    hint={
                        summary.nextMonthly
                            ? `Sonraki: ${summary.nextMonthly.nextMin} (+${summary.nextMonthly.remaining})`
                            : summary.monthlyBonusAmount > 0
                              ? 'En üst basamak'
                              : 'İlk eşik 700'
                    }
                />
                <Kpi
                    label="Toplam kazanç"
                    value={fmtMoney(summary.grandTotal)}
                    hint="Sabit + prim + bonus"
                    emphasize
                />
            </section>

            {/* 3 özet tablo */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* 1 — Sonraki eşik */}
                <div className="rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-secondary/20">
                        <h2 className="text-sm font-semibold">Sonraki aylık eşik</h2>
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                        {summary.nextMonthly ? (
                            <>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Hedef</span>
                                    <span className="font-medium tabular-nums">
                                        {summary.nextMonthly.nextMin} paket
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Bonus</span>
                                    <span className="font-medium tabular-nums">
                                        {fmtMoney(summary.nextMonthly.nextAmount)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Kalan</span>
                                    <span className="font-medium tabular-nums text-primary">
                                        {summary.nextMonthly.remaining} paket
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Ort. tempo</span>
                                    <span className="tabular-nums">
                                        {summary.avgPackagesPerWorkDay > 0
                                            ? `${summary.avgPackagesPerWorkDay.toFixed(1)} pkt/gün`
                                            : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2 pt-1 border-t border-border">
                                    <span className="text-muted-foreground">
                                        Kalan günde hedef
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {remainDays > 0
                                            ? `${Math.ceil(summary.nextMonthly.remaining / remainDays)} pkt/gün`
                                            : 'Gün kalmadı'}
                                    </span>
                                </div>
                            </>
                        ) : summary.monthlyBonusAmount > 0 ? (
                            <p className="text-muted-foreground">En üst aylık bonus basamağındasın.</p>
                        ) : (
                            <p className="text-muted-foreground">Henüz paket girilmedi.</p>
                        )}
                    </div>
                </div>

                {/* 2 — Eşiklere göre günlük paket */}
                <div className="rounded-xl border border-border overflow-hidden lg:col-span-1">
                    <div className="px-4 py-2.5 border-b border-border bg-secondary/20 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold">Eşik → günlük hedef</h2>
                        <span className="text-[11px] text-muted-foreground">
                            {remainDays} kalan iş günü
                        </span>
                    </div>
                    <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th className="text-left font-medium px-3 py-2">Eşik</th>
                                    <th className="text-right font-medium px-3 py-2">Kalan</th>
                                    <th className="text-right font-medium px-3 py-2">Pkt/gün</th>
                                    <th className="text-right font-medium px-3 py-2">Bonus</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {targetRows.map((row) => (
                                    <tr
                                        key={row.min}
                                        className={
                                            row.reached
                                                ? 'bg-primary/5 text-muted-foreground'
                                                : summary.nextMonthly?.nextMin === row.min
                                                  ? 'bg-primary/10'
                                                  : ''
                                        }
                                    >
                                        <td className="px-3 py-1.5 tabular-nums">
                                            {row.min}
                                            {row.reached ? ' ✓' : ''}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">
                                            {row.reached ? '—' : row.remaining}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                                            {row.reached
                                                ? '—'
                                                : row.perDay === null
                                                  ? '—'
                                                  : row.perDay}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">
                                            {fmtMoney(row.bonus)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                        Pkt/gün = kalan paket ÷ kalan iş günü (Pazar boşsa izin sayılır).
                    </p>
                </div>

                {/* 3 — Tempo tahmini */}
                <div className="rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-secondary/20">
                        <h2 className="text-sm font-semibold">Tempo tahmini</h2>
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Şu an</span>
                            <span className="font-medium tabular-nums">
                                {summary.totalPackages} paket
                            </span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Ort. pkt/gün</span>
                            <span className="tabular-nums">
                                {summary.avgPackagesPerWorkDay > 0
                                    ? summary.avgPackagesPerWorkDay.toFixed(1)
                                    : '—'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Kalan iş günü</span>
                            <span className="tabular-nums">{pace.remainingDays}</span>
                        </div>
                        <div className="flex justify-between gap-2 pt-1 border-t border-border">
                            <span className="text-muted-foreground">Ay sonu tahmini</span>
                            <span className="font-semibold tabular-nums">
                                {pace.projectedTotal} paket
                            </span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Tahmini bonus</span>
                            <span className="font-medium tabular-nums text-primary">
                                {fmtMoney(pace.projectedBonus)}
                            </span>
                        </div>
                        {pace.next && (
                            <div className="flex justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">
                                    Tahminden sonraki eşik
                                </span>
                                <span className="tabular-nums">
                                    {pace.next.nextMin} (+{pace.next.remaining})
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">Günlük kayıt</h2>
                    <span className="text-xs text-muted-foreground">
                        Haftada en fazla 1 izin · Supabase
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Yükleniyor…</span>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {entries.map((entry) => (
                            <DayRow
                                key={entry.date}
                                entry={entry}
                                isToday={entry.date === today}
                                leaveAllowed={canSetLeave(entries, entry.date)}
                                saving={savingDate === entry.date}
                                onSaveWork={saveWorkDay}
                                onLeave={() => void setLeave(entry.date)}
                                onClear={() => void clearDay(entry.date)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-border p-4 md:p-5 space-y-4">
                <div>
                    <h2 className="text-sm font-semibold">Hedef simülatörü</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {scenarioWorkDays} iş günü varsayımı
                        {summary.workDays === 0 ? ' (tam ay: 26 gün)' : ' (girilmiş iş günü sayısı)'}.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Paket / gün</span>
                        <input
                            type="number"
                            min={0}
                            value={scenarioPkg}
                            onChange={(e) => setScenarioPkg(e.target.value)}
                            className="block w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Bonus tipi</span>
                        <TipToggle value={scenarioTip} onChange={setScenarioTip} />
                    </div>
                    <div className="flex gap-2">
                        {[38, 43].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => {
                                    setScenarioPkg(String(n));
                                    setScenarioTip('sanal');
                                }}
                                className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-secondary/50"
                            >
                                {n} pkt (Sanal)
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                        <div className="text-xs text-muted-foreground">Sabit</div>
                        <div className="font-medium tabular-nums">{fmtMoney(scenario.fixedPay)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Günlük prim</div>
                        <div className="font-medium tabular-nums">{fmtMoney(scenario.dailyPrimTotal)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Aylık bonus</div>
                        <div className="font-medium tabular-nums">
                            {fmtMoney(scenario.monthlyBonusAmount)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Toplam</div>
                        <div className="font-semibold tabular-nums text-primary">
                            {fmtMoney(scenario.grandTotal)}
                        </div>
                    </div>
                </div>
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
            className={`rounded-xl border border-border p-4 ${emphasize ? 'bg-primary/5 border-primary/30' : 'bg-background'}`}
        >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div
                className={`mt-1 text-xl font-semibold tabular-nums ${emphasize ? 'text-primary' : ''}`}
            >
                {value}
            </div>
            {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
    );
}

function TipToggle({
    value,
    onChange
}: {
    value: BonusTip;
    onChange: (t: BonusTip) => void;
}) {
    return (
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/20">
            {(
                [
                    ['sanal', 'Sanal'],
                    ['hemen', 'Hemen']
                ] as const
            ).map(([id, label]) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => onChange(id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        value === id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function DayRow({
    entry,
    isToday,
    leaveAllowed,
    saving,
    onSaveWork,
    onLeave,
    onClear
}: {
    entry: PackageDayEntry;
    isToday: boolean;
    leaveAllowed: boolean;
    saving: boolean;
    onSaveWork: (date: string, packages: number, tip: BonusTip) => void;
    onLeave: () => void;
    onClear: () => void;
}) {
    const [pkg, setPkg] = useState(entry.packages ? String(entry.packages) : '');
    const [tip, setTip] = useState<BonusTip>(entry.tip ?? 'sanal');

    useEffect(() => {
        setPkg(entry.packages ? String(entry.packages) : '');
        setTip(entry.tip ?? 'sanal');
    }, [entry.date, entry.packages, entry.tip, entry.status]);

    const isLeave = entry.status === 'leave';
    const isWork = entry.status === 'work';
    const pkgNum = Math.max(0, parseInt(pkg, 10) || 0);
    const prim = isWork ? dailyPrim(entry.packages, entry.tip) : dailyPrim(pkgNum, tip);
    const next = nextDailyThreshold(isWork ? entry.packages : pkgNum, isWork ? entry.tip : tip);

    return (
        <div
            className={`px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-4 ${
                isToday ? 'bg-primary/5' : ''
            } ${isLeave ? 'opacity-70' : ''}`}
        >
            <div className="md:w-44 shrink-0">
                <div className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                    {formatDayLabel(entry.date)}
                </div>
                {isLeave && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">İzin</div>
                )}
                {isWork && entry.tip && (
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {entry.tip === 'hemen' ? 'Hemen' : 'Sanal'} · {fmtMoney(prim)}
                    </div>
                )}
            </div>

            {isLeave ? (
                <div className="flex-1 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                        Bu gün izin — sabit ve prim yok
                    </span>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onClear}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/50 disabled:opacity-50"
                    >
                        {saving ? '…' : 'İzni kaldır'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-end gap-2 flex-1">
                        <label className="space-y-1">
                            <span className="text-[11px] text-muted-foreground">Paket</span>
                            <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={pkg}
                                onChange={(e) => setPkg(e.target.value)}
                                placeholder="0"
                                disabled={saving}
                                className="block w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                            />
                        </label>
                        <div className="space-y-1">
                            <span className="text-[11px] text-muted-foreground">Tip</span>
                            <TipToggle value={tip} onChange={setTip} />
                        </div>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => onSaveWork(entry.date, pkgNum, tip)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Kaydet
                        </button>
                        {leaveAllowed && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={onLeave}
                                className="px-3 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-secondary/50 disabled:opacity-50"
                            >
                                İzin
                            </button>
                        )}
                        {isWork && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={onClear}
                                className="px-3 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-secondary/50 disabled:opacity-50"
                            >
                                Temizle
                            </button>
                        )}
                    </div>

                    <div className="md:w-48 shrink-0 text-right text-xs text-muted-foreground space-y-0.5">
                        <div>
                            Prim:{' '}
                            <span className="text-foreground font-medium tabular-nums">
                                {fmtMoney(prim)}
                            </span>
                        </div>
                        {next && (
                            <div>
                                Sonraki eşik: {next.nextMin} ({next.remaining} kaldı) →{' '}
                                {fmtMoney(next.nextAmount)}
                            </div>
                        )}
                        {isWork && (
                            <div className="text-foreground/80">+ {fmtMoney(DAILY_FIXED)} sabit</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
