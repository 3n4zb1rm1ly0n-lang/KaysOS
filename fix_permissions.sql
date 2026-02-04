-- RLS (Satır Düzeyinde Güvenlik) Politikaları
-- Bu komutları Supabase SQL Editor'de çalıştırın.

-- 1. Tablolar için RLS'yi Aktif Et (Eğer zaten açıksa sorun olmaz)
alter table incomes enable row level security;
alter table expenses enable row level security;
alter table debts enable row level security;
alter table recurring_expenses enable row level security;
alter table savings enable row level security;

-- 2. Herkese (Giriş yapmamış "Anon" kullanıcıya) tam yetki ver (Geliştirme Amaçlı)
-- İLERİDE BU KISMI SİLMENİZ VE SADECE AUTHENTICATED KULLANICILARA İZİN VERMENİZ GEREKECEK.

create policy "Enable access to all users" on incomes for all using (true) with check (true);
create policy "Enable access to all users" on expenses for all using (true) with check (true);
create policy "Enable access to all users" on debts for all using (true) with check (true);
create policy "Enable access to all users" on recurring_expenses for all using (true) with check (true);
create policy "Enable access to all users" on savings for all using (true) with check (true);

-- Eğer politika zaten var hatası alırsanız, önce şunları çalıştırın (dikkatli olun):
-- drop policy if exists "Enable access to all users" on incomes;
-- drop policy if exists "Enable access to all users" on expenses;
-- drop policy if exists "Enable access to all users" on debts;
-- drop policy if exists "Enable access to all users" on recurring_expenses;
-- drop policy if exists "Enable access to all users" on savings;
