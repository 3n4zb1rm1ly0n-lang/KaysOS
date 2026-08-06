/** Vergi borcu taksitlendirme — borç + aylık satırlar + vadesi geçmiş toplu borçlar */

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

export const DEFAULT_DUE_DAY = 30;
/** İlk taksit ayı (Eylül) */
export const DEFAULT_START_MONTH = 9;

export function monthLabel(month: number): string {
    return MONTH_LABELS[month - 1] ?? String(month);
}

export function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export type TaxDebt = {
    id: string;
    name: string;
    total_amount: number;
    installment_count: number;
    start_year: number;
    start_month: number;
    due_day: number;
    sort_order: number;
    note: string;
};

export type TaxInstallmentRow = {
    id?: string;
    debt_id: string;
    seq: number;
    year: number;
    month: number;
    amount: number;
    is_paid: boolean;
    paid_at: string | null;
    note: string;
};

/** Planı olmayan, vadesi geçmiş tek seferlik borçlar */
export type TaxLumpDebt = {
    id: string;
    name: string;
    amount: number;
    is_paid: boolean;
    paid_at: string | null;
    note: string;
    sort_order: number;
};

export type SeedDebtSpec = {
    name: string;
    installment_count: number;
    sort_order: number;
    total_amount?: number;
    start_year?: number;
    start_month?: number;
    due_day?: number;
    note?: string;
};

export function defaultStartYear(now = new Date()): number {
    // Eylül henüz gelmediyse bu yıl; Eylül sonrası da bu yılın planı (Eylül başlangıç)
    return now.getFullYear();
}

/** 3×12 + 1×18 — ilk taksit Eylül, vade günü 30 */
export function defaultSeedDebts(now = new Date()): SeedDebtSpec[] {
    const y = defaultStartYear(now);
    return [
        {
            name: 'Borç 1',
            installment_count: 12,
            sort_order: 1,
            total_amount: 0,
            start_year: y,
            start_month: DEFAULT_START_MONTH,
            due_day: DEFAULT_DUE_DAY
        },
        {
            name: 'Borç 2',
            installment_count: 12,
            sort_order: 2,
            total_amount: 0,
            start_year: y,
            start_month: DEFAULT_START_MONTH,
            due_day: DEFAULT_DUE_DAY
        },
        {
            name: 'Borç 3',
            installment_count: 12,
            sort_order: 3,
            total_amount: 0,
            start_year: y,
            start_month: DEFAULT_START_MONTH,
            due_day: DEFAULT_DUE_DAY
        },
        {
            name: 'Borç 4',
            installment_count: 18,
            sort_order: 4,
            total_amount: 0,
            start_year: y,
            start_month: DEFAULT_START_MONTH,
            due_day: DEFAULT_DUE_DAY
        }
    ];
}

export const DEFAULT_LUMP_DEBT_NAMES = [
    'Yıllık gelir vergisi',
    'Gelir geçici vergi',
    'Gerçek usulde vergi',
    'Motorlu taşıtlar vergisi'
] as const;

export function defaultLumpDebtSeeds(): { name: string; sort_order: number; amount: number }[] {
    return DEFAULT_LUMP_DEBT_NAMES.map((name, i) => ({
        name,
        sort_order: i + 1,
        amount: 0
    }));
}

/** Eşit taksit; son satıra kuruş farkı */
export function splitEqual(total: number, count: number): number[] {
    if (count < 1) return [];
    const t = Math.max(0, round2(total));
    if (count === 1) return [t];
    const base = Math.floor((t * 100) / count) / 100;
    const amounts = Array.from({ length: count }, () => base);
    amounts[count - 1] = round2(t - base * (count - 1));
    return amounts;
}

export function addMonths(
    year: number,
    month: number,
    offset: number
): { year: number; month: number } {
    const idx = year * 12 + (month - 1) + offset;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Ayın son gününü aşmayan vade günü (Şubat vb.) */
export function clampedDueDay(year: number, month: number, dueDay: number): number {
    const last = new Date(year, month, 0).getDate();
    return Math.min(Math.max(1, dueDay || DEFAULT_DUE_DAY), last);
}

export function dueDateISO(year: number, month: number, dueDay = DEFAULT_DUE_DAY): string {
    const d = clampedDueDay(year, month, dueDay);
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatDueLabel(year: number, month: number, dueDay = DEFAULT_DUE_DAY): string {
    const d = clampedDueDay(year, month, dueDay);
    return `${d} ${monthLabel(month)} ${year}`;
}

function startOfToday(now: Date): Date {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function installmentDueDate(
    year: number,
    month: number,
    dueDay = DEFAULT_DUE_DAY
): Date {
    return new Date(year, month - 1, clampedDueDay(year, month, dueDay));
}

export function isInstallmentOverdue(
    year: number,
    month: number,
    dueDay: number,
    isPaid: boolean,
    now = new Date()
): boolean {
    if (isPaid) return false;
    return startOfToday(now) > installmentDueDate(year, month, dueDay);
}

export function isInstallmentDueThisMonth(
    year: number,
    month: number,
    isPaid: boolean,
    now = new Date()
): boolean {
    if (isPaid) return false;
    return year === now.getFullYear() && month === now.getMonth() + 1;
}

export function buildInstallmentRows(
    debtId: string,
    startYear: number,
    startMonth: number,
    totalAmount: number,
    installmentCount: number,
    startSeq = 1
): Omit<TaxInstallmentRow, 'id'>[] {
    const amounts = splitEqual(totalAmount, installmentCount);
    return amounts.map((amount, i) => {
        const ym = addMonths(startYear, startMonth, i);
        return {
            debt_id: debtId,
            seq: startSeq + i,
            year: ym.year,
            month: ym.month,
            amount,
            is_paid: false,
            paid_at: null,
            note: ''
        };
    });
}

/**
 * Ödenenleri koru; kalan tutarı kalan taksit sayısına eşit böl.
 * start: son ödenen aydan sonraki ay (yoksa borç başlangıcı).
 */
export function rebuildUnpaidSchedule(
    debt: TaxDebt,
    existing: TaxInstallmentRow[]
): { keep: TaxInstallmentRow[]; create: Omit<TaxInstallmentRow, 'id'>[] } {
    const forDebt = existing
        .filter((r) => r.debt_id === debt.id)
        .sort((a, b) => a.seq - b.seq);
    const paid = forDebt.filter((r) => r.is_paid);
    const paidSum = round2(paid.reduce((s, r) => s + Number(r.amount), 0));
    const remainingCount = Math.max(0, debt.installment_count - paid.length);
    const remainingAmount = Math.max(0, round2(Number(debt.total_amount) - paidSum));

    let startYear = debt.start_year;
    let startMonth = debt.start_month;
    let startSeq = 1;
    if (paid.length > 0) {
        const last = paid.reduce((a, b) =>
            a.year * 12 + a.month >= b.year * 12 + b.month ? a : b
        );
        const next = addMonths(last.year, last.month, 1);
        startYear = next.year;
        startMonth = next.month;
        startSeq = Math.max(...paid.map((p) => p.seq)) + 1;
    }

    const create =
        remainingCount > 0
            ? buildInstallmentRows(
                  debt.id,
                  startYear,
                  startMonth,
                  remainingAmount,
                  remainingCount,
                  startSeq
              )
            : [];

    return { keep: paid, create };
}

export type DebtSummary = {
    debtId: string;
    total: number;
    paidAmount: number;
    unpaidAmount: number;
    paidCount: number;
    unpaidCount: number;
    installmentCount: number;
    progress: number;
};

export type TaxInstallmentSummary = {
    total: number;
    paidAmount: number;
    unpaidAmount: number;
    paidCount: number;
    unpaidCount: number;
    progress: number;
    dueThisMonth: { count: number; amount: number };
    overdue: { count: number; amount: number };
    byDebt: DebtSummary[];
};

export function summarizeDebt(debt: TaxDebt, rows: TaxInstallmentRow[]): DebtSummary {
    const list = rows.filter((r) => r.debt_id === debt.id);
    const paid = list.filter((r) => r.is_paid);
    const unpaid = list.filter((r) => !r.is_paid);
    const paidAmount = round2(paid.reduce((s, r) => s + Number(r.amount), 0));
    const unpaidAmount = round2(unpaid.reduce((s, r) => s + Number(r.amount), 0));
    const total = round2(paidAmount + unpaidAmount) || round2(Number(debt.total_amount));
    return {
        debtId: debt.id,
        total,
        paidAmount,
        unpaidAmount,
        paidCount: paid.length,
        unpaidCount: unpaid.length,
        installmentCount: debt.installment_count,
        progress:
            total > 0 ? paidAmount / total : paid.length / Math.max(1, debt.installment_count)
    };
}

export function summarizeTaxInstallments(
    debts: TaxDebt[],
    rows: TaxInstallmentRow[],
    now = new Date()
): TaxInstallmentSummary {
    const byDebt = debts.map((d) => summarizeDebt(d, rows));
    const paidAmount = round2(byDebt.reduce((s, d) => s + d.paidAmount, 0));
    const unpaidAmount = round2(byDebt.reduce((s, d) => s + d.unpaidAmount, 0));
    const total = round2(paidAmount + unpaidAmount);
    const paidCount = byDebt.reduce((s, d) => s + d.paidCount, 0);
    const unpaidCount = byDebt.reduce((s, d) => s + d.unpaidCount, 0);

    const dueDayByDebt = new Map(debts.map((d) => [d.id, d.due_day ?? DEFAULT_DUE_DAY]));

    let dueCount = 0;
    let dueAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    for (const r of rows) {
        if (r.is_paid) continue;
        const amt = Number(r.amount);
        const dueDay = dueDayByDebt.get(r.debt_id) ?? DEFAULT_DUE_DAY;
        if (isInstallmentDueThisMonth(r.year, r.month, false, now)) {
            dueCount += 1;
            dueAmount += amt;
        } else if (isInstallmentOverdue(r.year, r.month, dueDay, false, now)) {
            overdueCount += 1;
            overdueAmount += amt;
        }
    }

    return {
        total,
        paidAmount,
        unpaidAmount,
        paidCount,
        unpaidCount,
        progress: total > 0 ? paidAmount / total : 0,
        dueThisMonth: { count: dueCount, amount: round2(dueAmount) },
        overdue: { count: overdueCount, amount: round2(overdueAmount) },
        byDebt
    };
}

export function summarizeLumpDebts(items: TaxLumpDebt[]): {
    total: number;
    paidAmount: number;
    unpaidAmount: number;
    unpaidCount: number;
} {
    const paidAmount = round2(
        items.filter((i) => i.is_paid).reduce((s, i) => s + Number(i.amount), 0)
    );
    const unpaid = items.filter((i) => !i.is_paid);
    const unpaidAmount = round2(unpaid.reduce((s, i) => s + Number(i.amount), 0));
    return {
        total: round2(paidAmount + unpaidAmount),
        paidAmount,
        unpaidAmount,
        unpaidCount: unpaid.length
    };
}

export function ymKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
}
