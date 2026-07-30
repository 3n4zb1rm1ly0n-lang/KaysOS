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
