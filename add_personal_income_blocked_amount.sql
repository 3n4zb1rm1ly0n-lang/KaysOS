-- Gelir: haciz / bloke (kullanılabilir = amount − blocked_amount)
-- Supabase SQL Editor'da çalıştırın.

alter table personal_finance_incomes
  add column if not exists blocked_amount numeric not null default 0;

notify pgrst, 'reload config';
