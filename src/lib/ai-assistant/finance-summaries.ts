import type { SupabaseClient } from '@supabase/supabase-js';
import {
    SALES_VAT_RATE,
    expenseBreakdown,
    monthlyCashNet,
    monthlyTaxableBase,
    salesFromGrossInclusive
} from '@/lib/income-tax';

/** personal-finance.ts tarayıcı supabase import eder — sunucuda kopya sabitler */
const COMPANY_SOURCE = 'company_cash';
const DEBT_TYPES = [
    { value: 'credit_card', label: 'Kredi kartı' },
    { value: 'loan', label: 'Kredi' },
    { value: 'enforcement', label: 'İcra' },
    { value: 'other', label: 'Diğer' }
] as const;

function debtTypeLabel(type: string): string {
    return DEBT_TYPES.find((t) => t.value === type)?.label ?? 'Diğer';
}

function expenseRemaining(amount: number, paidAmount: number): number {
    return Math.max(0, money(amount) - money(paidAmount));
}

function expenseIsFullyPaid(amount: number, paidAmount: number): boolean {
    return expenseRemaining(amount, paidAmount) <= 0.005 && money(amount) > 0;
}

function money(n: unknown): number {
    const v = typeof n === 'number' ? n : parseFloat(String(n ?? '').replace(',', '.'));
    return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function resolveYm(yearIn?: number, monthIn?: number): { year: number; month: number } {
    const now = new Date();
    const year = yearIn && yearIn >= 2000 ? Math.floor(yearIn) : now.getFullYear();
    const month =
        monthIn && monthIn >= 1 && monthIn <= 12 ? Math.floor(monthIn) : now.getMonth() + 1;
    return { year, month };
}

/**
 * Aylık kazanç sayfası ile aynı hesap (gross KDV dahil).
 * Bağkur / vergi taksit otomatik dahil değil.
 */
export async function companyMonthlySummary(
    db: SupabaseClient,
    yearIn?: number,
    monthIn?: number
): Promise<string> {
    const { year, month } = resolveYm(yearIn, monthIn);

    const { data: entry, error } = await db
        .from('company_finance_monthly_entries')
        .select('id, year, month, gross_amount, kdv_paid, kdv_deductible, note')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

    if (error) {
        return JSON.stringify({ error: error.message, table: 'company_finance_monthly_entries' });
    }
    if (!entry) {
        return JSON.stringify({
            year,
            month,
            page: '/app/dashboard/company-finance/monthly',
            found: false,
            message: 'Bu ay için şirket aylık kaydı yok. Boş ay = 0.',
            rules: companyRules()
        });
    }

    const { data: expenses, error: xErr } = await db
        .from('company_finance_monthly_expenses')
        .select(
            'id, name, amount_gross, kdv_rate, include_in_deductible_kdv, include_in_cash_flow, source, note, sort_order'
        )
        .eq('monthly_entry_id', entry.id)
        .order('sort_order');

    if (xErr) {
        return JSON.stringify({ error: xErr.message, table: 'company_finance_monthly_expenses' });
    }

    const gross = money(entry.gross_amount);
    const kdvPaid = money(entry.kdv_paid);
    const kdvDeductibleManual = money(entry.kdv_deductible);
    const sales = salesFromGrossInclusive(gross, SALES_VAT_RATE);

    let expenseNetTotal = 0;
    let expenseCashNet = 0;
    let expenseKdvIncluded = 0;
    const expenseRows = (expenses || []).map((ex) => {
        const bd = expenseBreakdown(money(ex.amount_gross), money(ex.kdv_rate));
        const inCash = ex.include_in_cash_flow !== false;
        const inDeduct = ex.include_in_deductible_kdv !== false;
        expenseNetTotal += bd.amountNet;
        if (inCash) expenseCashNet += bd.amountNet;
        if (inDeduct) expenseKdvIncluded += bd.kdvAmount;
        return {
            id: ex.id,
            name: ex.name,
            amount_gross_kdv_dahil: bd.amountGross,
            kdv_rate: bd.kdvRate,
            amount_net: round2(bd.amountNet),
            kdv_amount: round2(bd.kdvAmount),
            include_in_cash_flow: inCash,
            include_in_deductible_kdv: inDeduct,
            source: ex.source || ''
        };
    });

    const totalDeductible = kdvDeductibleManual + expenseKdvIncluded;
    const kdvBalance = sales.salesVat - totalDeductible - kdvPaid;
    const matrah = monthlyTaxableBase(sales.netRevenue, expenseNetTotal);
    const cashNet = monthlyCashNet(sales.netRevenue, sales.tevfikat, expenseCashNet);
    const odenecekTutar = gross - sales.tevfikat - expenseNetTotal;

    return JSON.stringify({
        year,
        month,
        page: '/app/dashboard/company-finance/monthly',
        found: true,
        entry_id: entry.id,
        note: entry.note || '',
        inputs: {
            gross_amount_kdv_dahil: gross,
            kdv_paid_manual: kdvPaid,
            kdv_deductible_manual: kdvDeductibleManual
        },
        computed: {
            net_revenue_kdv_haric: round2(sales.netRevenue),
            sales_vat: round2(sales.salesVat),
            tevfikat: round2(sales.tevfikat),
            expense_net_total_all: round2(expenseNetTotal),
            expense_cash_net: round2(expenseCashNet),
            expense_kdv_included_in_deductible: round2(expenseKdvIncluded),
            total_deductible_kdv: round2(totalDeductible),
            kdv_balance: round2(kdvBalance),
            matrah: round2(matrah),
            aylik_net_nakit_cashNet: round2(cashNet),
            odenecek_tutar: round2(odenecekTutar)
        },
        labels: {
            aylik_net_nakit_cashNet: 'Aylık net (nakit) — kişisel company_cash bundan alınır',
            odenecek_tutar: 'Ödenecek tutar — cashNet değil; tüm gider netleri',
            matrah: 'Vergi matrahı — tüm gider netleri (nakit dışı dahil)',
            gross_amount: 'KDV DAHİL ciro — üzerine %20 ekleme'
        },
        expenses: expenseRows,
        rules: companyRules(),
        not_included_automatically: [
            'Bağkur (company_finance_bagkur_months)',
            'Vergi taksit / toptan borç',
            'Franchise (paket prim)'
        ]
    });
}

function companyRules() {
    return {
        sales_vat_rate: SALES_VAT_RATE,
        tevfikat_of_vat_percent: 20,
        formulas: [
            'netRevenue = gross / 1.20',
            'salesVat = gross - netRevenue',
            'tevfikat = salesVat * 0.20',
            'expenseNet = amount_gross / (1 + kdv_rate/100)',
            'matrah = netRevenue - Σ all expense nets',
            'cashNet = netRevenue - tevfikat - Σ expense nets where include_in_cash_flow',
            'totalDeductible = kdv_deductible + Σ expense kdv where include_in_deductible_kdv',
            'kdvBalance = salesVat - totalDeductible - kdv_paid'
        ],
        pitfalls: [
            'gross_amount KDV dahil; tekrar KDV ekleme',
            'include_in_cash_flow=false matrahı düşürür ama cashNet’e girmez',
            'Bağkur/taksit aylık gidere otomatik yazılmaz',
            'Hesaplama (calc_lines) sayfası aylık kazançtan bağımsız (brüt maaş)'
        ]
    };
}

/** Kişisel finans aylık bütçe + borç özeti — panelle aynı. */
export async function personalFinanceSummary(
    db: SupabaseClient,
    yearIn?: number,
    monthIn?: number
): Promise<string> {
    const { year, month } = resolveYm(yearIn, monthIn);

    const [incRes, expRes, debtRes] = await Promise.all([
        db
            .from('personal_finance_incomes')
            .select(
                'id, name, amount, source, company_monthly_entry_id, due_date, is_received, repeats_monthly, note'
            )
            .eq('year', year)
            .eq('month', month)
            .order('sort_order'),
        db
            .from('personal_finance_expenses')
            .select(
                'id, name, amount, paid_amount, due_date, is_paid, repeats_monthly, note'
            )
            .eq('year', year)
            .eq('month', month)
            .order('sort_order'),
        db
            .from('personal_finance_debts')
            .select(
                'id, name, debt_type, creditor, amount, paid_amount, due_date, is_paid, note'
            )
            .order('sort_order')
            .limit(200)
    ]);

    if (incRes.error) {
        return JSON.stringify({ error: incRes.error.message, table: 'personal_finance_incomes' });
    }
    if (expRes.error) {
        return JSON.stringify({ error: expRes.error.message, table: 'personal_finance_expenses' });
    }
    if (debtRes.error) {
        return JSON.stringify({ error: debtRes.error.message, table: 'personal_finance_debts' });
    }

    const incomes = (incRes.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        amount: money(r.amount),
        source: r.source || '',
        is_company_cash: r.source === COMPANY_SOURCE,
        company_monthly_entry_id: r.company_monthly_entry_id,
        is_received: Boolean(r.is_received),
        repeats_monthly: Boolean(r.repeats_monthly),
        due_date: r.due_date,
        note: r.note || ''
    }));

    const expenses = (expRes.data || []).map((r) => {
        const amount = money(r.amount);
        const paid = money(r.paid_amount);
        return {
            id: r.id,
            name: r.name,
            amount,
            paid_amount: paid,
            remaining: expenseRemaining(amount, paid),
            is_paid: Boolean(r.is_paid) || expenseIsFullyPaid(amount, paid),
            repeats_monthly: Boolean(r.repeats_monthly),
            due_date: r.due_date,
            note: r.note || ''
        };
    });

    const incomeTotal = incomes.reduce((s, r) => s + r.amount, 0);
    const expenseTotalFull = expenses.reduce((s, r) => s + r.amount, 0);
    const expenseRemainingTotal = expenses.reduce((s, r) => s + r.remaining, 0);
    const budgetRemaining = incomeTotal - expenseTotalFull;

    const debts = (debtRes.data || []).map((r) => {
        const amount = money(r.amount);
        const paid = money(r.paid_amount);
        return {
            id: r.id,
            name: r.name,
            debt_type: r.debt_type,
            debt_type_label: debtTypeLabel(String(r.debt_type || 'other')),
            creditor: r.creditor || '',
            amount,
            paid_amount: paid,
            remaining: expenseRemaining(amount, paid),
            is_paid: Boolean(r.is_paid) || expenseIsFullyPaid(amount, paid),
            due_date: r.due_date,
            note: r.note || ''
        };
    });

    const debtTotal = debts.reduce((s, r) => s + r.amount, 0);
    const debtPaid = debts.reduce((s, r) => s + Math.min(r.paid_amount, r.amount), 0);
    const debtRemaining = debts.reduce((s, r) => s + r.remaining, 0);
    const debtOpenCount = debts.filter((r) => !r.is_paid).length;

    const companyCash = incomes.find((r) => r.is_company_cash) || null;

    return JSON.stringify({
        year,
        month,
        pages: {
            income: '/app/dashboard/personal-finance/income',
            expenses: '/app/dashboard/personal-finance/expenses',
            debts: '/app/dashboard/personal-finance/debts'
        },
        budget: {
            gelir_incomeTotal: round2(incomeTotal),
            gider_expenseTotal_full_amounts: round2(expenseTotalFull),
            kalan_butce: round2(budgetRemaining),
            kalan_borc_expense_remainings: round2(expenseRemainingTotal),
            note: 'Bütçe gideri tam amount kullanır; kısmi ödeme bütçe giderini düşürmez. is_received filtrelemez.'
        },
        incomes,
        expenses,
        company_cash: companyCash
            ? {
                  ...companyCash,
                  meaning:
                      'Şirket aylık net (nakit/cashNet) anlık kopyası; şirket değişince otomatik güncellenmez (yenile gerekir). Ayda en fazla 1.'
              }
            : null,
        debts: {
            types: DEBT_TYPES,
            totals: {
                total: round2(debtTotal),
                paid: round2(debtPaid),
                remaining: round2(debtRemaining),
                open_count: debtOpenCount
            },
            note: 'Borçlar ay bağımsızdır; kişisel aylık bütçeye otomatik girmez.',
            rows: debts
        },
        rules: {
            formulas: [
                'gelir = Σ income.amount (is_received yok sayılır)',
                'gider (bütçe) = Σ expense.amount (paid_amount yok sayılır)',
                'kalan bütçe = gelir - gider',
                'kalan borç (gider) = Σ max(0, amount - paid_amount)',
                'debt remaining = max(0, amount - paid_amount)'
            ],
            pitfalls: [
                'Kısmi ödenmiş gider hâlâ bütçe giderine tam tutarla girer',
                'Borç ödemesi ayrı expense yazılmadıkça aylık bütçeyi değiştirmez',
                'company_cash snapshot; canlı şirket neti değil',
                'repeats_monthly otomatik kopyalamaz; manuel aktar'
            ]
        }
    });
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
