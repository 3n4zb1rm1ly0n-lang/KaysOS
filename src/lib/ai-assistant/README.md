# Asistan şema — yeni sayfa ekleme

Yeni panel sayfası + Supabase tablosu eklerken asistanın görmesi için:

1. SQL ile tabloyu oluştur (RLS dahil).
2. `src/lib/ai-assistant/schema.ts` içinde `AI_SCHEMA` dizisine kayıt ekle:
   - `name` (tablo)
   - `label`, `page` (panel yolu)
   - `columns` (tüm kolonlar)
   - isteğe bağlı `enums`, `aliases`
3. Karmaşık özet gerekiyorsa `tools.ts` + gerekirse `finance-summaries.ts` içine özel tool ekle.
4. Canlı kolon: `create_ai_describe_table.sql`

Hazır özet tool’lar:
- `get_company_monthly_summary` — şirket aylık kazanç
- `get_personal_finance_summary` — kişisel gelir/gider/borç (net nakit = bloke/haciz düşülmüş)
- `get_budget_savings_summary` — bütçe planı + birikim + yüzde önerisi
- `get_paket_prim_summary` — paket prim
- `get_projects_summary` — projeler
- `list_schema` / `describe_table` — kolon keşfi

SQL: `create_personal_budget_savings.sql` (bloke kolonları + bütçe + birikim tabloları)
