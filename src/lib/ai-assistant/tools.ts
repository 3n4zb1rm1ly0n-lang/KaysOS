import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_READ_TABLE_NAMES, AI_READ_TABLES, MAX_QUERY_ROWS } from '@/lib/ai-assistant/tables';
import {
    COMPANY_FIXED_MONTHLY,
    mergeMonthFromRows,
    monthDateRange,
    summarizeMonth,
    type BonusTip,
    type PaketPrimDbRow
} from '@/lib/paket-prim';

const COL = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Model sık yanlış tablo adı uyduruyor — bilinen takma adlar */
const TABLE_ALIASES: Record<string, string> = {
    paket_prim: 'company_finance_paket_prim_days',
    paket_prim_days: 'company_finance_paket_prim_days',
    paketprim: 'company_finance_paket_prim_days',
    package_prim: 'company_finance_paket_prim_days',
    prim: 'company_finance_paket_prim_days',
    prim_days: 'company_finance_paket_prim_days',
    paket_prim_closings: 'company_finance_paket_prim_closings',
    monthly: 'company_finance_monthly_entries',
    monthly_entries: 'company_finance_monthly_entries',
    aylik_kazanc: 'company_finance_monthly_entries',
    domains: 'domains',
    projects: 'projects',
    bagkur: 'company_finance_bagkur_months',
    fuel: 'company_finance_fuel_logs',
    benzin: 'company_finance_fuel_logs'
};

function safeCol(name: unknown): string | null {
    if (typeof name !== 'string' || !COL.test(name) || name.length > 64) return null;
    return name;
}

function resolveTable(raw: string): string | null {
    const t = raw.trim();
    if (AI_READ_TABLE_NAMES.has(t)) return t;
    const alias = TABLE_ALIASES[t.toLowerCase().replace(/\s+/g, '_')];
    if (alias && AI_READ_TABLE_NAMES.has(alias)) return alias;
    const fuzzy = [...AI_READ_TABLE_NAMES].find(
        (n) => n.endsWith(t) || n.includes(t) || t.includes(n)
    );
    return fuzzy ?? null;
}

export const ASSISTANT_TOOLS = [
    {
        type: 'function' as const,
        function: {
            name: 'list_tables',
            description: 'Okunabilir KaysOS tablolarının adını ve kısa açıklamasını döndürür.',
            parameters: { type: 'object', properties: {}, additionalProperties: false }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_paket_prim_summary',
            description:
                'Paket prim özeti: sabit ücret (bugüne kadar), günlük primler, aylık bonus, franchise, paket/iş günü. Paneldeki KPI ile aynı hesap. year/month verilmezse içinde bulunulan ay.',
            parameters: {
                type: 'object',
                properties: {
                    year: { type: 'integer', description: 'Örn. 2026' },
                    month: { type: 'integer', description: '1–12' }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'query_table',
            description:
                'Bir tablodan satır okur (yalnızca SELECT). Tablo adı tam olmalı; paket günleri için company_finance_paket_prim_days. Paket prim özeti için tercih et: get_paket_prim_summary.',
            parameters: {
                type: 'object',
                properties: {
                    table: {
                        type: 'string',
                        description: 'Allowlist tablo adı (örn. company_finance_paket_prim_days)'
                    },
                    columns: {
                        type: 'string',
                        description: 'Virgüllü kolon listesi veya * (varsayılan *)'
                    },
                    filters: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                column: { type: 'string' },
                                op: {
                                    type: 'string',
                                    enum: ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'ilike']
                                },
                                value: { type: 'string' }
                            },
                            required: ['column', 'op', 'value']
                        }
                    },
                    order_column: { type: 'string' },
                    order_asc: { type: 'boolean' },
                    limit: { type: 'integer', minimum: 1, maximum: MAX_QUERY_ROWS }
                },
                required: ['table']
            }
        }
    }
];

type Filter = { column?: string; op?: string; value?: string };

async function paketPrimSummary(
    db: SupabaseClient,
    yearIn?: number,
    monthIn?: number
): Promise<string> {
    const now = new Date();
    const year = yearIn && yearIn >= 2000 ? Math.floor(yearIn) : now.getFullYear();
    const month =
        monthIn && monthIn >= 1 && monthIn <= 12 ? Math.floor(monthIn) : now.getMonth() + 1;
    const monthIndex = month - 1;
    const { from, to } = monthDateRange(year, monthIndex);

    const { data, error } = await db
        .from('company_finance_paket_prim_days')
        .select('work_date, status, packages, tip, note')
        .gte('work_date', from)
        .lte('work_date', to)
        .order('work_date');

    if (error) {
        return JSON.stringify({
            error: error.message,
            hint:
                'Tablo yoksa create_paket_prim_days.sql çalıştır. Vercel’de SUPABASE_SERVICE_ROLE_KEY ve NEXT_PUBLIC_SUPABASE_URL kontrol et.',
            table: 'company_finance_paket_prim_days'
        });
    }

    const rows: PaketPrimDbRow[] = (data || []).map((r) => ({
        work_date: String(r.work_date),
        status: r.status === 'leave' ? 'leave' : 'work',
        packages: Number(r.packages) || 0,
        tip: r.tip === 'hemen' || r.tip === 'sanal' ? (r.tip as BonusTip) : null,
        note: typeof r.note === 'string' ? r.note : undefined
    }));

    const entries = mergeMonthFromRows(year, monthIndex, rows);
    const summary = summarizeMonth(entries, year, month);
    const dayShare = COMPANY_FIXED_MONTHLY / (summary.calendarDays || 1);

    const { data: closing } = await db
        .from('company_finance_paket_prim_closings')
        .select(
            'is_closed, gross_sent, fixed_pay, daily_prim_total, monthly_bonus, total_packages, work_days, sent_at, note'
        )
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

    return JSON.stringify({
        year,
        month,
        monthLabel: `${String(month).padStart(2, '0')}/${year}`,
        rules: {
            monthly_fixed_full_tl: COMPANY_FIXED_MONTHLY,
            fixed_accrual: 'bugüne kadar geçen takvim günü × (55223 / ay günü), izin dahil',
            daily_fixed_share_tl: Math.round(dayShare * 100) / 100,
            franchise_monthly_tl: 1200,
            note: 'Franchise özet toplamına eklenmez; ayrı kesinti'
        },
        summary: {
            elapsed_days: summary.elapsedDays,
            calendar_days: summary.calendarDays,
            work_days: summary.workDays,
            leave_days: summary.leaveDays,
            total_packages: summary.totalPackages,
            avg_packages_per_work_day: Math.round(summary.avgPackagesPerWorkDay * 10) / 10,
            fixed_pay_accrued_tl: summary.fixedPay,
            fixed_pay_full_month_tl: summary.monthFixedFull,
            daily_prim_total_tl: summary.dailyPrimTotal,
            monthly_bonus_tl: summary.monthlyBonusAmount,
            grand_total_tl: summary.grandTotal,
            franchise_total_tl: Math.round(summary.franchiseTotal * 100) / 100,
            next_monthly: summary.nextMonthly
        },
        recorded_rows: rows.length,
        closing: closing || null
    });
}

export async function runAssistantTool(
    db: SupabaseClient,
    name: string,
    rawArgs: string
): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
        args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
    } catch {
        return JSON.stringify({ error: 'Geçersiz JSON argüman' });
    }

    if (name === 'list_tables') {
        return JSON.stringify({
            tables: AI_READ_TABLES,
            tip: 'Paket prim özeti için get_paket_prim_summary kullan.'
        });
    }

    if (name === 'get_paket_prim_summary') {
        const year = typeof args.year === 'number' ? args.year : Number(args.year);
        const month = typeof args.month === 'number' ? args.month : Number(args.month);
        return paketPrimSummary(
            db,
            Number.isFinite(year) ? year : undefined,
            Number.isFinite(month) ? month : undefined
        );
    }

    if (name !== 'query_table') {
        return JSON.stringify({ error: `Bilinmeyen araç: ${name}` });
    }

    const rawTable = typeof args.table === 'string' ? args.table : '';
    const table = resolveTable(rawTable);
    if (!table) {
        return JSON.stringify({
            error: 'Bu tabloya erişim yok',
            requested: rawTable,
            allowed: AI_READ_TABLES.map((t) => t.name),
            tip: 'Paket prim için get_paket_prim_summary veya company_finance_paket_prim_days kullan.'
        });
    }

    const colArg = typeof args.columns === 'string' ? args.columns.trim() : '*';
    let select = '*';
    if (colArg && colArg !== '*') {
        const parts = colArg.split(',').map((c) => c.trim());
        if (parts.some((c) => !safeCol(c))) {
            return JSON.stringify({ error: 'Geçersiz kolon adı' });
        }
        select = parts.join(',');
    }

    const limitRaw = Number(args.limit);
    const limit = Number.isFinite(limitRaw)
        ? Math.min(MAX_QUERY_ROWS, Math.max(1, Math.floor(limitRaw)))
        : 40;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from(table).select(select).limit(limit);

    const filters = Array.isArray(args.filters) ? (args.filters as Filter[]).slice(0, 6) : [];
    for (const f of filters) {
        const col = safeCol(f.column);
        if (!col || typeof f.value !== 'string') continue;
        const op = f.op || 'eq';
        if (op === 'eq') q = q.eq(col, f.value);
        else if (op === 'neq') q = q.neq(col, f.value);
        else if (op === 'gte') q = q.gte(col, f.value);
        else if (op === 'lte') q = q.lte(col, f.value);
        else if (op === 'gt') q = q.gt(col, f.value);
        else if (op === 'lt') q = q.lt(col, f.value);
        else if (op === 'ilike') q = q.ilike(col, f.value);
    }

    const orderCol = safeCol(args.order_column);
    if (orderCol) {
        q = q.order(orderCol, { ascending: args.order_asc !== false });
    }

    const { data, error } = await q;
    if (error) {
        return JSON.stringify({
            error: error.message,
            table,
            hint: 'Kolon adını veya RLS / service role ayarını kontrol et.'
        });
    }
    return JSON.stringify({ table, count: data?.length ?? 0, rows: data });
}
