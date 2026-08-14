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
                'id, name, amount, source, company_monthly_entry_id, due_date, is_received, repeats_monthly, note, withheld_amount, withheld_kind, withheld_note'
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

    const incomes = (incRes.data || []).map((r) => {
        const amount = money(r.amount);
        const withheld = money(r.withheld_amount);
        const net = Math.max(0, amount - withheld);
        return {
            id: r.id,
            name: r.name,
            amount,
            withheld_amount: withheld,
            withheld_kind: r.withheld_kind || '',
            withheld_note: r.withheld_note || '',
            net_cash: net,
            source: r.source || '',
            is_company_cash: r.source === COMPANY_SOURCE,
            company_monthly_entry_id: r.company_monthly_entry_id,
            is_received: Boolean(r.is_received),
            repeats_monthly: Boolean(r.repeats_monthly),
            due_date: r.due_date,
            note: r.note || ''
        };
    });

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

    const incomeGross = incomes.reduce((s, r) => s + r.amount, 0);
    const withheldTotal = incomes.reduce((s, r) => s + Math.min(r.withheld_amount, r.amount), 0);
    const incomeNet = incomes.reduce((s, r) => s + r.net_cash, 0);
    const expenseTotalFull = expenses.reduce((s, r) => s + r.amount, 0);
    const expenseRemainingTotal = expenses.reduce((s, r) => s + r.remaining, 0);
    const budgetRemaining = incomeNet - expenseTotalFull;

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
            budget: '/app/dashboard/personal-finance/budget',
            savings: '/app/dashboard/personal-finance/savings',
            expenses: '/app/dashboard/personal-finance/expenses',
            debts: '/app/dashboard/personal-finance/debts'
        },
        cash: {
            gelir_brut: round2(incomeGross),
            bloke_haciz_toplam: round2(withheldTotal),
            net_nakit: round2(incomeNet),
            note: 'Bütçe tabanı net_nakit kullanır (amount − withheld_amount). withheld_kind: block|seizure|other'
        },
        budget: {
            gelir_incomeTotal_gross: round2(incomeGross),
            net_nakit_taban: round2(incomeNet),
            gider_expenseTotal_full_amounts: round2(expenseTotalFull),
            kalan_butce_net: round2(budgetRemaining),
            kalan_borc_expense_remainings: round2(expenseRemainingTotal),
            note: 'Eski “gelir−gider” artık net nakit − gider. Kısmi ödeme bütçe giderini düşürmez.'
        },
        incomes,
        expenses,
        company_cash: companyCash
            ? {
                  ...companyCash,
                  meaning:
                      'Şirket aylık net (nakit/cashNet) anlık kopyası; şirket değişince otomatik güncellenmez (yenile gerekir). Ayda en fazla 1. Üzerine bloke/haciz uygulanabilir.'
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
                'net_cash = max(0, amount − withheld_amount)',
                'net_nakit = Σ net_cash',
                'gider (bütçe) = Σ expense.amount (paid_amount yok sayılır)',
                'kalan = net_nakit − gider',
                'kalan borç (gider) = Σ max(0, amount - paid_amount)',
                'debt remaining = max(0, amount - paid_amount)'
            ],
            pitfalls: [
                'Bloke/haciz brütü düşürür; bütçe net üzerinden kurulur',
                'Kısmi ödenmiş gider hâlâ bütçe giderine tam tutarla girer',
                'Borç ödemesi ayrı expense yazılmadıkça aylık bütçeyi değiştirmez',
                'company_cash snapshot; canlı şirket neti değil',
                'repeats_monthly otomatik kopyalamaz; manuel aktar'
            ]
        }
    });
}

/** Bütçe + birikim özeti ve yüzde önerileri */
export async function budgetSavingsSummary(
    db: SupabaseClient,
    yearIn?: number,
    monthIn?: number
): Promise<string> {
    const { year, month } = resolveYm(yearIn, monthIn);

    const [incRes, lineRes, metaRes, potRes, expRes, debtRes] = await Promise.all([
        db
            .from('personal_finance_incomes')
            .select('amount, withheld_amount, name, withheld_kind')
            .eq('year', year)
            .eq('month', month),
        db
            .from('personal_finance_budget_lines')
            .select(
                'id, name, percent, line_type, sent_amount, linked_savings_id, linked_expense_id, linked_debt_id, note'
            )
            .eq('year', year)
            .eq('month', month)
            .order('sort_order'),
        db
            .from('personal_finance_budget_months')
            .select('base_mode, manual_base, note, is_closed')
            .eq('year', year)
            .eq('month', month)
            .maybeSingle(),
        db
            .from('personal_finance_savings_pots')
            .select('id, name, balance, goal_amount, is_archived')
            .eq('is_archived', false)
            .order('sort_order'),
        db
            .from('personal_finance_expenses')
            .select('name, amount, paid_amount, due_date, is_paid')
            .eq('year', year)
            .eq('month', month),
        db
            .from('personal_finance_debts')
            .select('name, debt_type, amount, paid_amount, due_date, is_paid')
            .order('sort_order')
            .limit(100)
    ]);

    if (lineRes.error?.message?.includes('does not exist')) {
        return JSON.stringify({
            error: 'Bütçe tabloları yok',
            hint: 'Supabase’te create_personal_budget_savings.sql çalıştırın',
            pages: {
                budget: '/app/dashboard/personal-finance/budget',
                savings: '/app/dashboard/personal-finance/savings'
            }
        });
    }
    if (incRes.error) {
        return JSON.stringify({ error: incRes.error.message });
    }

    const gross = (incRes.data || []).reduce((s, r) => s + money(r.amount), 0);
    const withheld = (incRes.data || []).reduce(
        (s, r) => s + Math.min(money(r.withheld_amount), money(r.amount)),
        0
    );
    const net = Math.max(0, gross - withheld);
    const meta = metaRes.data;
    const base =
        meta?.base_mode === 'manual' ? money(meta.manual_base) : net;

    const lines = (lineRes.data || []).map((r) => {
        const percent = money(r.percent);
        const planned = round2((base * percent) / 100);
        const sent = money(r.sent_amount);
        return {
            id: r.id,
            name: r.name,
            percent,
            line_type: r.line_type,
            planned,
            sent_amount: sent,
            remaining: round2(Math.max(0, planned - sent)),
            linked_savings_id: r.linked_savings_id,
            linked_expense_id: r.linked_expense_id,
            linked_debt_id: r.linked_debt_id,
            note: r.note || ''
        };
    });

    const percentSum = lines.reduce((s, r) => s + r.percent, 0);
    const pots = (potRes.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        balance: money(r.balance),
        goal_amount: money(r.goal_amount),
        progress_pct:
            money(r.goal_amount) > 0
                ? round2((money(r.balance) / money(r.goal_amount)) * 100)
                : null
    }));

    const openDebts = (debtRes.data || [])
        .map((r) => {
            const amount = money(r.amount);
            const paid = money(r.paid_amount);
            const remaining = Math.max(0, amount - paid);
            return {
                name: r.name,
                debt_type: r.debt_type,
                remaining: round2(remaining),
                due_date: r.due_date,
                is_paid: Boolean(r.is_paid) || remaining <= 0.005
            };
        })
        .filter((r) => !r.is_paid);

    const openDebtTotal = openDebts.reduce((s, r) => s + r.remaining, 0);
    const expenseDue = (expRes.data || [])
        .map((r) => ({
            name: r.name,
            remaining: round2(Math.max(0, money(r.amount) - money(r.paid_amount))),
            due_date: r.due_date
        }))
        .filter((r) => r.remaining > 0);

    /** Öneri: borç baskınsa debt-focus; değilse 50/30/20; agresif birikim hedefe göre */
    let suggestedTemplate = '505020';
    let suggestedLines: { name: string; percent: number; line_type: string; reason: string }[] =
        [
            {
                name: 'Birikim',
                percent: 50,
                line_type: 'savings',
                reason: 'Varsayılan güçlü birikim'
            },
            {
                name: 'İhtiyaç / sabit',
                percent: 30,
                line_type: 'expense',
                reason: 'Sabit gider payı'
            },
            {
                name: 'Serbest',
                percent: 20,
                line_type: 'free',
                reason: 'Esneklik'
            }
        ];

    if (openDebtTotal > base * 0.4 && base > 0) {
        suggestedTemplate = 'debt-focus';
        suggestedLines = [
            {
                name: 'Borç ödeme',
                percent: 50,
                line_type: 'debt',
                reason: `Açık borç ${round2(openDebtTotal)} ≥ netin %40’ı`
            },
            {
                name: 'Birikim',
                percent: 20,
                line_type: 'savings',
                reason: 'Borç baskısında asgari birikim'
            },
            {
                name: 'Serbest',
                percent: 30,
                line_type: 'free',
                reason: 'Yaşam payı'
            }
        ];
    } else if (withheld > gross * 0.15 && gross > 0) {
        suggestedTemplate = 'save-hard';
        suggestedLines = [
            {
                name: 'Birikim',
                percent: 40,
                line_type: 'savings',
                reason: 'Kesinti yüksek; net korunmalı'
            },
            {
                name: 'Borç / zorunlu',
                percent: 35,
                line_type: 'debt',
                reason: 'Bloke/haciz sonrası öncelik'
            },
            {
                name: 'Serbest',
                percent: 25,
                line_type: 'free',
                reason: 'Daralan nette tampon'
            }
        ];
    }

    const suggestedAmounts = suggestedLines.map((l) => ({
        ...l,
        amount: round2((base * l.percent) / 100)
    }));

    return JSON.stringify({
        year,
        month,
        pages: {
            budget: '/app/dashboard/personal-finance/budget',
            savings: '/app/dashboard/personal-finance/savings',
            income: '/app/dashboard/personal-finance/income',
            assistant_hint:
                'Kullanıcıya yüzde önerisini özetle; panelde şablon uygula / satır ekle diyebilir. Yazma yapmazsın.'
        },
        base: {
            gross: round2(gross),
            withheld: round2(withheld),
            net: round2(net),
            budget_base: round2(base),
            base_mode: meta?.base_mode || 'net_income',
            is_closed: Boolean(meta?.is_closed)
        },
        current_plan: {
            percent_sum: round2(percentSum),
            unallocated_percent: round2(Math.max(0, 100 - percentSum)),
            lines
        },
        savings: {
            total_balance: round2(pots.reduce((s, p) => s + p.balance, 0)),
            pots
        },
        pressure: {
            open_debt_total: round2(openDebtTotal),
            open_debts: openDebts.slice(0, 12),
            unpaid_expenses: expenseDue.slice(0, 12)
        },
        suggestion: {
            template_id: suggestedTemplate,
            lines: suggestedAmounts,
            note: 'Öneri bilgi amaçlıdır; panelde Bütçe → şablon / satır ile uygulanır. Gönderim butonları kullanıcıda.'
        },
        rules: [
            'Bütçe tabanı = net nakit (brüt − bloke/haciz) veya manuel',
            'plan_tutar = taban × percent / 100',
            'Birikim gönderimi savings_pots.balance + ledger artırır',
            'Asistan yalnızca okur/önerir; transfer yazmaz'
        ]
    });
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
