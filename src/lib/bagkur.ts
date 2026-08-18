/** Bağkur 4/b — aylık prim + faiz özeti */

export const BAGKUR_START = { year: 2024, month: 12 } as const;

/** e-Devlet referans (2026-08-04) */
export const SGK_REF = {
    principal: 182_304.32,
    penalty: 78_392.89,
    total: 284_313.69
} as const;

/** 78.392,89 / 182.304,32 */
export const DEFAULT_PENALTY_RATIO = SGK_REF.penalty / SGK_REF.principal;

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

export function monthLabel(month: number): string {
    return MONTH_LABELS[month - 1] ?? String(month);
}

export type BagkurMonthRow = {
    year: number;
    month: number;
    prim_amount: number;
    is_paid: boolean;
    paid_at: string | null;
    note: string;
    id?: string;
};

export type YearlyPrims = Record<string, number>;

export type BagkurSettings = {
    id?: string;
    company_start_year: number;
    company_start_month: number;
    penalty_ratio: number;
    sgk_principal_ref: number;
    sgk_penalty_ref: number;
    sgk_total_ref: number;
    yearly_prims: YearlyPrims;
    note: string;
};

/** Bilinen yıllar — 2027+ ayardan girilir */
export const DEFAULT_YEARLY_PRIMS: YearlyPrims = {
    '2024': 6900.86,
    '2025': 9036.91,
    '2026': 11808.23,
    '2027': 0
};

/**
 * Dönem bazlı indirimsiz taban prim (4/b).
 * Ayarlardaki yearly_prims öncelikli; yoksa varsayılan tablo.
 */
export function defaultPrimFor(
    year: number,
    _month?: number,
    yearlyPrims?: YearlyPrims | null
): number {
    const key = String(year);
    if (yearlyPrims && key in yearlyPrims) {
        const v = Number(yearlyPrims[key]);
        if (Number.isFinite(v) && v >= 0) return v;
    }
    if (year <= 2024) return DEFAULT_YEARLY_PRIMS['2024'];
    if (year === 2025) return DEFAULT_YEARLY_PRIMS['2025'];
    if (year === 2026) return DEFAULT_YEARLY_PRIMS['2026'];
    return Number(yearlyPrims?.[key]) || 0;
}

export function mergeYearlyPrims(raw: unknown): YearlyPrims {
    const base = { ...DEFAULT_YEARLY_PRIMS };
    if (!raw || typeof raw !== 'object') return base;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const n = Number(v);
        if (/^\d{4}$/.test(k) && Number.isFinite(n) && n >= 0) base[k] = n;
    }
    return base;
}

/** Ayarlarda gösterilecek yıl listesi (başlangıç → through+1) */
export function editablePrimYears(
    startYear: number = BAGKUR_START.year,
    throughYear: number = new Date().getFullYear() + 1
): number[] {
    const years: number[] = [];
    for (let y = startYear; y <= throughYear; y++) years.push(y);
    return years;
}

export function ymKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
}

export function compareYm(
    a: { year: number; month: number },
    b: { year: number; month: number }
): number {
    return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** Açılıştan `through` ayına (dahil) kadar satır iskeleti */
export function buildSchedule(
    startYear: number,
    startMonth: number,
    throughYear: number,
    throughMonth: number,
    existing: BagkurMonthRow[] = [],
    yearlyPrims?: YearlyPrims | null
): BagkurMonthRow[] {
    const byKey = new Map(existing.map((r) => [ymKey(r.year, r.month), r]));
    const rows: BagkurMonthRow[] = [];
    let y = startYear;
    let m = startMonth;
    while (y < throughYear || (y === throughYear && m <= throughMonth)) {
        const key = ymKey(y, m);
        const prev = byKey.get(key);
        rows.push(
            prev ?? {
                year: y,
                month: m,
                prim_amount: defaultPrimFor(y, m, yearlyPrims),
                is_paid: false,
                paid_at: null,
                note: ''
            }
        );
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
    }
    return rows;
}

/** Bugünden N ay ileri (varsayılan: yıl sonu + 1 yıl) */
export function defaultThrough(now = new Date()): { year: number; month: number } {
    // Bu yılın sonuna + gelecek yıl tamamı
    return { year: now.getFullYear() + 1, month: 12 };
}

export type YearSummary = {
    year: number;
    months: number;
    paidMonths: number;
    unpaidMonths: number;
    principal: number;
    unpaidPrincipal: number;
    paidPrincipal: number;
    interest: number;
    total: number;
};

export type BagkurSummary = {
    unpaidPrincipal: number;
    paidPrincipal: number;
    interest: number;
    grandTotal: number;
    unpaidMonths: number;
    paidMonths: number;
    byYear: YearSummary[];
};

export function summarizeBagkur(
    rows: BagkurMonthRow[],
    penaltyRatio: number,
    /** Bu aya kadar (dahil) borç sayılır; sonrası planlanan, borca girmez */
    through?: { year: number; month: number }
): BagkurSummary {
    const now = new Date();
    const asOf = through ?? {
        year: now.getFullYear(),
        month: now.getMonth() + 1
    };

    let unpaidPrincipal = 0;
    let paidPrincipal = 0;
    let unpaidMonths = 0;
    let paidMonths = 0;

    const yearMap = new Map<
        number,
        {
            months: number;
            paidMonths: number;
            unpaidMonths: number;
            principal: number;
            unpaidPrincipal: number;
            paidPrincipal: number;
            interestBase: number;
        }
    >();

    for (const r of rows) {
        const prim = Number(r.prim_amount) || 0;
        const accrued = compareYm(r, asOf) <= 0;

        let y = yearMap.get(r.year);
        if (!y) {
            y = {
                months: 0,
                paidMonths: 0,
                unpaidMonths: 0,
                principal: 0,
                unpaidPrincipal: 0,
                paidPrincipal: 0,
                interestBase: 0
            };
            yearMap.set(r.year, y);
        }

        // Yıllık satır sayacı: yalnızca tahakkuk etmiş aylar
        if (!accrued) continue;

        y.months += 1;
        y.principal += prim;

        if (r.is_paid) {
            paidMonths += 1;
            paidPrincipal += prim;
            y.paidMonths += 1;
            y.paidPrincipal += prim;
        } else {
            unpaidMonths += 1;
            unpaidPrincipal += prim;
            y.unpaidMonths += 1;
            y.unpaidPrincipal += prim;
            y.interestBase += prim;
        }
    }

    const interest = round2(unpaidPrincipal * penaltyRatio);
    const byYear: YearSummary[] = Array.from(yearMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([year, y]) => {
            const yi = round2(y.interestBase * penaltyRatio);
            return {
                year,
                months: y.months,
                paidMonths: y.paidMonths,
                unpaidMonths: y.unpaidMonths,
                principal: round2(y.principal),
                unpaidPrincipal: round2(y.unpaidPrincipal),
                paidPrincipal: round2(y.paidPrincipal),
                interest: yi,
                total: round2(y.unpaidPrincipal + yi)
            };
        });

    return {
        unpaidPrincipal: round2(unpaidPrincipal),
        paidPrincipal: round2(paidPrincipal),
        interest,
        grandTotal: round2(unpaidPrincipal + interest),
        unpaidMonths,
        paidMonths,
        byYear
    };
}

/** Satır bazlı faiz: ödenmemiş + tahakkuk etmiş ise prim × oran */
export function monthInterestAmount(
    row: BagkurMonthRow,
    penaltyRatio: number,
    through?: { year: number; month: number }
): number | null {
    const now = new Date();
    const asOf = through ?? {
        year: now.getFullYear(),
        month: now.getMonth() + 1
    };
    if (compareYm(row, asOf) > 0) return null; // henüz gelmedi
    if (row.is_paid) return 0;
    return round2((Number(row.prim_amount) || 0) * penaltyRatio);
}

export function isFutureMonth(
    row: { year: number; month: number },
    through?: { year: number; month: number }
): boolean {
    const now = new Date();
    const asOf = through ?? {
        year: now.getFullYear(),
        month: now.getMonth() + 1
    };
    return compareYm(row, asOf) > 0;
}

/** Bu ay ödenecek Bağkur (prim + faiz); ödendiyse 0 */
export function thisMonthDue(
    rows: BagkurMonthRow[],
    penaltyRatio: number,
    now = new Date()
): {
    year: number;
    month: number;
    prim: number;
    interest: number;
    total: number;
    paid: boolean;
    found: boolean;
} {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const row = rows.find((r) => r.year === year && r.month === month);
    if (!row) {
        return { year, month, prim: 0, interest: 0, total: 0, paid: false, found: false };
    }
    const prim = Number(row.prim_amount) || 0;
    if (row.is_paid) {
        return { year, month, prim, interest: 0, total: 0, paid: true, found: true };
    }
    const interest = monthInterestAmount(row, penaltyRatio, { year, month }) ?? 0;
    return {
        year,
        month,
        prim,
        interest,
        total: round2(prim + interest),
        paid: false,
        found: true
    };
}

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(ratio: number): string {
    return `%${(ratio * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
}

export function defaultSettings(): BagkurSettings {
    return {
        company_start_year: BAGKUR_START.year,
        company_start_month: BAGKUR_START.month,
        penalty_ratio: DEFAULT_PENALTY_RATIO,
        sgk_principal_ref: SGK_REF.principal,
        sgk_penalty_ref: SGK_REF.penalty,
        sgk_total_ref: SGK_REF.total,
        yearly_prims: { ...DEFAULT_YEARLY_PRIMS },
        note: ''
    };
}

/** Referans cezaya göre oran: penalty_ref / unpaidPrincipal */
export function calibrateRatio(unpaidPrincipal: number, penaltyRef: number): number {
    if (unpaidPrincipal <= 0) return DEFAULT_PENALTY_RATIO;
    return penaltyRef / unpaidPrincipal;
}
