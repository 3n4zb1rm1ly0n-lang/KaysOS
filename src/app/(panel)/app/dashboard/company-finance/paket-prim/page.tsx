'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Package, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    DAILY_FIXED,
    FULL_MONTH_WORK_DAYS,
    HOURLY_RATE,
    HOURS_PER_DAY,
    type BonusTip,
    type PackageDayEntry,
    applyDefaultMondayLeave,
    dailyPrim,
    emptyMonthEntries,
    formatDayLabel,
    mergeMonthFromRows,
    monthDateRange,
    monthlyTargetRows,
    moveLeaveTo,
    nextDailyThreshold,
    paceProjection,
    plannedWorkDaysInMonth,
    projectScenario,
    readLocalMonthEntries,
    remainingWorkDaySlots,
    summarizeMonth,
    toDbPayload,
    type ScenarioMode,
    MONTHLY_FRANCHISE
} from '@/lib/paket-prim';

const TABLE = 'company_finance_paket_prim_days';
const CLOSINGS = 'company_finance_paket_prim_closings';
const MONTHLY = 'company_finance_monthly_entries';

type MonthClosing = {
    is_closed: boolean;
    gross_sent: number;
    sent_at: string | null;
    note: string;
};

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

function fmtMoney2(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    const [scenarioMode, setScenarioMode] = useState<ScenarioMode>('daily');
    const [scenarioDaysInput, setScenarioDaysInput] = useState('');
    const [closing, setClosing] = useState<MonthClosing | null>(null);
    const [sendOpen, setSendOpen] = useState(false);
    const [sendGross, setSendGross] = useState('');
    const [sendNote, setSendNote] = useState('');
    const [sending, setSending] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmStep, setConfirmStep] = useState<'ask' | 'edit'>('ask');
    const [editedGross, setEditedGross] = useState('');

    const monthNum = monthIndex + 1;
    const monthClosed = Boolean(closing?.is_closed);

    const loadMonth = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        setStatus(null);
        setSendOpen(false);
        setScenarioDaysInput('');
        const { from, to } = monthDateRange(y, m);
        const mNum = m + 1;

        const [daysRes, closeRes] = await Promise.all([
            supabase
                .from(TABLE)
                .select('work_date, status, packages, tip, note')
                .gte('work_date', from)
                .lte('work_date', to)
                .order('work_date'),
            supabase
                .from(CLOSINGS)
                .select('is_closed, gross_sent, sent_at, note')
                .eq('year', y)
                .eq('month', mNum)
                .maybeSingle()
        ]);

        if (daysRes.error) {
            setError(
                daysRes.error.message.includes('does not exist') || daysRes.error.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_paket_prim_days.sql dosyasını çalıştırın.'
                    : daysRes.error.message
            );
            setEntries(emptyMonthEntries(y, m));
            setClosing(null);
            setLoading(false);
            return;
        }

        if (closeRes.error && closeRes.error.code !== 'PGRST116') {
            if (
                closeRes.error.message.includes('does not exist') ||
                closeRes.error.code === '42P01'
            ) {
                setError(
                    'Kapanış tablosu yok. Supabase’te create_paket_prim_closings.sql çalıştırın.'
                );
            }
        }

        if (closeRes.data) {
            setClosing({
                is_closed: Boolean(closeRes.data.is_closed),
                gross_sent: Number(closeRes.data.gross_sent) || 0,
                sent_at: closeRes.data.sent_at ? String(closeRes.data.sent_at) : null,
                note: String(closeRes.data.note ?? '')
            });
        } else {
            setClosing(null);
        }

        let merged = mergeMonthFromRows(y, m, daysRes.data ?? []);
        const hasDb = (daysRes.data ?? []).length > 0;
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

        const { entries: withLeave, seeded } = applyDefaultMondayLeave(merged);
        if (seeded.length > 0) {
            const payloads = seeded
                .map(toDbPayload)
                .filter((p): p is NonNullable<typeof p> => p !== null);
            const { error: seedErr } = await supabase.from(TABLE).upsert(payloads, {
                onConflict: 'work_date'
            });
            if (seedErr) {
                setError(seedErr.message);
            } else {
                merged = withLeave;
                setStatus(`${seeded.length} Pazartesi varsayılan izin olarak işaretlendi.`);
            }
        }

        setEntries(merged);
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadMonth(year, monthIndex);
    }, [year, monthIndex, loadMonth]);

    const summary = useMemo(() => summarizeMonth(entries, year, monthNum), [entries, year, monthNum]);

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
            if (monthClosed) {
                setError('Ay kapatılmış. Düzenlemek için kilidi aç.');
                return false;
            }
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
        [monthClosed]
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
            if (monthClosed) {
                setError('Ay kapatılmış. Düzenlemek için kilidi aç.');
                return;
            }
            const { entries: next, cleared } = moveLeaveTo(entries, date);
            setSavingDate(date);
            setError(null);
            setStatus(null);

            // Eski izinleri temizle
            for (const d of cleared) {
                const { error: delErr } = await supabase.from(TABLE).delete().eq('work_date', d);
                if (delErr) {
                    setError(delErr.message);
                    setSavingDate(null);
                    return;
                }
            }

            const leaveEntry = next.find((e) => e.date === date);
            const payload = leaveEntry ? toDbPayload(leaveEntry) : null;
            if (!payload) {
                setError('İzin kaydı oluşturulamadı.');
                setSavingDate(null);
                return;
            }

            const { error: upErr } = await supabase.from(TABLE).upsert(payload, {
                onConflict: 'work_date'
            });
            if (upErr) {
                setError(upErr.message);
                setSavingDate(null);
                return;
            }

            setEntries(next);
            setStatus(
                cleared.length > 0
                    ? `${formatDayLabel(date)} izin (önceki izin taşındı).`
                    : `${formatDayLabel(date)} izin kaydedildi.`
            );
            setSavingDate(null);
        },
        [entries, monthClosed]
    );

    const clearDay = useCallback(
        async (date: string) => {
            await persistEntry({ date, status: 'empty', packages: 0, tip: null });
        },
        [persistEntry]
    );

    const openSendModal = useCallback(() => {
        setSendGross(String(Math.round(summary.grandTotal * 100) / 100));
        setSendNote(
            closing?.note ||
                `Paket prim — ${MONTH_LABELS[monthIndex]} ${year} · ${summary.workDays} iş günü · ${summary.totalPackages} paket`
        );
        setSendOpen(true);
        setError(null);
    }, [summary, monthIndex, year, closing?.note]);

    const unlockMonth = useCallback(async () => {
        setSending(true);
        setError(null);
        const { error: upErr } = await supabase.from(CLOSINGS).upsert(
            {
                year,
                month: monthNum,
                is_closed: false,
                gross_sent: closing?.gross_sent ?? 0,
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
                : { is_closed: false, gross_sent: 0, sent_at: null, note: '' }
        );
        setStatus('Kilit açıldı. Günleri düzenleyebilirsin; bitince tekrar gönder.');
        setSending(false);
    }, [year, monthNum, closing]);

    const confirmSendToMonthly = useCallback(async (grossOverride?: string) => {
        setSending(true);
        setError(null);
        const gross = parseFloat((grossOverride ?? sendGross).replace(',', '.'));
        if (!Number.isFinite(gross) || gross < 0) {
            setError('Geçerli bir brüt tutar gir.');
            setSending(false);
            return;
        }

        const note =
            sendNote.trim() ||
            `Paket prim — ${MONTH_LABELS[monthIndex]} ${year} (franchise kesintisi: ${fmtMoney2(summary.franchiseTotal)})`;

        // Mevcut aylık kayıt?
        const { data: existing, error: exErr } = await supabase
            .from(MONTHLY)
            .select('id, gross_amount')
            .eq('year', year)
            .eq('month', monthNum)
            .maybeSingle();

        if (exErr) {
            setError(exErr.message);
            setSending(false);
            return;
        }

        if (existing && Number(existing.gross_amount) > 0 && !monthClosed) {
            const ok = window.confirm(
                `Bu ay için aylık kazançta zaten brüt ${fmtMoney2(Number(existing.gross_amount))} var. Üzerine yazılsın mı?`
            );
            if (!ok) {
                setSending(false);
                return;
            }
        }

        if (existing?.id) {
            const { error: upM } = await supabase
                .from(MONTHLY)
                .update({ gross_amount: gross, note })
                .eq('id', existing.id);
            if (upM) {
                setError(upM.message);
                setSending(false);
                return;
            }
        } else {
            const { error: insM } = await supabase.from(MONTHLY).insert({
                year,
                month: monthNum,
                gross_amount: gross,
                kdv_paid: 0,
                kdv_deductible: 0,
                note
            });
            if (insM) {
                setError(insM.message);
                setSending(false);
                return;
            }
        }

        const { error: closeErr } = await supabase.from(CLOSINGS).upsert(
            {
                year,
                month: monthNum,
                is_closed: true,
                gross_sent: gross,
                fixed_pay: summary.fixedPay,
                daily_prim_total: summary.dailyPrimTotal,
                monthly_bonus: summary.monthlyBonusAmount,
                total_packages: summary.totalPackages,
                work_days: summary.workDays,
                sent_at: new Date().toISOString(),
                note
            },
            { onConflict: 'year,month' }
        );

        if (closeErr) {
            setError(
                closeErr.message.includes('does not exist') || closeErr.code === '42P01'
                    ? 'Kapanış tablosu yok. create_paket_prim_closings.sql çalıştırın. Brüt aylık kazanca yazılmış olabilir.'
                    : closeErr.message
            );
            setSending(false);
            return;
        }

        setClosing({
            is_closed: true,
            gross_sent: gross,
            sent_at: new Date().toISOString(),
            note
        });
        setSendOpen(false);
        setStatus(
            `${MONTH_LABELS[monthIndex]} ${year} aylık kazanca gönderildi: ${fmtMoney2(gross)} (brüt).`
        );
        setSending(false);
    }, [
        sendGross,
        sendNote,
        year,
        monthNum,
        monthIndex,
        monthClosed,
        summary
    ]);

    const autoWorkDays = useMemo(() => {
        const planned = plannedWorkDaysInMonth(entries);
        return planned > 0 ? planned : FULL_MONTH_WORK_DAYS;
    }, [entries]);

    const scenarioWorkDays = useMemo(() => {
        const manual = parseInt(scenarioDaysInput, 10);
        if (scenarioDaysInput.trim() && Number.isFinite(manual) && manual > 0) return manual;
        return autoWorkDays;
    }, [scenarioDaysInput, autoWorkDays]);

    const pkgNum = Math.max(0, parseFloat(scenarioPkg.replace(',', '.')) || 0);
    const scenario = projectScenario(scenarioMode, pkgNum, scenarioTip, scenarioWorkDays);
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

                <div className="flex flex-col items-stretch sm:items-end gap-2">
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
                            {monthClosed && (
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
                                    Kapatıldı
                                </div>
                            )}
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
                    <div className="flex flex-wrap gap-2 justify-end">
                        {monthClosed ? (
                            <button
                                type="button"
                                disabled={sending}
                                onClick={() => void unlockMonth()}
                                className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-secondary/50 disabled:opacity-50"
                            >
                                Kilidi aç
                            </button>
                        ) : null}
                        <button
                            type="button"
                            disabled={loading || summary.workDays === 0}
                            onClick={openSendModal}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                            {monthClosed ? 'Tekrar gönder' : 'Aylık kazanca gönder'}
                        </button>
                    </div>
                </div>
            </header>

            {monthClosed && closing && (
                <p className="text-sm text-muted-foreground">
                    Bu ay kapatıldı · Brüt {fmtMoney2(closing.gross_sent)}
                    {closing.sent_at
                        ? ` · ${new Date(closing.sent_at).toLocaleString('tr-TR')}`
                        : ''}
                </p>
            )}

            {sendOpen && (
                <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5 space-y-4">
                    <h2 className="text-sm font-semibold">
                        {MONTH_LABELS[monthIndex]} {year} → Aylık kazanç (brüt)
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                            <div className="text-xs text-muted-foreground">Sabit</div>
                            <div className="font-medium tabular-nums">{fmtMoney2(summary.fixedPay)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Günlük prim</div>
                            <div className="font-medium tabular-nums">
                                {fmtMoney2(summary.dailyPrimTotal)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Aylık bonus</div>
                            <div className="font-medium tabular-nums">
                                {fmtMoney2(summary.monthlyBonusAmount)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Franchise kesintisi</div>
                            <div className="font-medium tabular-nums text-red-500">
                                −{fmtMoney2(summary.franchiseTotal)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Hesaplanan toplam</div>
                            <div className="font-semibold tabular-nums text-primary">
                                {fmtMoney2(summary.grandTotal)}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                        <label className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                                Brüt (manuel düzeltilebilir)
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                value={sendGross}
                                onChange={(e) => setSendGross(e.target.value)}
                                className="block w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                        <label className="space-y-1 flex-1 min-w-[200px]">
                            <span className="text-xs text-muted-foreground">Not</span>
                            <input
                                type="text"
                                value={sendNote}
                                onChange={(e) => setSendNote(e.target.value)}
                                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={sending}
                            onClick={() => {
                                setConfirmStep('ask');
                                setEditedGross(sendGross);
                                setConfirmModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Onayla ve gönder
                        </button>
                        <button
                            type="button"
                            disabled={sending}
                            onClick={() => setSendOpen(false)}
                            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary/50"
                        >
                            Vazgeç
                        </button>
                    </div>
                </section>
            )}

            {confirmModalOpen && (() => {
                const calculated = summary.grandTotal;
                const edited = parseFloat(editedGross.replace(',', '.'));
                const diff = Number.isFinite(edited) ? edited - calculated : 0;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmModalOpen(false)}>
                        <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-background p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => setConfirmModalOpen(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="text-base font-semibold">Tutar doğrulama</h2>
                            <div className="text-sm space-y-1">
                                <div className="text-muted-foreground">Hesaplanan brüt toplam:</div>
                                <div className="text-xl font-bold tabular-nums">{fmtMoney2(calculated)}</div>
                            </div>

                            {confirmStep === 'ask' ? (
                                <div className="space-y-3">
                                    <p className="text-sm">Bu tutar doğru mu?</p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={sending}
                                            onClick={() => {
                                                setConfirmModalOpen(false);
                                                void confirmSendToMonthly(sendGross);
                                            }}
                                            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                        >
                                            {sending && <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />}
                                            Evet, gönder
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setConfirmStep('edit');
                                                setEditedGross(String(calculated));
                                            }}
                                            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-secondary/50"
                                        >
                                            Hayır, düzenle
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="space-y-1">
                                        <span className="text-xs text-muted-foreground">Gerçek brüt tutar</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editedGross}
                                            onChange={(e) => setEditedGross(e.target.value)}
                                            className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            autoFocus
                                        />
                                    </label>
                                    {Number.isFinite(edited) && diff !== 0 && (
                                        <div className={`text-sm font-medium tabular-nums ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            Fark: {diff > 0 ? '+' : ''}{fmtMoney2(diff)}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={sending || !Number.isFinite(edited) || edited < 0}
                                            onClick={() => {
                                                setSendGross(editedGross);
                                                setConfirmModalOpen(false);
                                                void confirmSendToMonthly(editedGross);
                                            }}
                                            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                        >
                                            {sending && <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />}
                                            Onayla ve gönder
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmStep('ask')}
                                            className="px-4 py-2.5 text-sm rounded-lg border border-border hover:bg-secondary/50"
                                        >
                                            Geri
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

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
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
                    label="Franchise kesintisi"
                    value={`−${fmtMoney(summary.franchiseTotal)}`}
                    hint={`Günlük ~${fmtMoney(Math.round(summary.dailyFranchise))}`}
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
                                    <th className="text-right font-medium px-3 py-2">Ay sonu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {targetRows.map((row) => {
                                    const projectedFixed =
                                        summary.fixedPay + remainDays * DAILY_FIXED;
                                    const extraPrim =
                                        !row.reached &&
                                        row.perDay != null &&
                                        remainDays > 0
                                            ? dailyPrim(row.perDay, scenarioTip) *
                                              remainDays
                                            : 0;
                                    const monthEndTotal =
                                        projectedFixed +
                                        summary.dailyPrimTotal +
                                        extraPrim +
                                        row.bonus;
                                    return (
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
                                            <td className="px-3 py-1.5 text-right font-medium tabular-nums text-primary">
                                                {!row.reached && row.perDay === null
                                                    ? '—'
                                                    : fmtMoney(monthEndTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                        Pkt/gün = kalan paket ÷ kalan iş günü. Ay sonu = sabit + günlük prim
                        (pkt/gün × {scenarioTip}) + bonus.
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
                        Haftada 1 izin · varsayılan Pazartesi · Supabase
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
                                leaveAllowed={entry.status !== 'leave'}
                                saving={savingDate === entry.date}
                                locked={monthClosed}
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
                        İzinler düşülmüş tam ay · seçili prim tablosu (
                        {scenarioTip === 'sanal' ? 'Sanal' : 'Hemen'}). Aylık modda günlük
                        paket = yuvarlanmış ortalama.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Giriş tipi</span>
                        <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/20">
                            {(
                                [
                                    ['daily', 'Günlük paket'],
                                    ['monthly', 'Aylık paket']
                                ] as const
                            ).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setScenarioMode(id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        scenarioMode === id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Bonus tipi</span>
                        <TipToggle value={scenarioTip} onChange={setScenarioTip} />
                    </div>

                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                            {scenarioMode === 'daily' ? 'Paket / gün' : 'Paket / ay'}
                        </span>
                        <input
                            type="number"
                            min={0}
                            value={scenarioPkg}
                            onChange={(e) => setScenarioPkg(e.target.value)}
                            className="block w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                            İş günü (otomatik {autoWorkDays})
                        </span>
                        <input
                            type="number"
                            min={1}
                            placeholder={String(autoWorkDays)}
                            value={scenarioDaysInput}
                            onChange={(e) => setScenarioDaysInput(e.target.value)}
                            className="block w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>

                    {scenarioMode === 'daily' && (
                        <div className="flex gap-2">
                            {[38, 43].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => {
                                        setScenarioPkg(String(n));
                                        setScenarioTip('sanal');
                                        setScenarioMode('daily');
                                    }}
                                    className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-secondary/50"
                                >
                                    {n} pkt (Sanal)
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-xs text-muted-foreground">
                    {scenario.workDays} iş günü · günlük eşdeğer{' '}
                    <span className="text-foreground font-medium tabular-nums">
                        {scenario.packagesPerDay} pkt
                    </span>{' '}
                    → prim {fmtMoney(scenario.dayPrimAmount)}/gün
                    {scenarioMode === 'monthly' && scenario.workDays > 0 && (
                        <>
                            {' '}
                            (aylık {scenario.totalPackages} ÷ {scenario.workDays} ≈{' '}
                            {(scenario.totalPackages / scenario.workDays).toFixed(1)})
                        </>
                    )}
                    {scenarioMode === 'daily' && (
                        <>
                            {' '}
                            · ay toplamı {scenario.totalPackages} paket
                        </>
                    )}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                        <div className="text-xs text-muted-foreground">Sabit</div>
                        <div className="font-medium tabular-nums">{fmtMoney(scenario.fixedPay)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Günlük primler</div>
                        <div className="font-medium tabular-nums">
                            {fmtMoney(scenario.dailyPrimTotal)}
                        </div>
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
    locked,
    onSaveWork,
    onLeave,
    onClear
}: {
    entry: PackageDayEntry;
    isToday: boolean;
    leaveAllowed: boolean;
    saving: boolean;
    locked: boolean;
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
    const disabled = saving || locked;

    return (
        <div
            className={`px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-4 ${
                isToday ? 'bg-primary/5' : ''
            } ${isLeave || locked ? 'opacity-70' : ''}`}
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
                        disabled={disabled}
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
                                disabled={disabled}
                                className="block w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                            />
                        </label>
                        <div className="space-y-1">
                            <span className="text-[11px] text-muted-foreground">Tip</span>
                            <TipToggle value={tip} onChange={setTip} />
                        </div>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onSaveWork(entry.date, pkgNum, tip)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Kaydet
                        </button>
                        {leaveAllowed && !locked && (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={onLeave}
                                className="px-3 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-secondary/50 disabled:opacity-50"
                            >
                                İzin
                            </button>
                        )}
                        {isWork && !locked && (
                            <button
                                type="button"
                                disabled={disabled}
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
                        {isWork && (
                            <div className="font-semibold text-primary tabular-nums">
                                Toplam: {fmtMoney(prim + DAILY_FIXED)}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
