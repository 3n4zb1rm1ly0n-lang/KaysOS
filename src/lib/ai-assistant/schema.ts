/**
 * Asistan şema kataloğu — yeni sayfa / tablo eklerken burayı güncelle.
 *
 * Checklist (yeni sayfa):
 * 1) Supabase tablosu + RLS
 * 2) Bu dosyada AI_SCHEMA kaydı: name, label, page, columns, enums?, aliases?
 * 3) İsteğe bağlı özet tool (paket prim / projects gibi)
 * 4) create_ai_describe_table.sql zaten canlı kolon okur; allowlist AI_SCHEMA’dan gelir
 */

export type SchemaColumn = {
    name: string;
    type?: string;
    note?: string;
};

export type TableSchema = {
    name: string;
    label: string;
    /** Panel yolu — asistan “hangi sayfa” diye sorunca */
    page: string;
    hint: string;
    columns: SchemaColumn[];
    enums?: Record<string, string[]>;
    aliases?: string[];
};

export const AI_SCHEMA: TableSchema[] = [
    {
        name: 'projects',
        label: 'Projeler',
        page: '/app/dashboard/projects',
        hint: 'Proje pipeline',
        aliases: ['proje', 'projeler'],
        enums: {
            status: ['idea', 'potential', 'ongoing', 'on_hold', 'completed', 'cancelled']
        },
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'title' },
            { name: 'description' },
            { name: 'status', note: 'idea|potential|ongoing|on_hold|completed|cancelled' },
            { name: 'notes' },
            { name: 'use_domain' },
            { name: 'domain_detail' },
            { name: 'target_end_date' },
            { name: 'use_vercel' },
            { name: 'vercel_detail' },
            { name: 'use_supabase' },
            { name: 'supabase_detail' },
            { name: 'use_github' },
            { name: 'github_detail' },
            { name: 'use_gmail' },
            { name: 'gmail_detail' },
            { name: 'accounts', type: 'jsonb' },
            { name: 'showcase' },
            { name: 'showcase_summary' },
            { name: 'showcase_image' },
            { name: 'showcase_order' },
            { name: 'logo_url' },
            { name: 'showcase_body' },
            { name: 'showcase_links', type: 'jsonb' },
            { name: 'showcase_gallery', type: 'jsonb' }
        ]
    },
    {
        name: 'domains',
        label: 'Domainler',
        page: '/app/dashboard/domains',
        hint: 'Domain envanteri',
        aliases: ['domain', 'domainler'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'hostname' },
            { name: 'purchased_at' },
            { name: 'expires_at' },
            { name: 'registrar' },
            { name: 'auto_renew' },
            { name: 'annual_cost' },
            { name: 'notes' },
            { name: 'project_id' }
        ]
    },
    {
        name: 'ecosystem_items',
        label: 'Ekosistem',
        page: '/app/dashboard/ecosystem',
        hint: 'Teknoloji / partner',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'name' },
            { name: 'kind', note: 'technology|partner' },
            { name: 'logo_url' },
            { name: 'summary' },
            { name: 'body' },
            { name: 'links', type: 'jsonb' },
            { name: 'sort_order' },
            { name: 'visible' },
            { name: 'tile_tone' }
        ]
    },
    {
        name: 'ai_subscriptions',
        label: 'AI abonelikler',
        page: '/app/dashboard/projects',
        hint: 'Cursor / OpenAI vb. abonelik',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'provider_name' },
            { name: 'plan' },
            { name: 'started_at' },
            { name: 'renews_at' },
            { name: 'monthly_cost' },
            { name: 'notes' }
        ]
    },
    {
        name: 'contact_messages',
        label: 'İletişim mesajları',
        page: '/app/dashboard/messages',
        hint: 'Site iletişim formu',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'name' },
            { name: 'email' },
            { name: 'phone' },
            { name: 'message' },
            { name: 'source' },
            { name: 'is_read' }
        ]
    },
    {
        name: 'idea_notes',
        label: 'Fikir notları',
        page: '/app/dashboard/messages',
        hint: 'Mobil fikir balonu',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'body' },
            { name: 'is_read' }
        ]
    },
    {
        name: 'company_finance_monthly_entries',
        label: 'Aylık kazanç',
        page: '/app/dashboard/company-finance/monthly',
        hint: 'Brüt / KDV aylık',
        aliases: ['aylik_kazanc', 'monthly', 'monthly_entries'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'gross_amount' },
            { name: 'kdv_paid' },
            { name: 'kdv_deductible' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_monthly_expenses',
        label: 'Aylık giderler',
        page: '/app/dashboard/company-finance/monthly',
        hint: 'Aylık gider satırları',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'monthly_entry_id' },
            { name: 'name' },
            { name: 'amount_gross' },
            { name: 'kdv_rate' },
            { name: 'include_in_deductible_kdv' },
            { name: 'note' },
            { name: 'sort_order' },
            { name: 'source' },
            { name: 'include_in_cash_flow' }
        ]
    },
    {
        name: 'company_finance_paket_prim_days',
        label: 'Paket prim günleri',
        page: '/app/dashboard/company-finance/paket-prim',
        hint: 'Günlük paket / izin',
        aliases: ['paket_prim', 'paket_prim_days', 'prim'],
        enums: { status: ['work', 'leave'], tip: ['hemen', 'sanal'] },
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'work_date' },
            { name: 'status', note: 'work|leave' },
            { name: 'packages' },
            { name: 'tip', note: 'hemen|sanal' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_paket_prim_closings',
        label: 'Paket prim kapanış',
        page: '/app/dashboard/company-finance/paket-prim',
        hint: 'Ay kapanışı → aylık kazanç',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'is_closed' },
            { name: 'gross_sent' },
            { name: 'fixed_pay' },
            { name: 'daily_prim_total' },
            { name: 'monthly_bonus' },
            { name: 'total_packages' },
            { name: 'work_days' },
            { name: 'sent_at' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_bagkur_months',
        label: 'Bağkur ayları',
        page: '/app/dashboard/company-finance/bagkur',
        hint: 'Aylık prim',
        aliases: ['bagkur'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'prim_amount' },
            { name: 'is_paid' },
            { name: 'paid_at' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_bagkur_settings',
        label: 'Bağkur ayar',
        page: '/app/dashboard/company-finance/bagkur',
        hint: 'Başlangıç / faiz / yıllık prim',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'company_start_year' },
            { name: 'company_start_month' },
            { name: 'penalty_ratio' },
            { name: 'sgk_principal_ref' },
            { name: 'sgk_penalty_ref' },
            { name: 'sgk_total_ref' },
            { name: 'yearly_prims', type: 'jsonb' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_fuel_logs',
        label: 'Benzin kayıtları',
        page: '/app/dashboard/company-finance/fuel',
        hint: 'Dolum',
        aliases: ['benzin', 'fuel'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'fill_date' },
            { name: 'amount_tl' },
            { name: 'price_per_liter' },
            { name: 'odometer_km' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_fuel_closings',
        label: 'Benzin kapanış',
        page: '/app/dashboard/company-finance/fuel',
        hint: 'Ay kapanışı',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'is_closed' },
            { name: 'amount_sent' },
            { name: 'fill_count' },
            { name: 'expense_id' },
            { name: 'sent_at' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_fuel_settings',
        label: 'Benzin ayar',
        page: '/app/dashboard/company-finance/fuel',
        hint: 'Varsayılan ₺/L, aylık hedef',
        aliases: ['benzin ayar'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'default_price_per_liter' },
            { name: 'monthly_budget_tl' },
            { name: 'vehicle_name' }
        ]
    },
    {
        name: 'company_finance_tax_lump_debts',
        label: 'Vergi toptan borç',
        page: '/app/dashboard/company-finance/vergi-taksit',
        hint: 'Peşin / toptan',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'name' },
            { name: 'amount' },
            { name: 'is_paid' },
            { name: 'paid_at' },
            { name: 'note' },
            { name: 'sort_order' }
        ]
    },
    {
        name: 'company_finance_tax_installment_debts',
        label: 'Vergi taksit borç',
        page: '/app/dashboard/company-finance/vergi-taksit',
        hint: 'Taksit ana borç',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'name' },
            { name: 'total_amount' },
            { name: 'installment_count' },
            { name: 'start_year' },
            { name: 'start_month' },
            { name: 'due_day' },
            { name: 'sort_order' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_tax_installment_rows',
        label: 'Vergi taksit satırları',
        page: '/app/dashboard/company-finance/vergi-taksit',
        hint: 'Taksit planı satırları',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'debt_id' },
            { name: 'seq' },
            { name: 'year' },
            { name: 'month' },
            { name: 'amount' },
            { name: 'is_paid' },
            { name: 'paid_at' },
            { name: 'note' }
        ]
    },
    {
        name: 'company_finance_income_tax_brackets',
        label: 'Gelir vergisi dilimleri',
        page: '/app/dashboard/company-finance/calculator',
        hint: 'GV basamakları',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'year' },
            { name: 'min_amount' },
            { name: 'max_amount' },
            { name: 'rate_percent' },
            { name: 'sort_order' }
        ]
    },
    {
        name: 'company_finance_kdv_presets',
        label: 'KDV preset',
        page: '/app/dashboard/company-finance/calculator',
        hint: 'Hazır KDV oranları',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'name' },
            { name: 'rate_percent' },
            { name: 'sort_order' }
        ]
    },
    {
        name: 'company_finance_calc_lines',
        label: 'Hesaplama satırları',
        page: '/app/dashboard/company-finance/calculator',
        hint: 'Calculator satırları',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'name' },
            { name: 'percentage' },
            { name: 'sort_order' },
            { name: 'is_deduction' },
            { name: 'source_type' },
            { name: 'source_line_id' },
            { name: 'steps', type: 'jsonb' },
            { name: 'result_effect' }
        ]
    },
    {
        name: 'personal_finance_incomes',
        label: 'Kişisel gelir',
        page: '/app/dashboard/personal-finance/income',
        hint: 'Gelir kalemleri',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'name' },
            { name: 'amount' },
            { name: 'source' },
            { name: 'company_monthly_entry_id' },
            { name: 'due_date' },
            { name: 'is_received' },
            { name: 'repeats_monthly' },
            { name: 'note' },
            { name: 'sort_order' },
            { name: 'withheld_amount', note: 'Bloke/haciz kesintisi' },
            { name: 'withheld_kind', note: 'empty|block|seizure|other' },
            { name: 'withheld_note' }
        ]
    },
    {
        name: 'personal_finance_expenses',
        label: 'Kişisel gider',
        page: '/app/dashboard/personal-finance/expenses',
        hint: 'Gider kalemleri',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'name' },
            { name: 'amount' },
            { name: 'paid_amount' },
            { name: 'due_date' },
            { name: 'is_paid' },
            { name: 'repeats_monthly' },
            { name: 'note' },
            { name: 'sort_order' }
        ]
    },
    {
        name: 'personal_finance_debts',
        label: 'Kişisel borç',
        page: '/app/dashboard/personal-finance/debts',
        hint: 'Borçlar',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'name' },
            { name: 'debt_type' },
            { name: 'creditor' },
            { name: 'amount' },
            { name: 'paid_amount' },
            { name: 'due_date' },
            { name: 'is_paid' },
            { name: 'note' },
            { name: 'sort_order' }
        ]
    },
    {
        name: 'personal_finance_budget_lines',
        label: 'Kişisel bütçe satırları',
        page: '/app/dashboard/personal-finance/budget',
        hint: 'Aylık yüzde dağılımı',
        aliases: ['butce', 'budget'],
        enums: { line_type: ['savings', 'expense', 'debt', 'free'] },
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'name' },
            { name: 'percent' },
            { name: 'line_type' },
            { name: 'linked_savings_id' },
            { name: 'linked_expense_id' },
            { name: 'linked_debt_id' },
            { name: 'sent_amount' },
            { name: 'note' },
            { name: 'sort_order' }
        ]
    },
    {
        name: 'personal_finance_budget_months',
        label: 'Kişisel bütçe ay',
        page: '/app/dashboard/personal-finance/budget',
        hint: 'Taban modu / kapanış',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'base_mode', note: 'net_income|manual' },
            { name: 'manual_base' },
            { name: 'note' },
            { name: 'is_closed' }
        ]
    },
    {
        name: 'personal_finance_savings_pots',
        label: 'Birikim kasaları',
        page: '/app/dashboard/personal-finance/savings',
        hint: 'Birikim hedefleri',
        aliases: ['birikim', 'savings'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'updated_at' },
            { name: 'name' },
            { name: 'balance' },
            { name: 'goal_amount' },
            { name: 'note' },
            { name: 'sort_order' },
            { name: 'is_archived' }
        ]
    },
    {
        name: 'personal_finance_savings_ledger',
        label: 'Birikim hareket',
        page: '/app/dashboard/personal-finance/savings',
        hint: 'Giriş/çıkış defteri',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'pot_id' },
            { name: 'amount' },
            { name: 'year' },
            { name: 'month' },
            { name: 'budget_line_id' },
            { name: 'note' }
        ]
    },
    {
        name: 'personal_finance_activity_log',
        label: 'Kişisel finans hareket log',
        page: '/app/dashboard/personal-finance/activity',
        hint: 'Nereden nereye, parametre değişiklikleri',
        aliases: ['hareketler', 'activity log', 'finans log'],
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'year' },
            { name: 'month' },
            { name: 'action' },
            { name: 'summary' },
            { name: 'amount' },
            { name: 'from_kind' },
            { name: 'from_id' },
            { name: 'from_label' },
            { name: 'to_kind' },
            { name: 'to_id' },
            { name: 'to_label' },
            { name: 'meta', type: 'jsonb' }
        ]
    },
    {
        name: 'ai_usage_logs',
        label: 'AI kullanım',
        page: '/app/dashboard/ai-usage',
        hint: 'Token / maliyet log',
        columns: [
            { name: 'id' },
            { name: 'created_at' },
            { name: 'model' },
            { name: 'prompt_tokens' },
            { name: 'completion_tokens' },
            { name: 'total_tokens' },
            { name: 'cost_usd' },
            { name: 'tool_rounds' },
            { name: 'ok' },
            { name: 'error' }
        ]
    },
    {
        name: 'ai_budget_settings',
        label: 'AI bütçe ayarı',
        page: '/app/dashboard/settings',
        hint: 'Limit ve dönem',
        columns: [
            { name: 'id' },
            { name: 'limit_usd' },
            { name: 'period_started_at' },
            { name: 'updated_at' }
        ]
    }
];

export const AI_READ_TABLES = AI_SCHEMA.map((t) => ({
    name: t.name,
    label: t.label,
    hint: `${t.hint} · ${t.page}`,
    page: t.page
}));

export const AI_READ_TABLE_NAMES = new Set(AI_SCHEMA.map((t) => t.name));

export const MAX_QUERY_ROWS = 80;

export function schemaForTable(name: string): TableSchema | undefined {
    return AI_SCHEMA.find((t) => t.name === name);
}

export function staticDescribe(name: string) {
    const t = schemaForTable(name);
    if (!t) return null;
    return {
        table: t.name,
        label: t.label,
        page: t.page,
        hint: t.hint,
        enums: t.enums || null,
        aliases: t.aliases || [],
        columns: t.columns.map((c) => ({
            name: c.name,
            type: c.type || null,
            note: c.note || null
        })),
        column_names: t.columns.map((c) => c.name),
        source: 'static_catalog' as const
    };
}

export function listSchemaCatalog() {
    return AI_SCHEMA.map((t) => ({
        name: t.name,
        label: t.label,
        page: t.page,
        hint: t.hint,
        column_count: t.columns.length,
        column_names: t.columns.map((c) => c.name),
        enums: t.enums || null,
        aliases: t.aliases || []
    }));
}
