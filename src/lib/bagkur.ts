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

export type BagkurSettings = {
    id?: string;
    company_start_year: number;
    company_start_month: number;
    penalty_ratio: number;
    sgk_principal_ref: number;
    sgk_penalty_ref: number;
    sgk_total_ref: number;
    note: string;
};

/**
 * Dönem bazlı indirimsiz taban prim (4/b).
 * 2024: %34,50 × 20.002,50 = 6.900,86
 * 2025: %34,75 × 26.005,50 = 9.036,91
 * 2026+: %35,75 × 33.030,00 = 11.808,23
 */
export function defaultPrimFor(year: number, _month: number): number {
    if (year <= 2024) return 6900.86;
    if (year === 2025) return 9036.91;
    return 11808.23;
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
    existing: BagkurMonthRow[] = []
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
                prim_amount: defaultPrimFor(y, m),
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
        note: ''
    };
}

/** Referans cezaya göre oran: penalty_ref / unpaidPrincipal */
export function calibrateRatio(unpaidPrincipal: number, penaltyRef: number): number {
    if (unpaidPrincipal <= 0) return DEFAULT_PENALTY_RATIO;
    return penaltyRef / unpaidPrincipal;
}
