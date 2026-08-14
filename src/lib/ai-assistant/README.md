# Asistan şema — yeni sayfa ekleme

Yeni panel sayfası + Supabase tablosu eklerken asistanın görmesi için:

1. SQL ile tabloyu oluştur (RLS dahil).
2. `src/lib/ai-assistant/schema.ts` içinde `AI_SCHEMA` dizisine kayıt ekle:
   - `name` (tablo)
   - `label`, `page` (panel yolu)
   - `columns` (tüm kolonlar)
   - isteğe bağlı `enums`, `aliases`
3. Karmaşık özet gerekiyorsa `src/lib/ai-assistant/tools.ts` içine özel tool ekle (ör. `get_paket_prim_summary`).
4. Canlı kolon keşfi için bir kez: `create_ai_describe_table.sql` (Supabase SQL Editor).

Asistan araçları: `list_schema`, `describe_table`, `query_table`.
