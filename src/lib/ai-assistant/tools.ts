import type { SupabaseClient } from '@supabase/supabase-js';
import {
    AI_READ_TABLE_NAMES,
    AI_SCHEMA,
    MAX_QUERY_ROWS,
    listSchemaCatalog,
    schemaForTable,
    staticDescribe
} from '@/lib/ai-assistant/schema';
import {
    companyMonthlySummary,
    personalFinanceSummary,
    budgetSavingsSummary
} from '@/lib/ai-assistant/finance-summaries';
import {
    COMPANY_FIXED_MONTHLY,
    mergeMonthFromRows,
    monthDateRange,
    summarizeMonth,
    type BonusTip,
    type PaketPrimDbRow
} from '@/lib/paket-prim';

const COL = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function buildAliases(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const t of AI_SCHEMA) {
        map[t.name] = t.name;
        map[t.label.toLowerCase()] = t.name;
        for (const a of t.aliases || []) {
            map[a.toLowerCase()] = t.name;
        }
    }
    return map;
}

const TABLE_ALIASES = buildAliases();

function safeCol(name: unknown): string | null {
    if (typeof name !== 'string' || !COL.test(name) || name.length > 64) return null;
    return name;
}

function resolveTable(raw: string): string | null {
    const t = raw.trim();
    if (AI_READ_TABLE_NAMES.has(t)) return t;
    const key = t.toLowerCase().replace(/\s+/g, '_');
    const alias = TABLE_ALIASES[key] || TABLE_ALIASES[t.toLowerCase()];
    if (alias && AI_READ_TABLE_NAMES.has(alias)) return alias;
    const fuzzy = Array.from(AI_READ_TABLE_NAMES).find(
        (n) => n.endsWith(t) || n.includes(t) || t.includes(n)
    );
    return fuzzy ?? null;
}

async function liveDescribe(db: SupabaseClient, table: string) {
    const { data, error } = await db.rpc('ai_describe_table', { p_table: table });
    if (error || !data) {
        return { ok: false as const, error: error?.message || 'rpc yok' };
    }
    const rows = data as {
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
        column_default: string | null;
        ordinal_position: number;
    }[];
    return {
        ok: true as const,
        columns: rows.map((r) => ({
            name: r.column_name,
            data_type: r.data_type,
            udt_name: r.udt_name,
            is_nullable: r.is_nullable,
            column_default: r.column_default,
            ordinal_position: r.ordinal_position
        })),
        column_names: rows.map((r) => r.column_name)
    };
}

export const ASSISTANT_TOOLS = [
    {
        type: 'function' as const,
        function: {
            name: 'list_schema',
            description:
                'Tüm okunabilir tabloları, panel sayfalarını, kolon adlarını ve enum değerlerini listeler. Bilinmeyen tabloda/kolonda önce bunu çağır. Yeni sayfa eklendikçe katalog güncellenir.',
            parameters: { type: 'object', properties: {}, additionalProperties: false }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'describe_table',
            description:
                'Bir tablonun gerçek kolonlarını döndürür (önce DB introspect, yoksa statik katalog). query_table öncesi kolon uydurmamak için kullan.',
            parameters: {
                type: 'object',
                properties: {
                    table: { type: 'string', description: 'Tablo adı veya alias (örn. projects, paket_prim)' }
                },
                required: ['table'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'list_tables',
            description: 'Kısa tablo listesi (list_schema tercih edilir).',
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
            name: 'get_company_monthly_summary',
            description:
                'Şirket Aylık kazanç özeti — panel ile aynı formüller. gross_amount KDV DAHİL. cashNet, matrah, tevfikat, KDV bakiyesi, gider kırılımı. year/month yoksa bu ay. Finans sorularında query_table ile kendin hesaplama; bu aracı kullan.',
            parameters: {
                type: 'object',
                properties: {
                    year: { type: 'integer' },
                    month: { type: 'integer', description: '1–12' }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_personal_finance_summary',
            description:
                'Kişisel finans özeti — panel ile aynı. net_nakit = Σ(amount−withheld bloke/haciz). Bütçe kalanı net−gider. company_cash = şirket cashNet kopyası. year/month yoksa bu ay.',
            parameters: {
                type: 'object',
                properties: {
                    year: { type: 'integer' },
                    month: { type: 'integer', description: '1–12' }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_budget_savings_summary',
            description:
                'Kişisel Bütçe + Birikim özeti ve yüzde önerisi. Net nakit (bloke/haciz düşülmüş) tabanı, mevcut plan satırları, birikim kasaları, borç baskısı ve önerilen şablon (50/30/20, borç odaklı vb.). Bütçe önerisi istendiğinde MUTLAKA bunu çağır. Yazma yok; kullanıcı panelde uygular.',
            parameters: {
                type: 'object',
                properties: {
                    year: { type: 'integer' },
                    month: { type: 'integer', description: '1–12' }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_projects_summary',
            description:
                'Projeler özeti. Status değerleri (İngilizce kod): idea=Fikir, potential=Potansiyel, ongoing=Devam ediyor/aktif, on_hold=Yarıda/Beklemede, completed=Bitti, cancelled=İptal. "aktif" → ongoing; "bekleyen" → on_hold. Kolon uydurma; bu aracı kullan.',
            parameters: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        description:
                            'Opsiyonel filtre: idea | potential | ongoing | on_hold | completed | cancelled. Türkçe: aktif→ongoing, bekleyen→on_hold'
                    }
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
                'Bir tablodan satır okur (yalnızca SELECT). Finans hesapları için: get_company_monthly_summary / get_personal_finance_summary / get_paket_prim_summary. Ham satır okurken kolon uydurma; describe_table kullan.',
            parameters: {
                type: 'object',
                properties: {
                    table: {
                        type: 'string',
                        description: 'Allowlist tablo adı (örn. projects, company_finance_paket_prim_days)'
                    },
                    columns: {
                        type: 'string',
                        description:
                            'Virgüllü kolon listesi veya *. projects için güvenli: id,title,status,description,notes,target_end_date,updated_at,created_at'
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

const PROJECT_STATUS_LABELS: Record<string, string> = {
    idea: 'Fikir',
    potential: 'Potansiyel',
    ongoing: 'Devam ediyor',
    on_hold: 'Yarıda / Beklemede',
    completed: 'Bitti',
    cancelled: 'İptal'
};

const PROJECT_STATUS_ALIASES: Record<string, string> = {
    aktif: 'ongoing',
    active: 'ongoing',
    devam: 'ongoing',
    'devam ediyor': 'ongoing',
    ongoing: 'ongoing',
    bekleyen: 'on_hold',
    beklemede: 'on_hold',
    pending: 'on_hold',
    hold: 'on_hold',
    on_hold: 'on_hold',
    yarıda: 'on_hold',
    yarida: 'on_hold',
    fikir: 'idea',
    idea: 'idea',
    potansiyel: 'potential',
    potential: 'potential',
    bitti: 'completed',
    completed: 'completed',
    iptal: 'cancelled',
    cancelled: 'cancelled'
};

function resolveProjectStatus(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const key = raw.trim().toLowerCase();
    if (PROJECT_STATUS_LABELS[key]) return key;
    return PROJECT_STATUS_ALIASES[key] ?? null;
}

async function projectsSummary(db: SupabaseClient, statusRaw?: unknown): Promise<string> {
    const statusFilter = resolveProjectStatus(statusRaw);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db
        .from('projects')
        .select('id, title, status, description, notes, target_end_date, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(80);

    if (statusFilter) q = q.eq('status', statusFilter);

    const { data, error } = await q;
    if (error) {
        return JSON.stringify({
            error: error.message,
            table: 'projects',
            hint: 'Kolonlar: id, title, status, description, notes, target_end_date, updated_at, created_at'
        });
    }

    const rows = (data || []).map((r: Record<string, unknown>) => {
        const status = String(r.status || '');
        return {
            id: r.id,
            title: r.title,
            status,
            status_label: PROJECT_STATUS_LABELS[status] || status,
            description: r.description,
            notes: r.notes,
            target_end_date: r.target_end_date,
            updated_at: r.updated_at
        };
    });

    const counts: Record<string, number> = {};
    for (const code of Object.keys(PROJECT_STATUS_LABELS)) counts[code] = 0;

    if (!statusFilter) {
        for (const r of rows) {
            if (r.status in counts) counts[r.status] += 1;
        }
    } else {
        // filtered list — also fetch full counts lightly
        const { data: allStatus } = await db.from('projects').select('status').limit(500);
        for (const r of allStatus || []) {
            const s = String((r as { status?: string }).status || '');
            if (s in counts) counts[s] += 1;
        }
    }

    return JSON.stringify({
        status_codes: PROJECT_STATUS_LABELS,
        aliases: {
            aktif: 'ongoing',
            bekleyen: 'on_hold',
            fikir: 'idea',
            potansiyel: 'potential',
            bitti: 'completed',
            iptal: 'cancelled'
        },
        filter: statusFilter,
        counts,
        count: rows.length,
        projects: rows
    });
}

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

    if (name === 'list_schema') {
        return JSON.stringify({
            how_to_add_page:
                'Yeni sayfa: 1) Supabase tablo 2) src/lib/ai-assistant/schema.ts AI_SCHEMA kaydı 3) isteğe bağlı özet tool',
            tables: listSchemaCatalog()
        });
    }

    if (name === 'describe_table') {
        const rawTable = typeof args.table === 'string' ? args.table : '';
        const table = resolveTable(rawTable);
        if (!table) {
            return JSON.stringify({
                error: 'Bu tabloya erişim yok',
                requested: rawTable,
                tip: 'Önce list_schema çağır.'
            });
        }
        const catalog = staticDescribe(table);
        const live = await liveDescribe(db, table);
        if (live.ok) {
            return JSON.stringify({
                table,
                label: catalog?.label,
                page: catalog?.page,
                enums: catalog?.enums || null,
                source: 'live_db',
                columns: live.columns,
                column_names: live.column_names,
                catalog_notes: catalog?.columns || []
            });
        }
        if (catalog) {
            return JSON.stringify({
                ...catalog,
                live_error: live.error,
                tip: 'Canlı kolon için create_ai_describe_table.sql çalıştır; şimdilik statik katalog.'
            });
        }
        return JSON.stringify({ error: 'Şema yok', table });
    }

    if (name === 'list_tables') {
        return JSON.stringify({
            tables: listSchemaCatalog().map((t) => ({
                name: t.name,
                label: t.label,
                page: t.page,
                hint: t.hint
            })),
            tip: 'Kolonlar: list_schema/describe_table. Paket prim→get_paket_prim_summary. Projeler→get_projects_summary. Şirket aylık→get_company_monthly_summary. Kişisel→get_personal_finance_summary. Bütçe/birikim→get_budget_savings_summary.'
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

    if (name === 'get_company_monthly_summary') {
        const year = typeof args.year === 'number' ? args.year : Number(args.year);
        const month = typeof args.month === 'number' ? args.month : Number(args.month);
        return companyMonthlySummary(
            db,
            Number.isFinite(year) ? year : undefined,
            Number.isFinite(month) ? month : undefined
        );
    }

    if (name === 'get_personal_finance_summary') {
        const year = typeof args.year === 'number' ? args.year : Number(args.year);
        const month = typeof args.month === 'number' ? args.month : Number(args.month);
        return personalFinanceSummary(
            db,
            Number.isFinite(year) ? year : undefined,
            Number.isFinite(month) ? month : undefined
        );
    }

    if (name === 'get_budget_savings_summary') {
        const year = typeof args.year === 'number' ? args.year : Number(args.year);
        const month = typeof args.month === 'number' ? args.month : Number(args.month);
        return budgetSavingsSummary(
            db,
            Number.isFinite(year) ? year : undefined,
            Number.isFinite(month) ? month : undefined
        );
    }

    if (name === 'get_projects_summary') {
        return projectsSummary(db, args.status);
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
            allowed: Array.from(AI_READ_TABLE_NAMES),
            tip: 'list_schema / describe_table ile doğru ad ve kolonları öğren.'
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

    // Validate columns against known schema when not *
    if (select !== '*') {
        const known = schemaForTable(table)?.columns.map((c) => c.name);
        if (known) {
            const parts = select.split(',');
            const bad = parts.filter((c) => !known.includes(c));
            if (bad.length) {
                return JSON.stringify({
                    error: 'Bilinmeyen kolon',
                    table,
                    bad_columns: bad,
                    allowed_columns: known,
                    tip: 'describe_table ile kolon listesini al.'
                });
            }
        }
    }

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
