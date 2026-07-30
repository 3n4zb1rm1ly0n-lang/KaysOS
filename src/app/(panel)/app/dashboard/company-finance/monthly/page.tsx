'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

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

type LineEffect = 'exclude' | 'deduction' | 'addition';

type DerivedLine = {
    key: string;
    label: string;
    note: string;
    amount: number;
    effect: LineEffect;
};

type MonthDraft = {
    /** KDV dahil brüt ciro — boş = veri yok, mevcut/önceki ile devam */
    grossInput: string;
    /** Ödenen KDV (manuel / ileride formül) */
    kdvPaidInput: string;
    /** İndirilecek KDV */
    kdvDeductibleInput: string;
    note: string;
};

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(raw: string): number | null {
    const t = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Taslak formül — senin örnek zincirin (ileride Formüller’den gelecek) */
function deriveFromGross(gross: number): DerivedLine[] {
    const birimFiyat = gross / 1.2;
    const vergi = gross - birimFiyat;
    const netGelir = birimFiyat - vergi;
    const tevfikat = (vergi * 20) / 100;

    return [
        {
            key: 'birim',
            label: 'Birim Fiyat',
            note: `${compact(gross)} ÷ 1.2`,
            amount: birimFiyat,
            effect: 'exclude'
        },
        {
            key: 'vergi',
            label: 'Vergi (KDV)',
            note: `${compact(gross)} - ${compact(birimFiyat)}`,
            amount: vergi,
            effect: 'exclude'
        },
        {
            key: 'net_gelir',
            label: 'Net Gelir',
            note: `${compact(birimFiyat)} - ${compact(vergi)}`,
            amount: netGelir,
            effect: 'exclude'
        },
        {
            key: 'tevfikat',
            label: 'Tevfikat',
            note: `${compact(vergi)} % 20`,
            amount: tevfikat,
            effect: 'exclude'
        }
    ];
}

function compact(n: number): string {
    return String(Math.round(n * 1000) / 1000);
}

function emptyMonth(): MonthDraft {
    return { grossInput: '', kdvPaidInput: '', kdvDeductibleInput: '', note: '' };
}

function buildYearDrafts(): MonthDraft[] {
    return Array.from({ length: 12 }, () => emptyMonth());
}

export default function MonthlyRevenueDraftPage() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [months, setMonths] = useState<MonthDraft[]>(() => {
        const d = buildYearDrafts();
        // Örnek: Temmuz (index 6) — senin 132.000 senaryon
        d[6] = {
            grossInput: '132000',
            kdvPaidInput: '',
            kdvDeductibleInput: '',
            note: 'Örnek taslak veri'
        };
        return d;
    });
    const [openMonth, setOpenMonth] = useState<number | null>(6);

    const resolved = useMemo(() => {
        /** Veri yoksa son dolu aydaki brüt ile devam (taslak kural) */
        let lastGross: number | null = null;
        return months.map((m, idx) => {
            const entered = parseMoney(m.grossInput);
            const usedFallback = entered === null && lastGross !== null;
            const gross = entered ?? lastGross;
            if (entered !== null) lastGross = entered;

            const lines = gross !== null ? deriveFromGross(gross) : [];
            const kdvLine = lines.find((l) => l.key === 'vergi');
            const calculatedKdv = kdvLine?.amount ?? 0;
            const kdvPaid = parseMoney(m.kdvPaidInput) ?? 0;
            const kdvDeductible = parseMoney(m.kdvDeductibleInput) ?? 0;
            const kdvBalance = calculatedKdv - kdvDeductible - kdvPaid;

            const deductions = lines
                .filter((l) => l.effect === 'deduction')
                .reduce((a, l) => a + l.amount, 0);
            const additions = lines
                .filter((l) => l.effect === 'addition')
                .reduce((a, l) => a + l.amount, 0);
            const net = (gross ?? 0) - deductions + additions;

            return {
                idx,
                hasOwnData: entered !== null,
                usedFallback,
                missing: gross === null,
                gross: gross ?? 0,
                lines,
                calculatedKdv,
                kdvPaid,
                kdvDeductible,
                kdvBalance,
                deductions,
                additions,
                net
            };
        });
    }, [months]);

    const yearTotals = useMemo(() => {
        const withData = resolved.filter((r) => !r.missing);
        return {
            monthsFilled: withData.filter((r) => r.hasOwnData).length,
            gross: withData.reduce((a, r) => a + r.gross, 0),
            kdv: withData.reduce((a, r) => a + r.calculatedKdv, 0),
            kdvPaid: withData.reduce((a, r) => a + r.kdvPaid, 0),
            kdvDeductible: withData.reduce((a, r) => a + r.kdvDeductible, 0)
        };
    }, [resolved]);

    const updateMonth = (idx: number, patch: Partial<MonthDraft>) => {
        setMonths((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
    };

    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Aylık kazanç</h2>
                <p className="text-muted-foreground mt-1">
                    UI taslağı — SQL yok. Formüller onayından sonra bağlanacak. Ocak’tan itibaren tüm
                    aylar; veri yoksa son girilen brüt üzerinden hesap devam eder.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                <Info className="w-4 h-4 shrink-0" />
                <p>
                    Taslak formül şu an sabit: Brüt → ÷1.2 birim fiyat → KDV → net gelir → tevfikat
                    %20. Sen formülleri verdikten sonra burası Formüller modülüne bağlanacak.
                </p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <label className="block text-xs text-muted-foreground mb-1">Yıl</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
                <dl className="flex flex-wrap gap-4 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground">Dolu ay</dt>
                        <dd className="font-medium tabular-nums">{yearTotals.monthsFilled}/12</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Yıllık brüt*</dt>
                        <dd className="font-medium tabular-nums">{fmtMoney(yearTotals.gross)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Hesaplanan KDV*</dt>
                        <dd className="font-medium tabular-nums">{fmtMoney(yearTotals.kdv)}</dd>
                    </div>
                </dl>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-4">
                * Yıllık toplamda fallback ile doldurulan aylar da sayılır (taslak davranış).
            </p>

            <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {resolved.map((r) => {
                    const open = openMonth === r.idx;
                    const draft = months[r.idx];
                    return (
                        <li key={r.idx} className="bg-background">
                            <button
                                type="button"
                                onClick={() => setOpenMonth(open ? null : r.idx)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors"
                            >
                                {open ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">
                                            {MONTH_LABELS[r.idx]} {year}
                                        </span>
                                        {r.missing && (
                                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                                veri yok
                                            </span>
                                        )}
                                        {r.usedFallback && (
                                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200/90">
                                                önceki brüt
                                            </span>
                                        )}
                                        {r.hasOwnData && (
                                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-300/90">
                                                girilmiş
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs text-muted-foreground">Brüt</p>
                                    <p className="font-medium tabular-nums text-sm">
                                        {r.missing ? '—' : fmtMoney(r.gross)}
                                    </p>
                                </div>
                                <div className="text-right shrink-0 hidden sm:block w-28">
                                    <p className="text-xs text-muted-foreground">KDV</p>
                                    <p className="font-medium tabular-nums text-sm">
                                        {r.missing ? '—' : fmtMoney(r.calculatedKdv)}
                                    </p>
                                </div>
                            </button>

                            {open && (
                                <div className="px-4 pb-5 pt-1 space-y-6 border-t border-border/60 bg-secondary/10">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1">
                                                Brüt ciro (KDV dahil)
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="Boş = önceki ay"
                                                value={draft.grossInput}
                                                onChange={(e) =>
                                                    updateMonth(r.idx, {
                                                        grossInput: e.target.value
                                                    })
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1">
                                                Ödenen KDV
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0"
                                                value={draft.kdvPaidInput}
                                                onChange={(e) =>
                                                    updateMonth(r.idx, {
                                                        kdvPaidInput: e.target.value
                                                    })
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1">
                                                İndirilecek KDV
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0"
                                                value={draft.kdvDeductibleInput}
                                                onChange={(e) =>
                                                    updateMonth(r.idx, {
                                                        kdvDeductibleInput: e.target.value
                                                    })
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1">
                                                Not
                                            </label>
                                            <input
                                                type="text"
                                                value={draft.note}
                                                onChange={(e) =>
                                                    updateMonth(r.idx, { note: e.target.value })
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </div>
                                    </div>

                                    {r.missing ? (
                                        <p className="text-sm text-muted-foreground">
                                            Bu ay ve öncesinde brüt yok — hesaplanacak veri bekleniyor.
                                        </p>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Formül özeti (taslak)
                                                </h4>
                                                <dl className="space-y-2 text-sm rounded-lg border border-border bg-background px-4 py-3">
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-muted-foreground">Brüt</dt>
                                                        <dd className="font-medium tabular-nums">
                                                            {fmtMoney(r.gross)}
                                                        </dd>
                                                    </div>
                                                    {r.lines.map((line) => (
                                                        <div
                                                            key={line.key}
                                                            className="flex justify-between gap-4 items-start opacity-80"
                                                        >
                                                            <dt className="min-w-0">
                                                                <span>{line.label}</span>
                                                                <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                                                                    dahil değil
                                                                </span>
                                                                <span className="block text-xs font-mono text-muted-foreground mt-0.5">
                                                                    {line.note}
                                                                </span>
                                                            </dt>
                                                            <dd className="tabular-nums shrink-0 text-muted-foreground">
                                                                {fmtMoney(line.amount)}
                                                            </dd>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between gap-4 pt-2 border-t border-border">
                                                        <dt className="text-muted-foreground">
                                                            Toplam kesinti
                                                        </dt>
                                                        <dd className="tabular-nums text-red-400">
                                                            −{fmtMoney(r.deductions)}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4 text-base">
                                                        <dt className="font-semibold">Net</dt>
                                                        <dd className="font-bold tabular-nums">
                                                            {fmtMoney(r.net)}
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-2">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        KDV takibi
                                                    </h4>
                                                    <dl className="space-y-1.5 text-sm">
                                                        <div className="flex justify-between gap-2">
                                                            <dt className="text-muted-foreground">
                                                                Hesaplanan
                                                            </dt>
                                                            <dd className="tabular-nums">
                                                                {fmtMoney(r.calculatedKdv)}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <dt className="text-muted-foreground">
                                                                İndirilecek
                                                            </dt>
                                                            <dd className="tabular-nums">
                                                                {fmtMoney(r.kdvDeductible)}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <dt className="text-muted-foreground">
                                                                Ödenen
                                                            </dt>
                                                            <dd className="tabular-nums">
                                                                {fmtMoney(r.kdvPaid)}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-2 pt-1.5 border-t border-border">
                                                            <dt className="font-medium">Bakiye*</dt>
                                                            <dd className="font-medium tabular-nums">
                                                                {fmtMoney(r.kdvBalance)}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        * Hesaplanan − indirilecek − ödenen (taslak)
                                                    </p>
                                                </div>

                                                <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-3 space-y-2">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        Gelir vergisi (detaylı)
                                                    </h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Placeholder — matrah dilimleri, istisna,
                                                        peşin vergi vb. formüllerini verdikten sonra
                                                        buraya bağlanacak.
                                                    </p>
                                                    <dl className="space-y-1.5 text-sm opacity-50">
                                                        <div className="flex justify-between gap-2">
                                                            <dt>Matrah</dt>
                                                            <dd className="tabular-nums">—</dd>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <dt>Hesaplanan GV</dt>
                                                            <dd className="tabular-nums">—</dd>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <dt>Ödenen / mahsup</dt>
                                                            <dd className="tabular-nums">—</dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
