import { supabase } from '@/lib/supabase';
import {
    PF_DEBTS,
    PF_EXPENSES,
    PF_INCOMES,
    expenseRemaining,
    fetchCompanyCashNet,
    incomeNetCash,
    mapDebt,
    mapExpense,
    mapIncome
} from '@/lib/personal-finance';
import {
    FUEL_SETTINGS_TABLE,
    litersFrom,
    mapFuelSettings,
    monthBounds,
    round2,
    summarizeFuelMonth
} from '@/lib/fuel';
import { thisMonthDue, type BagkurMonthRow } from '@/lib/bagkur';
import {
    summarizeTaxInstallments,
    type TaxDebt,
    type TaxInstallmentRow
} from '@/lib/tax-installments';

export type DashboardDonutSlice = {
    name: string;
    value: number;
    color?: string;
};

export type DashboardBlock<T> = T & {
    ok: boolean;
    sqlHint?: string;
};

export type DashboardFinance = {
    personal: DashboardBlock<{
        income: number;
        blocked: number;
        expense: number;
        usableRemaining: number;
        openDebt: number;
        slices: DashboardDonutSlice[];
    }>;
    companyCash: DashboardBlock<{ amount: number }>;
    tax: DashboardBlock<{
        dueThisMonth: number;
        overdue: number;
        slices: DashboardDonutSlice[];
    }>;
    fuel: DashboardBlock<{
        totalAmount: number;
        totalLiters: number;
        count: number;
        budget: number;
        vehicleName: string;
    }>;
    bagkur: DashboardBlock<{
        thisMonth: number;
        prim: number;
        paid: boolean;
    }>;
};

function missingHint(
    err: { message?: string; code?: string } | null,
    sql: string
): string | undefined {
    if (!err) return undefined;
    const msg = err.message ?? '';
    if (err.code === '42P01' || msg.includes('does not exist')) return sql;
    if (msg.includes('withheld_')) return 'create_personal_budget_savings.sql';
    return undefined;
}

function mapTaxDebt(row: Record<string, unknown>): TaxDebt {
    return {
        id: String(row.id),
        name: String(row.name ?? ''),
        total_amount: Number(row.total_amount) || 0,
        installment_count: Number(row.installment_count) || 12,
        start_year: Number(row.start_year),
        start_month: Number(row.start_month),
        due_day: Number(row.due_day) || 30,
        sort_order: Number(row.sort_order) || 0,
        note: String(row.note ?? '')
    };
}

function mapTaxRow(row: Record<string, unknown>): TaxInstallmentRow {
    return {
        id: row.id ? String(row.id) : undefined,
        debt_id: String(row.debt_id),
        seq: Number(row.seq),
        year: Number(row.year),
        month: Number(row.month),
        amount: Number(row.amount) || 0,
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ? String(row.paid_at) : null,
        note: String(row.note ?? '')
    };
}

function mapBagkurMonth(row: Record<string, unknown>): BagkurMonthRow {
    return {
        id: row.id ? String(row.id) : undefined,
        year: Number(row.year),
        month: Number(row.month),
        prim_amount: Number(row.prim_amount) || 0,
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ? String(row.paid_at) : null,
        note: String(row.note ?? '')
    };
}

export async function fetchDashboardFinance(
    year: number,
    month: number
): Promise<DashboardFinance> {
    const { from, to } = monthBounds(year, month - 1);
    const asOf = new Date(year, month - 1, 15);

    const [
        incRes,
        expRes,
        debtRes,
        taxDebtRes,
        taxRowRes,
        fuelRes,
        fuelSetRes,
        bagkurMonthRes,
        bagkurSetRes
    ] = await Promise.all([
        supabase.from(PF_INCOMES).select('*').eq('year', year).eq('month', month),
        supabase.from(PF_EXPENSES).select('*').eq('year', year).eq('month', month),
        supabase.from(PF_DEBTS).select('*'),
        supabase
            .from('company_finance_tax_installment_debts')
            .select(
                'id, name, total_amount, installment_count, start_year, start_month, due_day, sort_order, note'
            ),
        supabase
            .from('company_finance_tax_installment_rows')
            .select('id, debt_id, seq, year, month, amount, is_paid, paid_at, note'),
        supabase
            .from('company_finance_fuel_logs')
            .select('fill_date, amount_tl, price_per_liter, odometer_km, note')
            .gte('fill_date', from)
            .lte('fill_date', to),
        supabase.from(FUEL_SETTINGS_TABLE).select('*').limit(1).maybeSingle(),
        supabase
            .from('company_finance_bagkur_months')
            .select('id, year, month, prim_amount, is_paid, paid_at, note')
            .eq('year', year)
            .eq('month', month)
            .maybeSingle(),
        supabase
            .from('company_finance_bagkur_settings')
            .select('penalty_ratio')
            .limit(1)
            .maybeSingle()
    ]);

    const cash = await fetchCompanyCashNet(year, month);

    let personal: DashboardFinance['personal'] = {
        ok: true,
        income: 0,
        blocked: 0,
        expense: 0,
        usableRemaining: 0,
        openDebt: 0,
        slices: []
    };

    if (incRes.error || expRes.error) {
        personal = {
            ...personal,
            ok: false,
            sqlHint:
                missingHint(incRes.error, 'create_personal_finance.sql') ||
                missingHint(expRes.error, 'create_personal_finance.sql') ||
                incRes.error?.message ||
                expRes.error?.message
        };
    } else {
        const incomes = (incRes.data ?? []).map((r) => mapIncome(r as Record<string, unknown>));
        const expenses = (expRes.data ?? []).map((r) => mapExpense(r as Record<string, unknown>));
        const income = incomes.reduce((a, r) => a + r.amount, 0);
        const blocked = incomes.reduce(
            (a, r) => a + Math.min(r.withheld_amount, r.amount),
            0
        );
        const expense = expenses.reduce((a, r) => a + r.amount, 0);
        const usable = incomes.reduce(
            (a, r) => a + incomeNetCash(r.amount, r.withheld_amount),
            0
        );
        personal = {
            ok: true,
            income,
            blocked,
            expense,
            usableRemaining: usable - expense,
            openDebt: 0,
            slices: [
                { name: 'Kullanılabilir', value: Math.max(0, usable - expense), color: '#34d399' },
                { name: 'Haciz bloke', value: blocked, color: '#fbbf24' },
                { name: 'Gider', value: expense, color: '#f87171' }
            ]
        };
    }

    if (!debtRes.error) {
        const debts = (debtRes.data ?? []).map((r) => mapDebt(r as Record<string, unknown>));
        personal.openDebt = debts.reduce((a, d) => {
            if (d.is_paid) return a;
            return a + expenseRemaining(d.amount, d.paid_amount);
        }, 0);
    } else if (!personal.sqlHint) {
        personal.sqlHint = missingHint(debtRes.error, 'create_personal_finance_debts.sql');
    }

    const companyCash: DashboardFinance['companyCash'] =
        cash.ok === true
            ? { ok: true, amount: cash.amount }
            : { ok: false, amount: 0, sqlHint: cash.message };

    let tax: DashboardFinance['tax'] = {
        ok: true,
        dueThisMonth: 0,
        overdue: 0,
        slices: []
    };
    if (taxDebtRes.error || taxRowRes.error) {
        tax = {
            ...tax,
            ok: false,
            sqlHint:
                missingHint(taxDebtRes.error, 'create_tax_installments.sql') ||
                missingHint(taxRowRes.error, 'create_tax_installments.sql') ||
                taxDebtRes.error?.message ||
                taxRowRes.error?.message
        };
    } else {
        const debts = (taxDebtRes.data ?? []).map((r) =>
            mapTaxDebt(r as Record<string, unknown>)
        );
        const rows = (taxRowRes.data ?? []).map((r) => mapTaxRow(r as Record<string, unknown>));
        const summary = summarizeTaxInstallments(debts, rows, asOf);
        const byDebt = new Map<string, { name: string; amount: number }>();
        for (const d of debts) byDebt.set(d.id, { name: d.name, amount: 0 });
        for (const r of rows) {
            if (r.is_paid) continue;
            if (r.year !== year || r.month !== month) continue;
            const slot = byDebt.get(r.debt_id);
            if (slot) slot.amount += Number(r.amount) || 0;
        }
        tax = {
            ok: true,
            dueThisMonth: summary.dueThisMonth.amount,
            overdue: summary.overdue.amount,
            slices: Array.from(byDebt.values())
                .filter((s) => s.amount > 0.005)
                .map((s) => ({ name: s.name, value: round2(s.amount) }))
        };
    }

    let fuel: DashboardFinance['fuel'] = {
        ok: true,
        totalAmount: 0,
        totalLiters: 0,
        count: 0,
        budget: 0,
        vehicleName: ''
    };
    if (fuelRes.error) {
        fuel = {
            ...fuel,
            ok: false,
            sqlHint: missingHint(fuelRes.error, 'create_fuel_logs.sql') || fuelRes.error.message
        };
    } else {
        const logs = (fuelRes.data ?? []).map((r) => ({
            fill_date: String(r.fill_date).slice(0, 10),
            amount_tl: Number(r.amount_tl) || 0,
            price_per_liter: Number(r.price_per_liter) || 0,
            odometer_km: Number(r.odometer_km) || 0,
            note: String(r.note ?? ''),
            liters: litersFrom(Number(r.amount_tl) || 0, Number(r.price_per_liter) || 0),
            delta_km: null as number | null,
            l_per_100km: null as number | null,
            tl_per_km: null as number | null,
            odometer_warning: false
        }));
        const sum = summarizeFuelMonth(logs);
        const settings =
            !fuelSetRes.error && fuelSetRes.data
                ? mapFuelSettings(fuelSetRes.data as Record<string, unknown>)
                : null;
        fuel = {
            ok: true,
            totalAmount: sum.totalAmount,
            totalLiters: sum.totalLiters,
            count: sum.count,
            budget: settings?.monthly_budget_tl ?? 0,
            vehicleName: settings?.vehicle_name ?? '',
            sqlHint:
                fuelSetRes.error &&
                (fuelSetRes.error.code === '42P01' ||
                    fuelSetRes.error.message.includes('does not exist'))
                    ? 'create_fuel_settings.sql'
                    : undefined
        };
    }

    let bagkur: DashboardFinance['bagkur'] = {
        ok: true,
        thisMonth: 0,
        prim: 0,
        paid: false
    };
    if (bagkurMonthRes.error || bagkurSetRes.error) {
        bagkur = {
            ...bagkur,
            ok: false,
            sqlHint:
                missingHint(bagkurMonthRes.error, 'create_bagkur.sql') ||
                missingHint(bagkurSetRes.error, 'create_bagkur.sql') ||
                bagkurMonthRes.error?.message ||
                bagkurSetRes.error?.message
        };
    } else {
        const ratio = Number(bagkurSetRes.data?.penalty_ratio) || 0;
        const row = bagkurMonthRes.data
            ? mapBagkurMonth(bagkurMonthRes.data as Record<string, unknown>)
            : null;
        const due = thisMonthDue(row ? [row] : [], ratio, asOf);
        bagkur = {
            ok: true,
            thisMonth: due.total,
            prim: due.prim,
            paid: due.paid
        };
    }

    return { personal, companyCash, tax, fuel, bagkur };
}
