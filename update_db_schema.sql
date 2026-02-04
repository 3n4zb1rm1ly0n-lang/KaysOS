
-- Bu komutları Supabase SQL Editor'de çalıştırarak eksik sütunları ekleyin.

-- 1. Gelirler (incomes) tablosuna vergi sütunlarını ekle
alter table incomes add column if not exists tax_rate numeric default 0;
alter table incomes add column if not exists tax_amount numeric default 0;

-- 2. Giderler (expenses) tablosuna vergi sütunlarını ekle
alter table expenses add column if not exists tax_rate numeric default 0;
alter table expenses add column if not exists tax_amount numeric default 0;

-- Not: Sütunlar zaten varsa hata vermez (if not exists sayesinde).
