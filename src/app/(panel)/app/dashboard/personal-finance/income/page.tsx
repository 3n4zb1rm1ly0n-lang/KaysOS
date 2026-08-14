'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Link2, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES_TR } from '@/lib/income-tax';
import {
    COMPANY_SOURCE,
    PF_EXPENSES,
    PF_INCOMES,
    WITHHELD_KINDS,
    fetchCompanyCashNet,
    fmtMoney,
    incomeNetCash,
    mapIncome,
    monthLabel,
    parseMoney,
    type PersonalIncomeRow
} from '@/lib/personal-finance';

export default function PersonalIncomePage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [incomes, setIncomes] = useState<PersonalIncomeRow[]>([]);
    const [expenseTotal, setExpenseTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    const [draftName, setDraftName] = useState('');
    const [draftAmount, setDraftAmount] = useState('');
    const [draftDue, setDraftDue] = useState('');
    const [draftReceived, setDraftReceived] = useState(true);
    const [draftRepeat, setDraftRepeat] = useState(false);

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    const load = useCallback(async (y: number, m: number) => {
        setLoading(true);
        setError(null);
        setStatus(null);

        const [incRes, expRes] = await Promise.all([
            supabase
                .from(PF_INCOMES)
                .select('*')
                .eq('year', y)
                .eq('month', m)
                .order('sort_order')
                .order('created_at'),
            supabase
                .from(PF_EXPENSES)
                .select('amount')
                .eq('year', y)
                .eq('month', m)
        ]);

        if (incRes.error) {
            setError(
                incRes.error.message.includes('does not exist') ||
                    incRes.error.code === '42P01'
                    ? 'Tablo bulunamadı. Supabase’te create_personal_finance.sql çalıştırın.'
                    : incRes.error.message
            );
            setIncomes([]);
            setExpenseTotal(0);
            setLoading(false);
            return;
        }

        setIncomes((incRes.data ?? []).map((r) => mapIncome(r as Record<string, unknown>)));
        if (!expRes.error) {
            setExpenseTotal(
                (expRes.data ?? []).reduce((a, r) => a + parseMoney(r.amount), 0)
            );
        } else {
            setExpenseTotal(0);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load(year, month);
    }, [year, month, load]);

    const incomeTotal = useMemo(
        () => incomes.reduce((a, r) => a + r.amount, 0),
        [incomes]
    );
    const withheldTotal = useMemo(
        () => incomes.reduce((a, r) => a + Math.min(r.withheld_amount, r.amount), 0),
        [incomes]
    );
    const netCashTotal = useMemo(
        () => incomes.reduce((a, r) => a + incomeNetCash(r.amount, r.withheld_amount), 0),
        [incomes]
    );
    const remaining = netCashTotal - expenseTotal;
    const companyLinked = incomes.some((r) => r.source === COMPANY_SOURCE);

    const bindCompanyMonth = async () => {
        setBusy(true);
        setError(null);
        setStatus(null);

        if (companyLinked) {
            setError('Bu ay zaten şirket nakiti bağlı. Önce satırı silip yeniden bağlayabilirsin.');
            setBusy(false);
            return;
        }

        const cash = await fetchCompanyCashNet(year, month);
        if (cash.ok === false) {
            setError(
                cash.reason === 'no_entry'
                    ? `${cash.message} Önce Aylık kazanç’ta kaydet.`
                    : cash.message
            );
            setBusy(false);
            return;
        }

        const { error: insErr } = await supabase.from(PF_INCOMES).insert([
            {
                year,
                month,
                name: `Şirket nakit · ${monthLabel(month)} ${year}`,
                amount: cash.amount,
                source: COMPANY_SOURCE,
                company_monthly_entry_id: cash.entryId,
                due_date: null,
                is_received: true,
                repeats_monthly: false,
                note: 'Aylık kazanç → Aylık net (nakit)',
                sort_order: 0
            }
        ]);

        if (insErr) {
            setError(
                insErr.message.includes('does not exist')
                    ? 'Tablo bulunamadı. Supabase’te create_personal_finance.sql çalıştırın.'
                    : insErr.message
            );
            setBusy(false);
            return;
        }

        setStatus(`Şirket nakiti bağlandı: ${fmtMoney(cash.amount)}`);
        setBusy(false);
        await load(year, month);
    };

    const refreshCompanyAmount = async (row: PersonalIncomeRow) => {
        setBusy(true);
        setError(null);
        const cash = await fetchCompanyCashNet(year, month);
        if (cash.ok === false) {
            setError(cash.message);
            setBusy(false);
            return;
        }
        const { error: uErr } = await supabase
            .from(PF_INCOMES)
            .update({
                amount: cash.amount,
                company_monthly_entry_id: cash.entryId,
                name: `Şirket nakit · ${monthLabel(month)} ${year}`
            })
            .eq('id', row.id);
        if (uErr) setError(uErr.message);
        else setStatus(`Şirket tutarı güncellendi: ${fmtMoney(cash.amount)}`);
        setBusy(false);
        await load(year, month);
    };

    const addManual = async () => {
        const name = draftName.trim() || 'Gelir';
        const amount = parseMoney(draftAmount);
        if (amount <= 0) {
            setError('Tutar gir.');
            return;
        }
        setBusy(true);
        setError(null);
        const { error: insErr } = await supabase.from(PF_INCOMES).insert([
            {
                year,
                month,
                name,
                amount,
                source: '',
                due_date: draftDue || null,
                is_received: draftReceived,
                repeats_monthly: draftRepeat,
                note: '',
                sort_order: incomes.length + 1
            }
        ]);
        if (insErr) {
            setError(insErr.message);
            setBusy(false);
            return;
        }
        setDraftName('');
        setDraftAmount('');
        setDraftDue('');
        setDraftReceived(true);
        setDraftRepeat(false);
        setStatus('Gelir eklendi');
        setBusy(false);
        await load(year, month);
    };

    const updateRow = async (
        id: string,
        patch: Partial<{
            name: string;
            amount: number;
            due_date: string | null;
            is_received: boolean;
            repeats_monthly: boolean;
            withheld_amount: number;
            withheld_kind: string;
            withheld_note: string;
        }>
    ) => {
        const { error: uErr } = await supabase.from(PF_INCOMES).update(patch).eq('id', id);
        if (uErr) {
            setError(
                uErr.message.includes('withheld_')
                    ? 'Bloke/haciz kolonları yok. Supabase’te create_personal_budget_savings.sql çalıştırın.'
                    : uErr.message
            );
            return;
        }
        setIncomes((prev) =>
            prev.map((r) =>
                r.id === id
                    ? {
                          ...r,
                          ...patch,
                          due_date:
                              patch.due_date !== undefined ? patch.due_date : r.due_date
                      }
                    : r
            )
        );
    };

    const removeRow = async (id: string) => {
        setBusy(true);
        const { error: dErr } = await supabase.from(PF_INCOMES).delete().eq('id', id);
        if (dErr) setError(dErr.message);
        setBusy(false);
        await load(year, month);
    };

    const copyRepeatingFromPrev = async () => {
        setBusy(true);
        setError(null);
        let py = year;
        let pm = month - 1;
        if (pm < 1) {
            pm = 12;
            py -= 1;
        }
        const { data, error: qErr } = await supabase
            .from(PF_INCOMES)
            .select('*')
            .eq('year', py)
            .eq('month', pm)
            .eq('repeats_monthly', true)
            .neq('source', COMPANY_SOURCE);
        if (qErr) {
            setError(qErr.message);
            setBusy(false);
            return;
        }
        const existingNames = new Set(incomes.filter((i) => !i.source).map((i) => i.name));
        const toInsert = (data ?? [])
            .map((r) => mapIncome(r as Record<string, unknown>))
            .filter((r) => !existingNames.has(r.name))
            .map((r, i) => ({
                year,
                month,
                name: r.name,
                amount: r.amount,
                source: '',
                due_date: null,
                is_received: false,
                repeats_monthly: true,
                note: r.note,
                sort_order: incomes.length + i + 1
            }));
        if (toInsert.length === 0) {
            setStatus('Aktarılacak tekrarlayan gelir yok.');
            setBusy(false);
            return;
        }
        const { error: insErr } = await supabase.from(PF_INCOMES).insert(toInsert);
        if (insErr) setError(insErr.message);
        else setStatus(`${toInsert.length} tekrarlayan gelir kopyalandı.`);
        setBusy(false);
        await load(year, month);
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-primary" />
                        Gelirler
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Şirket nakitini bağla; bloke/haciz düşümüyle net nakiti bütçeye yönlendir.{' '}
                        <Link
                            href="/app/dashboard/personal-finance/budget"
                            className="text-primary hover:underline"
                        >
                            Bütçe
                        </Link>
                        {' · '}
                        <Link
                            href="/app/dashboard/personal-finance/expenses"
                            className="text-primary hover:underline"
                        >
                            Giderler
                        </Link>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                        {MONTH_NAMES_TR.map((label, i) => (
                            <option key={label} value={i + 1}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Brüt gelir
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-primary">
                        {fmtMoney(incomeTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Bloke / haciz
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-orange-400">
                        {fmtMoney(withheldTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Net nakit
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-cyan-400">
                        {fmtMoney(netCashTotal)}
                    </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Net − gider
                    </p>
                    <p
                        className={`text-lg font-semibold tabular-nums ${
                            remaining >= 0 ? 'text-primary' : 'text-red-400'
                        }`}
                    >
                        {fmtMoney(remaining)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        Gider {fmtMoney(expenseTotal)}
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-400 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                    {error}
                </p>
            )}
            {status && (
                <p className="text-sm text-muted-foreground rounded-md border border-border px-3 py-2">
                    {status}
                </p>
            )}

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={busy || loading || companyLinked}
                    onClick={() => void bindCompanyMonth()}
                    className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                    {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Link2 className="w-4 h-4" />
                    )}
                    Bu ayı bağla
                </button>
                <button
                    type="button"
                    disabled={busy || loading}
                    onClick={() => void copyRepeatingFromPrev()}
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                    Tekrarlayanları aktar
                </button>
                <Link
                    href="/app/dashboard/company-finance/monthly"
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary inline-flex items-center"
                >
                    Aylık kazanç
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
                </div>
            ) : (
                <ul className="space-y-3">
                    {incomes.length === 0 && (
                        <li className="text-sm text-muted-foreground">
                            Bu ay henüz gelir yok. Şirket nakiti bağla veya aşağıdan ekle.
                        </li>
                    )}
                    {incomes.map((row) => {
                        const isCompany = row.source === COMPANY_SOURCE;
                        return (
                            <li
                                key={row.id}
                                className="rounded-lg border border-border bg-background p-3 space-y-2"
                            >
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Ad
                                            {isCompany && (
                                                <span className="ml-1 text-primary">
                                                    · Şirket
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            value={row.name}
                                            disabled={isCompany}
                                            onChange={(e) =>
                                                setIncomes((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, name: e.target.value }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() => {
                                                if (!isCompany)
                                                    void updateRow(row.id, {
                                                        name: row.name.trim() || 'Gelir'
                                                    });
                                            }}
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-70"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Tutar
                                        </label>
                                        <input
                                            value={String(row.amount)}
                                            inputMode="decimal"
                                            disabled={isCompany}
                                            onChange={(e) =>
                                                setIncomes((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? {
                                                                  ...r,
                                                                  amount: parseMoney(
                                                                      e.target.value
                                                                  )
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() => {
                                                if (!isCompany)
                                                    void updateRow(row.id, {
                                                        amount: row.amount
                                                    });
                                            }}
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums disabled:opacity-70"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Son ödeme / tarih
                                        </label>
                                        <input
                                            type="date"
                                            value={row.due_date ?? ''}
                                            disabled={isCompany}
                                            onChange={(e) => {
                                                const v = e.target.value || null;
                                                setIncomes((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, due_date: v }
                                                            : r
                                                    )
                                                );
                                                if (!isCompany)
                                                    void updateRow(row.id, { due_date: v });
                                            }}
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-70"
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-end gap-3 pb-1">
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <input
                                                type="checkbox"
                                                checked={row.is_received}
                                                disabled={isCompany}
                                                onChange={(e) => {
                                                    const v = e.target.checked;
                                                    setIncomes((prev) =>
                                                        prev.map((r) =>
                                                            r.id === row.id
                                                                ? { ...r, is_received: v }
                                                                : r
                                                        )
                                                    );
                                                    if (!isCompany)
                                                        void updateRow(row.id, {
                                                            is_received: v
                                                        });
                                                }}
                                            />
                                            Alındı
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <input
                                                type="checkbox"
                                                checked={row.repeats_monthly}
                                                disabled={isCompany}
                                                onChange={(e) => {
                                                    const v = e.target.checked;
                                                    setIncomes((prev) =>
                                                        prev.map((r) =>
                                                            r.id === row.id
                                                                ? {
                                                                      ...r,
                                                                      repeats_monthly: v
                                                                  }
                                                                : r
                                                        )
                                                    );
                                                    if (!isCompany)
                                                        void updateRow(row.id, {
                                                            repeats_monthly: v
                                                        });
                                                }}
                                            />
                                            Tekrarla (her ay)
                                        </label>
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Bloke / haciz tutarı
                                        </label>
                                        <input
                                            value={String(row.withheld_amount)}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setIncomes((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? {
                                                                  ...r,
                                                                  withheld_amount: parseMoney(
                                                                      e.target.value
                                                                  )
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateRow(row.id, {
                                                    withheld_amount: row.withheld_amount
                                                })
                                            }
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">
                                            Kesinti türü
                                        </label>
                                        <select
                                            value={row.withheld_kind}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setIncomes((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? { ...r, withheld_kind: v }
                                                            : r
                                                    )
                                                );
                                                void updateRow(row.id, { withheld_kind: v });
                                            }}
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        >
                                            {WITHHELD_KINDS.map((k) => (
                                                <option key={k.value || 'none'} value={k.value}>
                                                    {k.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] text-muted-foreground">
                                            Kesinti notu / alacaklı
                                        </label>
                                        <input
                                            value={row.withheld_note}
                                            onChange={(e) =>
                                                setIncomes((prev) =>
                                                    prev.map((r) =>
                                                        r.id === row.id
                                                            ? {
                                                                  ...r,
                                                                  withheld_note: e.target.value
                                                              }
                                                            : r
                                                    )
                                                )
                                            }
                                            onBlur={() =>
                                                void updateRow(row.id, {
                                                    withheld_note: row.withheld_note
                                                })
                                            }
                                            placeholder="Banka blokesi, icra…"
                                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Net eline geçen:{' '}
                                    <span className="font-semibold text-cyan-400 tabular-nums">
                                        {fmtMoney(
                                            incomeNetCash(row.amount, row.withheld_amount)
                                        )}
                                    </span>
                                </p>
                                <div className="flex justify-between gap-2">
                                    {isCompany ? (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void refreshCompanyAmount(row)}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            Şirketten yenile
                                        </button>
                                    ) : (
                                        <span />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void removeRow(row.id)}
                                        className="p-1.5 text-muted-foreground hover:text-red-400"
                                        aria-label="Sil"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <h2 className="text-sm font-semibold">Gelir ekle</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="text-[10px] text-muted-foreground">Ad</label>
                        <input
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Freelance, kira…"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">Tutar</label>
                        <input
                            value={draftAmount}
                            onChange={(e) => setDraftAmount(e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-muted-foreground">
                            Son ödeme / tarih
                        </label>
                        <input
                            type="date"
                            value={draftDue}
                            onChange={(e) => setDraftDue(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div className="flex flex-wrap items-end gap-3 pb-1">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={draftReceived}
                                onChange={(e) => setDraftReceived(e.target.checked)}
                            />
                            Alındı
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={draftRepeat}
                                onChange={(e) => setDraftRepeat(e.target.checked)}
                            />
                            Tekrarla (her ay)
                        </label>
                    </div>
                </div>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addManual()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> Ekle
                </button>
            </div>
        </div>
    );
}
