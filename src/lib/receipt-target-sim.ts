/** Fiş / gider hedefi simülasyonu — istenen KDV veya matrah için toplanacak fiş tutarı */

import {
    type TaxBracket,
    DEFAULT_2026_BRACKETS,
    progressiveIncomeTax,
    salesFromGrossInclusive,
    SALES_VAT_RATE
} from '@/lib/income-tax';

export const EXPENSE_VAT_RATES = [1, 10, 20] as const;
export type ExpenseVatRate = (typeof EXPENSE_VAT_RATES)[number];

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** İndirilecek KDV → KDV dahil fiş tutarı */
export function receiptGrossFromDeductibleVat(
    deductibleVat: number,
    expenseVatRate: number
): number {
    const r = Number(expenseVatRate);
    if (!Number.isFinite(deductibleVat) || deductibleVat <= 0) return 0;
    if (!Number.isFinite(r) || r <= 0) return 0;
    return round2((deductibleVat * (100 + r)) / r);
}

/** Net gider → KDV dahil fiş */
export function receiptGrossFromNetExpense(
    expenseNet: number,
    expenseVatRate: number
): number {
    const r = Number(expenseVatRate);
    if (!Number.isFinite(expenseNet) || expenseNet <= 0) return 0;
    if (!Number.isFinite(r) || r < 0) return round2(expenseNet);
    return round2(expenseNet * (1 + r / 100));
}

export function deductibleVatFromReceiptGross(
    receiptGross: number,
    expenseVatRate: number
): number {
    const r = Number(expenseVatRate);
    if (!Number.isFinite(receiptGross) || receiptGross <= 0 || r <= 0) return 0;
    return round2(receiptGross - receiptGross / (1 + r / 100));
}

export function netFromReceiptGross(receiptGross: number, expenseVatRate: number): number {
    const r = Number(expenseVatRate);
    if (!Number.isFinite(receiptGross) || receiptGross <= 0) return 0;
    if (r <= 0) return round2(receiptGross);
    return round2(receiptGross / (1 + r / 100));
}

/**
 * Hedef GV tutarına karşılık gelen matrah (yaklaşık, dilimli ters).
 * Tek dönem / aylık planlama için kaba hedef — yıllık kümülatif GV değildir.
 */
export function taxableBaseForTargetTax(
    targetTax: number,
    brackets: TaxBracket[] = DEFAULT_2026_BRACKETS
): number {
    const t = Math.max(0, Number(targetTax) || 0);
    if (t <= 0) return 0;

    let lo = 0;
    let hi = 50_000_000;
    for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        const { totalTax } = progressiveIncomeTax(mid, brackets);
        if (totalTax < t) lo = mid;
        else hi = mid;
    }
    return round2(hi);
}

export type ReceiptSimInput = {
    /** KDV dahil brüt ciro */
    grossInclusive: number;
    salesVatRate?: number;
    expenseVatRate: number;
    /** Zaten toplanmış / kaydedilmiş indirilecek KDV */
    existingDeductibleVat?: number;
    /** Zaten kaydedilmiş gider net */
    existingExpenseNet?: number;
    /** Zaten ödenmiş KDV (mahsup) */
    existingKdvPaid?: number;
    /** Ödemek istediğin KDV bakiyesi (satış KDV − indirilecek − ödenen). null = yok say */
    targetPayableKdv?: number | null;
    /** İstediğin matrah (net ciro − gider net). null = yok say */
    targetTaxableBase?: number | null;
    /** İstediğin GV tutarı → matraha çevrilir. null = yok say */
    targetIncomeTax?: number | null;
    brackets?: TaxBracket[];
};

export type ReceiptSimResult = {
    netRevenue: number;
    salesVat: number;
    tevfikat: number;
    expenseVatRate: number;
    existingDeductibleVat: number;
    existingExpenseNet: number;
    existingKdvPaid: number;
    /** KDV hedefi için gereken ek indirilecek KDV */
    neededDeductibleVat: number | null;
    /** Matrah/GV hedefi için gereken ek net gider */
    neededExpenseNet: number | null;
    /** KDV yolundan gereken ek fiş (KDV dahil) */
    receiptsForKdv: number;
    /** Matrah yolundan gereken ek fiş (KDV dahil) */
    receiptsForBase: number;
    /** İkisini de karşılamak için (max) */
    receiptsNeeded: number;
    /** Bu fişle gelecek indirilecek KDV */
    deductibleVatFromReceipts: number;
    /** Bu fişle gelecek net gider */
    expenseNetFromReceipts: number;
    /** Simülasyon sonrası ödenecek KDV */
    projectedPayableKdv: number;
    /** Simülasyon sonrası matrah */
    projectedTaxableBase: number;
    projectedIncomeTax: number;
    warnings: string[];
};

export function simulateReceiptTarget(input: ReceiptSimInput): ReceiptSimResult {
    const salesVatRate = input.salesVatRate ?? SALES_VAT_RATE;
    const expenseVatRate = Number(input.expenseVatRate) || 0;
    const gross = Math.max(0, Number(input.grossInclusive) || 0);
    const sales = salesFromGrossInclusive(gross, salesVatRate);
    const existingDeductibleVat = Math.max(0, Number(input.existingDeductibleVat) || 0);
    const existingExpenseNet = Math.max(0, Number(input.existingExpenseNet) || 0);
    const existingKdvPaid = Math.max(0, Number(input.existingKdvPaid) || 0);
    const brackets = input.brackets ?? DEFAULT_2026_BRACKETS;
    const warnings: string[] = [];

    let neededDeductibleVat: number | null = null;
    let receiptsForKdv = 0;
    if (input.targetPayableKdv != null && Number.isFinite(input.targetPayableKdv)) {
        const target = Math.max(0, Number(input.targetPayableKdv));
        // salesVat - deductible - paid = target  →  deductible = salesVat - paid - target
        const totalDeductibleNeeded = Math.max(
            0,
            sales.salesVat - existingKdvPaid - target
        );
        neededDeductibleVat = Math.max(0, totalDeductibleNeeded - existingDeductibleVat);
        if (expenseVatRate <= 0 && neededDeductibleVat > 0) {
            warnings.push('KDV’siz fiş indirilecek KDV üretmez; oran seç.');
            receiptsForKdv = 0;
        } else {
            receiptsForKdv = receiptGrossFromDeductibleVat(
                neededDeductibleVat,
                expenseVatRate
            );
        }
        if (target > sales.salesVat - existingKdvPaid) {
            warnings.push(
                'Hedef ödenecek KDV, satış KDV − ödenen’den büyük; fazla ödeme / iade senaryosu.'
            );
        }
    }

    let targetBase: number | null = null;
    if (input.targetTaxableBase != null && Number.isFinite(input.targetTaxableBase)) {
        targetBase = Math.max(0, Number(input.targetTaxableBase));
    } else if (input.targetIncomeTax != null && Number.isFinite(input.targetIncomeTax)) {
        targetBase = taxableBaseForTargetTax(Number(input.targetIncomeTax), brackets);
    }

    let neededExpenseNet: number | null = null;
    let receiptsForBase = 0;
    if (targetBase != null) {
        // base = netRevenue - (existingExpenseNet + newNet)  → newNet = netRevenue - existing - base
        neededExpenseNet = Math.max(
            0,
            sales.netRevenue - existingExpenseNet - targetBase
        );
        receiptsForBase = receiptGrossFromNetExpense(neededExpenseNet, expenseVatRate);
        if (targetBase > sales.netRevenue - existingExpenseNet) {
            warnings.push(
                'Hedef matrah, mevcut net ciro − mevcut giderden büyük; ek fiş gerekmez (matrah düşmez).'
            );
        }
    }

    const receiptsNeeded = round2(Math.max(receiptsForKdv, receiptsForBase));
    const deductibleVatFromReceipts = deductibleVatFromReceiptGross(
        receiptsNeeded,
        expenseVatRate
    );
    const expenseNetFromReceipts = netFromReceiptGross(receiptsNeeded, expenseVatRate);

    const totalDeductible = existingDeductibleVat + deductibleVatFromReceipts;
    const projectedPayableKdv = round2(
        sales.salesVat - totalDeductible - existingKdvPaid
    );
    const projectedTaxableBase = round2(
        Math.max(0, sales.netRevenue - existingExpenseNet - expenseNetFromReceipts)
    );
    const projectedIncomeTax = progressiveIncomeTax(
        projectedTaxableBase,
        brackets
    ).totalTax;

    return {
        netRevenue: round2(sales.netRevenue),
        salesVat: round2(sales.salesVat),
        tevfikat: round2(sales.tevfikat),
        expenseVatRate,
        existingDeductibleVat,
        existingExpenseNet,
        existingKdvPaid,
        neededDeductibleVat,
        neededExpenseNet,
        receiptsForKdv: round2(receiptsForKdv),
        receiptsForBase: round2(receiptsForBase),
        receiptsNeeded,
        deductibleVatFromReceipts,
        expenseNetFromReceipts,
        projectedPayableKdv,
        projectedTaxableBase,
        projectedIncomeTax: round2(projectedIncomeTax),
        warnings
    };
}
