/** Satış cirosu varsayılan KDV oranı (KDV dahil brüt → net). */
export const SALES_VAT_RATE = 20;

/**
 * Tevfikat = hesaplanan satış KDV’sinin yüzdesi.
 * Peşin vergi olarak yıllık GV’den mahsup edilir.
 */
export const TEVFIKAT_OF_VAT_PERCENT = 20;

export type TaxBracket = {
    min_amount: number;
    max_amount: number | null;
    rate_percent: number;
};

export type BracketSlice = {
    min: number;
    max: number | null;
    rate: number;
    taxableInSlice: number;
    taxInSlice: number;
};

export type ProgressiveTaxResult = {
    base: number;
    totalTax: number;
    slices: BracketSlice[];
};

export type ExpenseBreakdown = {
    amountGross: number;
    kdvRate: number;
    amountNet: number;
    kdvAmount: number;
};

/** KDV dahil tutardan net + KDV (oran %). */
export function splitVatInclusive(amountGross: number, ratePercent: number): {
    net: number;
    vat: number;
} {
    const gross = Number.isFinite(amountGross) ? Math.max(0, amountGross) : 0;
    const rate = Number.isFinite(ratePercent) ? Math.max(0, ratePercent) : 0;
    if (rate <= 0) return { net: gross, vat: 0 };
    const net = gross / (1 + rate / 100);
    return { net, vat: gross - net };
}

export function salesFromGrossInclusive(
    grossInclusive: number,
    salesVatRate = SALES_VAT_RATE
): { netRevenue: number; salesVat: number; tevfikat: number } {
    const { net, vat } = splitVatInclusive(grossInclusive, salesVatRate);
    const tevfikat = (vat * TEVFIKAT_OF_VAT_PERCENT) / 100;
    return { netRevenue: net, salesVat: vat, tevfikat };
}

export function expenseBreakdown(
    amountGross: number,
    kdvRate: number
): ExpenseBreakdown {
    const { net, vat } = splitVatInclusive(amountGross, kdvRate);
    return {
        amountGross: Number.isFinite(amountGross) ? Math.max(0, amountGross) : 0,
        kdvRate: Number.isFinite(kdvRate) ? Math.max(0, kdvRate) : 0,
        amountNet: net,
        kdvAmount: vat
    };
}

/** Dilimli (progressive) gelir vergisi. */
export function progressiveIncomeTax(
    annualTaxableBase: number,
    brackets: TaxBracket[]
): ProgressiveTaxResult {
    const base = Number.isFinite(annualTaxableBase)
        ? Math.max(0, annualTaxableBase)
        : 0;
    const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount);
    const slices: BracketSlice[] = [];
    let totalTax = 0;

    for (const b of sorted) {
        const min = Math.max(0, b.min_amount);
        const max = b.max_amount == null ? null : Math.max(min, b.max_amount);
        const rate = Math.max(0, b.rate_percent);
        if (base <= min) {
            slices.push({
                min,
                max,
                rate,
                taxableInSlice: 0,
                taxInSlice: 0
            });
            continue;
        }
        const upper = max == null ? base : Math.min(base, max);
        const taxableInSlice = Math.max(0, upper - min);
        const taxInSlice = (taxableInSlice * rate) / 100;
        totalTax += taxInSlice;
        slices.push({ min, max, rate, taxableInSlice, taxInSlice });
    }

    return { base, totalTax, slices };
}

/**
 * Aylık matrah: KDV hariç ciro − KDV hariç giderler.
 * Negatif olursa 0 (o ay zarar; yıllıkta ayrıca toplanır — burada ay bazında floor yok,
 * yıllık toplamda floor uygulanır).
 */
export function monthlyTaxableBase(netRevenue: number, expenseNetTotal: number): number {
    return (Number.isFinite(netRevenue) ? netRevenue : 0) -
        (Number.isFinite(expenseNetTotal) ? expenseNetTotal : 0);
}

/** Kümülatif: her ay için yıl başından o aya GV ve aya düşen fark + tevfikat mahsubu. */
export function cumulativeMonthlyTaxSchedule(
    monthlyBases: number[],
    monthlyTevfikat: number[],
    brackets: TaxBracket[]
): {
    cumulativeBase: number;
    cumulativeGv: number;
    cumulativeTevfikat: number;
    gvDueAfterTevfikat: number;
    months: {
        monthIndex: number;
        monthBase: number;
        cumulativeBase: number;
        cumulativeGv: number;
        monthGvDelta: number;
        monthTevfikat: number;
        cumulativeTevfikat: number;
        gvDueAfterTevfikat: number;
    }[];
} {
    let cumulativeBase = 0;
    let prevGv = 0;
    let cumulativeTevfikat = 0;
    const months = monthlyBases.map((monthBase, monthIndex) => {
        cumulativeBase += Number.isFinite(monthBase) ? monthBase : 0;
        const { totalTax: cumulativeGv } = progressiveIncomeTax(
            Math.max(0, cumulativeBase),
            brackets
        );
        const monthGvDelta = cumulativeGv - prevGv;
        prevGv = cumulativeGv;
        const monthTevfikat = Number.isFinite(monthlyTevfikat[monthIndex])
            ? Math.max(0, monthlyTevfikat[monthIndex])
            : 0;
        cumulativeTevfikat += monthTevfikat;
        const gvDueAfterTevfikat = Math.max(0, cumulativeGv - cumulativeTevfikat);
        return {
            monthIndex,
            monthBase: Number.isFinite(monthBase) ? monthBase : 0,
            cumulativeBase,
            cumulativeGv,
            monthGvDelta,
            monthTevfikat,
            cumulativeTevfikat,
            gvDueAfterTevfikat
        };
    });

    const last = months[months.length - 1];
    return {
        cumulativeBase: last?.cumulativeBase ?? 0,
        cumulativeGv: last?.cumulativeGv ?? 0,
        cumulativeTevfikat: last?.cumulativeTevfikat ?? 0,
        gvDueAfterTevfikat: last?.gvDueAfterTevfikat ?? 0,
        months
    };
}

export const DEFAULT_2026_BRACKETS: TaxBracket[] = [
    { min_amount: 0, max_amount: 190_000, rate_percent: 15 },
    { min_amount: 190_000, max_amount: 400_000, rate_percent: 20 },
    { min_amount: 400_000, max_amount: 1_500_000, rate_percent: 27 },
    { min_amount: 1_500_000, max_amount: 5_300_000, rate_percent: 35 },
    { min_amount: 5_300_000, max_amount: null, rate_percent: 40 }
];

export const MONTH_NAMES_TR = [
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

/** Geçici vergi dönem sonu ayları (0-index): Mart, Haziran, Eylül — 4. dönem yok */
export const GECICI_VERGI_MONTH_INDEXES = [2, 5, 8] as const;

const GECICI_REASONS: Record<number, string> = {
    1: 'İlk üç aylık ticari kazanç hesaplanır. Devlet yıl sonunu beklemeden gelir vergisinin bir kısmını tahsil eder.',
    2: 'Nisan–Haziran dönemi kazancı hesaplanır.',
    3: 'Temmuz–Eylül dönemi kazancı hesaplanır.'
};

export type PaymentCalendarRow = {
    id: string;
    periodLabel: string;
    /** İşlem: KDV / KDV + geçici / yıllık beyanname */
    islem: string;
    /** Neden hesaplanır? */
    reason: string;
    declarationLabel: string;
    paymentLabel: string;
    kdvDue: number;
    incomeDue: number;
    totalDue: number;
    geciciNo: number | null;
    isYearEnd: boolean;
    installmentMarch?: number;
    installmentJuly?: number;
};

function monthLabel(year: number, monthIndex: number): string {
    const yOffset = Math.floor(monthIndex / 12);
    const m = ((monthIndex % 12) + 12) % 12;
    const label = MONTH_NAMES_TR[m];
    const y = year + yOffset;
    return y === year ? label : `${label} ${y}`;
}

function kdvReason(monthIndex: number): string {
    const name = MONTH_NAMES_TR[monthIndex];
    if (monthIndex === 0) {
        return 'Ocak ayında müşterilerden tahsil edilen KDV ile giderlerde ödenen KDV arasındaki fark hesaplanır.';
    }
    if (monthIndex === 11) {
        return 'Aralık ayı KDV hesaplanır. Yıl sonu kapanışına hazırlanılır.';
    }
    return `${name} ayı KDV hesaplanır.`;
}

/**
 * Beyan / ödeme takvimi (3 geçici dönem + Mart yıllık beyanname).
 * Geçici: çeyrek sonu kümülatif GV − tevfikat − önceki geçici.
 * Yıllık: yıllık GV − geçici − tevfikat; Mart & Temmuz 2 taksit.
 */
export function buildPaymentCalendar(
    year: number,
    monthlyKdvDue: number[],
    schedule: ReturnType<typeof cumulativeMonthlyTaxSchedule>
): PaymentCalendarRow[] {
    const kdv = Array.from({ length: 12 }, (_, i) =>
        Math.max(0, Number.isFinite(monthlyKdvDue[i]) ? monthlyKdvDue[i] : 0)
    );

    const geciciEnds = GECICI_VERGI_MONTH_INDEXES as readonly number[];
    const geciciAmounts: number[] = [];
    let prevGeciciSum = 0;
    for (let q = 0; q < geciciEnds.length; q++) {
        const endIdx = geciciEnds[q];
        const cumGv = schedule.months[endIdx]?.cumulativeGv ?? 0;
        const cumTev = schedule.months[endIdx]?.cumulativeTevfikat ?? 0;
        const due = Math.max(0, cumGv - cumTev - prevGeciciSum);
        geciciAmounts.push(due);
        prevGeciciSum += due;
    }

    const totalGecici = geciciAmounts.reduce((a, b) => a + b, 0);
    const yearEndResidual = Math.max(
        0,
        schedule.cumulativeGv - totalGecici - schedule.cumulativeTevfikat
    );
    const installment = yearEndResidual / 2;

    const rows: PaymentCalendarRow[] = [];

    for (let m = 0; m < 12; m++) {
        const geciciSlot = geciciEnds.indexOf(m);
        const isGecici = geciciSlot >= 0;
        const geciciNo = isGecici ? geciciSlot + 1 : null;
        const incomeDue = isGecici ? geciciAmounts[geciciSlot] : 0;
        const kdvDue = kdv[m];

        // Beyan: sonraki ay. Ödeme: KDV-only → sonraki ay; geçici dönem → bir ay daha kayar.
        const declarationMonth = m + 1;
        const paymentMonth = isGecici ? m + 2 : m + 1;

        rows.push({
            id: `m-${m}`,
            periodLabel: MONTH_NAMES_TR[m],
            islem: isGecici ? `KDV + ${geciciNo}. Geçici Vergi` : 'KDV',
            reason: isGecici
                ? GECICI_REASONS[geciciNo!]
                : kdvReason(m),
            declarationLabel: monthLabel(year, declarationMonth),
            paymentLabel: monthLabel(year, paymentMonth),
            kdvDue,
            incomeDue,
            totalDue: kdvDue + incomeDue,
            geciciNo,
            isYearEnd: false
        });
    }

    rows.push({
        id: 'year-end',
        periodLabel: `Mart ${year + 1}`,
        islem: 'Yıllık Gelir Vergisi Beyannamesi',
        reason:
            'Tüm yılın net kazancı hesaplanır. Önceden ödenen geçici vergiler mahsup edilir, kalan tutar varsa ödenir veya fazla ödeme varsa mahsup edilir.',
        declarationLabel: monthLabel(year, 12 + 2),
        paymentLabel: `${monthLabel(year, 12 + 2)} ve ${monthLabel(year, 12 + 6)} (2 taksit)`,
        kdvDue: 0,
        incomeDue: yearEndResidual,
        totalDue: yearEndResidual,
        geciciNo: null,
        isYearEnd: true,
        installmentMarch: installment,
        installmentJuly: installment
    });

    return rows;
}

/** Eldeki nakit görünümü: net ciro − tevfikat − gider (net) */
export function monthlyCashNet(
    netRevenue: number,
    tevfikat: number,
    expenseNetTotal: number
): number {
    return (
        (Number.isFinite(netRevenue) ? netRevenue : 0) -
        (Number.isFinite(tevfikat) ? tevfikat : 0) -
        (Number.isFinite(expenseNetTotal) ? expenseNetTotal : 0)
    );
}

/** Gider satırı vergi ödemesi gibi mi? (source=tax veya isimde vergi/kdv/…) */
export function isTaxLikeExpenseName(name: string, source?: string | null): boolean {
    if (source && source.trim().toLowerCase() === 'tax') return true;
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return /vergi|kdv|tevfikat|geçici|gelir\s*verg/.test(n);
}

/** Yıl sonu 2 taksit tutarı (eşit). */
export function yearEndInstallments(yearEndResidual: number): {
    march: number;
    july: number;
} {
    const half = Math.max(0, yearEndResidual) / 2;
    return { march: half, july: half };
}
