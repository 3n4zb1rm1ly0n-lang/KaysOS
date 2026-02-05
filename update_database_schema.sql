
-- 1. Invoice Date (Fatura Tarihi) - Gelirler için
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS invoice_date date;
-- Mevcut kayıtların fatura tarihini işlem tarihiyle doldur
UPDATE incomes SET invoice_date = date WHERE invoice_date IS NULL;

-- 2. Withholding (Tevkifat) - KDV Tevkifatı için
ALTER TABLE tax_entries ADD COLUMN IF NOT EXISTS withholding_rate numeric default 0;
ALTER TABLE tax_entries ADD COLUMN IF NOT EXISTS withholding_amount numeric default 0;

ALTER TABLE incomes ADD COLUMN IF NOT EXISTS withholding_rate numeric default 0;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS withholding_amount numeric default 0;

-- 3. Budget Limits (Bütçe) - Kategori Limitleri için
ALTER TABLE categories ADD COLUMN IF NOT EXISTS monthly_limit numeric default 0;

-- 4. Refresh Supabase Schema Cache (Önbelleği Temizle)
-- Bu komut Supabase API'sinin yeni sütunları hemen görmesini sağlar
NOTIFY pgrst, 'reload config';
