/** GPT’nin okuyabileceği tablolar (yazma yok). */

export type TableInfo = {
    name: string;
    label: string;
    hint: string;
};

export const AI_READ_TABLES: TableInfo[] = [
    { name: 'projects', label: 'Projeler', hint: 'status: idea|potential|ongoing|on_hold|completed|cancelled' },
    { name: 'domains', label: 'Domainler', hint: 'yenileme, registrar' },
    { name: 'ecosystem_items', label: 'Ekosistem', hint: 'bağlantılar, vitrin' },
    { name: 'ai_subscriptions', label: 'AI abonelikler', hint: 'proje AI araçları' },
    { name: 'contact_messages', label: 'İletişim mesajları', hint: 'site form' },
    { name: 'idea_notes', label: 'Fikir notları', hint: 'mobil fikir chat' },
    { name: 'company_finance_monthly_entries', label: 'Aylık kazanç', hint: 'brüt, net, kapanış' },
    { name: 'company_finance_monthly_expenses', label: 'Aylık giderler', hint: 'şirket gider kalemleri' },
    { name: 'company_finance_paket_prim_days', label: 'Paket prim günleri', hint: 'paket, tip, izin' },
    { name: 'company_finance_paket_prim_closings', label: 'Paket prim kapanış', hint: 'aylık gönderim' },
    { name: 'company_finance_bagkur_months', label: 'Bağkur ayları', hint: 'prim, ödeme' },
    { name: 'company_finance_bagkur_settings', label: 'Bağkur ayar', hint: 'oranlar' },
    { name: 'company_finance_fuel_logs', label: 'Benzin kayıtları', hint: 'litre, tutar' },
    { name: 'company_finance_fuel_closings', label: 'Benzin kapanış', hint: 'aylık' },
    { name: 'company_finance_tax_lump_debts', label: 'Vergi toptan borç', hint: 'peşin borç' },
    { name: 'company_finance_tax_installment_debts', label: 'Vergi taksit borç', hint: 'ana borç' },
    { name: 'company_finance_tax_installment_rows', label: 'Vergi taksit satırları', hint: 'taksit planı' },
    { name: 'company_finance_income_tax_brackets', label: 'Gelir vergisi dilimleri', hint: 'hesaplama' },
    { name: 'company_finance_kdv_presets', label: 'KDV preset', hint: 'hesaplama' },
    { name: 'company_finance_calc_lines', label: 'Hesaplama satırları', hint: 'calculator' },
    { name: 'personal_finance_incomes', label: 'Kişisel gelir', hint: 'gelir kalemleri' },
    { name: 'personal_finance_expenses', label: 'Kişisel gider', hint: 'gider kalemleri' },
    { name: 'personal_finance_debts', label: 'Kişisel borç', hint: 'borçlar' },
    { name: 'ai_usage_logs', label: 'AI kullanım', hint: 'token ve maliyet' },
    { name: 'ai_budget_settings', label: 'AI bütçe ayarı', hint: 'limit ve dönem' }
];

export const AI_READ_TABLE_NAMES = new Set(AI_READ_TABLES.map((t) => t.name));

export const MAX_QUERY_ROWS = 80;
