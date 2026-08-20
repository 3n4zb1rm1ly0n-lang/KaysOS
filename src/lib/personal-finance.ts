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
export const PF_BUDGET_LINES = 'personal_finance_budget_lines';
export const PF_BUDGET_MONTHS = 'personal_finance_budget_months';
export const PF_SAVINGS_POTS = 'personal_finance_savings_pots';
export const PF_SAVINGS_LEDGER = 'personal_finance_savings_ledger';
export const PF_ACTIVITY_LOG = 'personal_finance_activity_log';
export const COMPANY_SOURCE = 'company_cash';

export const PF_ACTIVITY_ACTIONS = [
    { value: 'company_bind', label: 'Şirket bağla' },
    { value: 'company_refresh', label: 'Şirket yenile' },
    { value: 'withhold_change', label: 'Bloke / haciz' },
    { value: 'budget_send', label: 'Bütçe gönderim' },
    { value: 'budget_param', label: 'Bütçe parametre' },
    { value: 'budget_close', label: 'Bütçe ay kapat/aç' },
    { value: 'savings_manual', label: 'Birikim manuel' },
    { value: 'expense_pay', label: 'Gider ödeme' },
    { value: 'debt_pay', label: 'Borç ödeme' }
] as const;

export type PfActivityAction = (typeof PF_ACTIVITY_ACTIONS)[number]['value'];

export type PfEntityKind =
    | 'company'
    | 'income'
    | 'budget'
    | 'budget_line'
    | 'savings'
    | 'expense'
    | 'debt'
    | 'manual'
    | '';

export type PfActivityInput = {
    year: number;
    month: number;
    action: PfActivityAction;
    summary: string;
    amount?: number;
    from_kind?: PfEntityKind;
    from_id?: string | null;
    from_label?: string;
    to_kind?: PfEntityKind;
    to_id?: string | null;
    to_label?: string;
    meta?: Record<string, unknown>;
};

export type PfActivityRow = {
    id: string;
    created_at: string;
    year: number;
    month: number;
    action: PfActivityAction | string;
    summary: string;
    amount: number;
    from_kind: string;
    from_id: string | null;
    from_label: string;
    to_kind: string;
    to_id: string | null;
    to_label: string;
    meta: Record<string, unknown>;
};

export function pfActivityActionLabel(action: string): string {
    return PF_ACTIVITY_ACTIONS.find((a) => a.value === action)?.label ?? action;
}

export function mapPfActivity(r: Record<string, unknown>): PfActivityRow {
    const metaRaw = r.meta;
    let meta: Record<string, unknown> = {};
    if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
        meta = metaRaw as Record<string, unknown>;
    }
    return {
        id: String(r.id),
        created_at: String(r.created_at ?? ''),
        year: Number(r.year) || 0,
        month: Number(r.month) || 0,
        action: String(r.action ?? ''),
        summary: String(r.summary ?? ''),
        amount: parseMoney(r.amount as string | number),
        from_kind: String(r.from_kind ?? ''),
        from_id: r.from_id ? String(r.from_id) : null,
        from_label: String(r.from_label ?? ''),
        to_kind: String(r.to_kind ?? ''),
        to_id: r.to_id ? String(r.to_id) : null,
        to_label: String(r.to_label ?? ''),
        meta
    };
}

/** Fire-and-forget; ana işlemi bozmaz */
export async function logPfActivity(input: PfActivityInput): Promise<void> {
    try {
        const { error } = await supabase.from(PF_ACTIVITY_LOG).insert([
            {
                year: input.year,
                month: input.month,
                action: input.action,
                summary: input.summary.trim() || input.action,
                amount: parseMoney(input.amount),
                from_kind: input.from_kind ?? '',
                from_id: input.from_id || null,
                from_label: input.from_label ?? '',
                to_kind: input.to_kind ?? '',
                to_id: input.to_id || null,
                to_label: input.to_label ?? '',
                meta: input.meta ?? {}
            }
        ]);
        if (error) {
            console.error('[pf activity log]', error.message);
        }
    } catch (e) {
        console.error('[pf activity log]', e);
    }
}

export const DEBT_TYPES = [
    { value: 'credit_card', label: 'Kredi kartı' },
    { value: 'loan', label: 'Kredi' },
    { value: 'enforcement', label: 'İcra' },
    { value: 'other', label: 'Diğer' }
] as const;

export const WITHHELD_KINDS = [
    { value: '', label: 'Yok' },
    { value: 'block', label: 'Bloke' },
    { value: 'seizure', label: 'Haciz' },
    { value: 'other', label: 'Diğer kesinti' }
] as const;

export type WithheldKind = (typeof WITHHELD_KINDS)[number]['value'];

export const BUDGET_LINE_TYPES = [
    { value: 'savings', label: 'Birikim' },
    { value: 'expense', label: 'Gider' },
    { value: 'debt', label: 'Borç' },
    { value: 'free', label: 'Serbest' }
] as const;

export type BudgetLineType = (typeof BUDGET_LINE_TYPES)[number]['value'];

export function withheldKindLabel(kind: string): string {
    return WITHHELD_KINDS.find((k) => k.value === kind)?.label ?? 'Kesinti';
}

export function budgetLineTypeLabel(type: string): string {
    return BUDGET_LINE_TYPES.find((t) => t.value === type)?.label ?? 'Serbest';
}

/** Brüt − bloke/haciz (negatife düşmez) */
export function incomeNetCash(amount: number, withheldAmount: number): number {
    return Math.max(0, parseMoney(amount) - parseMoney(withheldAmount));
}

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
    withheld_amount: number;
    withheld_kind: WithheldKind | string;
    withheld_note: string;
};

export type BudgetLineRow = {
    id: string;
    year: number;
    month: number;
    name: string;
    percent: number;
    line_type: BudgetLineType | string;
    linked_savings_id: string | null;
    linked_expense_id: string | null;
    linked_debt_id: string | null;
    sent_amount: number;
    note: string;
    sort_order: number;
};

export type BudgetMonthRow = {
    id: string;
    year: number;
    month: number;
    base_mode: 'net_income' | 'manual' | string;
    manual_base: number;
    note: string;
    is_closed: boolean;
};

export type SavingsPotRow = {
    id: string;
    name: string;
    balance: number;
    goal_amount: number;
    note: string;
    sort_order: number;
    is_archived: boolean;
};

export type SavingsLedgerRow = {
    id: string;
    pot_id: string;
    amount: number;
    year: number | null;
    month: number | null;
    budget_line_id: string | null;
    note: string;
    created_at: string;
};

export const BUDGET_TEMPLATES: {
    id: string;
    label: string;
    hint: string;
    lines: { name: string; percent: number; line_type: BudgetLineType }[];
}[] = [
    {
        id: '505020',
        label: '50 / 30 / 20',
        hint: 'Birikim %50 · ihtiyaç %30 · serbest %20',
        lines: [
            { name: 'Birikim', percent: 50, line_type: 'savings' },
            { name: 'İhtiyaç / sabit', percent: 30, line_type: 'expense' },
            { name: 'Serbest', percent: 20, line_type: 'free' }
        ]
    },
    {
        id: 'debt-focus',
        label: 'Borç odaklı',
        hint: 'Borç %50 · birikim %20 · serbest %30',
        lines: [
            { name: 'Borç ödeme', percent: 50, line_type: 'debt' },
            { name: 'Birikim', percent: 20, line_type: 'savings' },
            { name: 'Serbest', percent: 30, line_type: 'free' }
        ]
    },
    {
        id: 'save-hard',
        label: 'Agresif birikim',
        hint: 'Birikim %60 · borç %20 · serbest %20',
        lines: [
            { name: 'Birikim', percent: 60, line_type: 'savings' },
            { name: 'Borç', percent: 20, line_type: 'debt' },
            { name: 'Serbest', percent: 20, line_type: 'free' }
        ]
    }
];

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
    const rawKind = String(r.withheld_kind ?? '');
    const withheld_kind = WITHHELD_KINDS.some((k) => k.value === rawKind) ? rawKind : '';
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
        sort_order: Number(r.sort_order) || 0,
        withheld_amount: parseMoney(r.withheld_amount as string | number),
        withheld_kind,
        withheld_note: String(r.withheld_note ?? '')
    };
}

export function mapBudgetLine(r: Record<string, unknown>): BudgetLineRow {
    const rawType = String(r.line_type ?? 'free');
    const line_type = BUDGET_LINE_TYPES.some((t) => t.value === rawType) ? rawType : 'free';
    return {
        id: String(r.id),
        year: Number(r.year),
        month: Number(r.month),
        name: String(r.name ?? ''),
        percent: parseMoney(r.percent as string | number),
        line_type,
        linked_savings_id: r.linked_savings_id ? String(r.linked_savings_id) : null,
        linked_expense_id: r.linked_expense_id ? String(r.linked_expense_id) : null,
        linked_debt_id: r.linked_debt_id ? String(r.linked_debt_id) : null,
        sent_amount: parseMoney(r.sent_amount as string | number),
        note: String(r.note ?? ''),
        sort_order: Number(r.sort_order) || 0
    };
}

export function mapBudgetMonth(r: Record<string, unknown>): BudgetMonthRow {
    const mode = String(r.base_mode ?? 'net_income');
    return {
        id: String(r.id),
        year: Number(r.year),
        month: Number(r.month),
        base_mode: mode === 'manual' ? 'manual' : 'net_income',
        manual_base: parseMoney(r.manual_base as string | number),
        note: String(r.note ?? ''),
        is_closed: Boolean(r.is_closed)
    };
}

export function mapSavingsPot(r: Record<string, unknown>): SavingsPotRow {
    return {
        id: String(r.id),
        name: String(r.name ?? ''),
        balance: parseMoney(r.balance as string | number),
        goal_amount: parseMoney(r.goal_amount as string | number),
        note: String(r.note ?? ''),
        sort_order: Number(r.sort_order) || 0,
        is_archived: Boolean(r.is_archived)
    };
}

export function mapSavingsLedger(r: Record<string, unknown>): SavingsLedgerRow {
    return {
        id: String(r.id),
        pot_id: String(r.pot_id),
        amount: parseMoney(r.amount as string | number),
        year: r.year != null ? Number(r.year) : null,
        month: r.month != null ? Number(r.month) : null,
        budget_line_id: r.budget_line_id ? String(r.budget_line_id) : null,
        note: String(r.note ?? ''),
        created_at: String(r.created_at ?? '')
    };
}

export function plannedAmount(base: number, percent: number): number {
    return Math.round(((base * percent) / 100) * 100) / 100;
}

export function lineRemaining(base: number, percent: number, sent: number): number {
    return Math.max(0, plannedAmount(base, percent) - parseMoney(sent));
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
