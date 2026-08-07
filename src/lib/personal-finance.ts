import { supabase } from '@/lib/supabase';
import {
    MONTH_NAMES_TR,
    SALES_VAT_RATE,
    expenseBreakdown,
    monthlyCashNet,
    salesFromGrossInclusive
} from '@/lib/income-tax';

export const PF_INCOMES = 'personal_finance_incomes';
export const PF_EXPENSES = 'personal_finance_expenses';
export const PF_DEBTS = 'personal_finance_debts';
export const COMPANY_SOURCE = 'company_cash';

export const DEBT_TYPES = [
    { value: 'credit_card', label: 'Kredi kartı' },
    { value: 'loan', label: 'Kredi' },
    { value: 'enforcement', label: 'İcra' },
    { value: 'other', label: 'Diğer' }
] as const;

export type DebtType = (typeof DEBT_TYPES)[number]['value'];

export function debtTypeLabel(type: string): string {
    return DEBT_TYPES.find((t) => t.value === type)?.label ?? 'Diğer';
}

export function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseMoney(raw: string | number | null | undefined): number {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    const t = String(raw ?? '')
        .trim()
        .replace(/\s/g, '')
        .replace(',', '.');
    if (!t) return 0;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
}

export function monthLabel(month1to12: number): string {
    return MONTH_NAMES_TR[month1to12 - 1] ?? String(month1to12);
}

export type CompanyCashResult =
    | {
          ok: true;
          amount: number;
          entryId: string;
          gross: number;
      }
    | {
          ok: false;
          reason: 'no_entry' | 'error';
          message: string;
      };

/** Aylık kazanç sayfasındaki Aylık net (nakit) ile aynı hesap */
export async function fetchCompanyCashNet(
    year: number,
    month: number
): Promise<CompanyCashResult> {
    const { data: entry, error: eErr } = await supabase
        .from('company_finance_monthly_entries')
        .select('id, gross_amount')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

    if (eErr) {
        return {
            ok: false,
            reason: 'error',
            message: eErr.message
        };
    }
    if (!entry) {
        return {
            ok: false,
            reason: 'no_entry',
            message: `${monthLabel(month)} ${year} için şirket aylık kaydı yok.`
        };
    }

    const { data: expenses, error: xErr } = await supabase
        .from('company_finance_monthly_expenses')
        .select('amount_gross, kdv_rate, include_in_cash_flow')
        .eq('monthly_entry_id', entry.id);

    if (xErr) {
        return { ok: false, reason: 'error', message: xErr.message };
    }

    const gross = parseMoney(entry.gross_amount);
    const sales = salesFromGrossInclusive(gross, SALES_VAT_RATE);
    let expenseCashNet = 0;
    for (const ex of expenses ?? []) {
        if (ex.include_in_cash_flow === false) continue;
        const bd = expenseBreakdown(parseMoney(ex.amount_gross), parseMoney(ex.kdv_rate));
        expenseCashNet += bd.amountNet;
    }

    return {
        ok: true,
        amount: monthlyCashNet(sales.netRevenue, sales.tevfikat, expenseCashNet),
        entryId: String(entry.id),
        gross
    };
}

export type PersonalIncomeRow = {
    id: string;
    year: number;
    month: number;
    name: string;
    amount: number;
    source: string;
    company_monthly_entry_id: string | null;
    due_date: string | null;
    is_received: boolean;
    repeats_monthly: boolean;
    note: string;
    sort_order: number;
};

export type PersonalExpenseRow = {
    id: string;
    year: number;
    month: number;
    name: string;
    amount: number;
    paid_amount: number;
    due_date: string | null;
    is_paid: boolean;
    repeats_monthly: boolean;
    note: string;
    sort_order: number;
};

export function expenseRemaining(amount: number, paidAmount: number): number {
    return Math.max(0, parseMoney(amount) - parseMoney(paidAmount));
}

export function expenseIsFullyPaid(amount: number, paidAmount: number): boolean {
    return expenseRemaining(amount, paidAmount) <= 0.005 && parseMoney(amount) > 0;
}

export function mapIncome(r: Record<string, unknown>): PersonalIncomeRow {
    return {
        id: String(r.id),
        year: Number(r.year),
        month: Number(r.month),
        name: String(r.name ?? ''),
        amount: parseMoney(r.amount as string | number),
        source: String(r.source ?? ''),
        company_monthly_entry_id: r.company_monthly_entry_id
            ? String(r.company_monthly_entry_id)
            : null,
        due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
        is_received: r.is_received !== false,
        repeats_monthly: Boolean(r.repeats_monthly),
        note: String(r.note ?? ''),
        sort_order: Number(r.sort_order) || 0
    };
}

export function mapExpense(r: Record<string, unknown>): PersonalExpenseRow {
    const amount = parseMoney(r.amount as string | number);
    let paid_amount = parseMoney(r.paid_amount as string | number);
    const is_paid = Boolean(r.is_paid);
    // Eski kayıt: ödendi ama paid_amount yok → tam ödenmiş
    if (is_paid && paid_amount <= 0 && amount > 0 && r.paid_amount == null) {
        paid_amount = amount;
    }
    return {
        id: String(r.id),
        year: Number(r.year),
        month: Number(r.month),
        name: String(r.name ?? ''),
        amount,
        paid_amount,
        due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
        is_paid: is_paid || expenseIsFullyPaid(amount, paid_amount),
        repeats_monthly: Boolean(r.repeats_monthly),
        note: String(r.note ?? ''),
        sort_order: Number(r.sort_order) || 0
    };
}

export type PersonalDebtRow = {
    id: string;
    name: string;
    debt_type: DebtType | string;
    creditor: string;
    amount: number;
    paid_amount: number;
    due_date: string | null;
    is_paid: boolean;
    note: string;
    sort_order: number;
};

export function mapDebt(r: Record<string, unknown>): PersonalDebtRow {
    const amount = parseMoney(r.amount as string | number);
    let paid_amount = parseMoney(r.paid_amount as string | number);
    const is_paid = Boolean(r.is_paid);
    if (is_paid && paid_amount <= 0 && amount > 0 && r.paid_amount == null) {
        paid_amount = amount;
    }
    const rawType = String(r.debt_type ?? 'other');
    const debt_type = DEBT_TYPES.some((t) => t.value === rawType) ? rawType : 'other';
    return {
        id: String(r.id),
        name: String(r.name ?? ''),
        debt_type,
        creditor: String(r.creditor ?? ''),
        amount,
        paid_amount,
        due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
        is_paid: is_paid || expenseIsFullyPaid(amount, paid_amount),
        note: String(r.note ?? ''),
        sort_order: Number(r.sort_order) || 0
    };
}
