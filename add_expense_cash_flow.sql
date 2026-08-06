-- Aylık gider: nakit akışına dahil mi? (fiş/vergi planı giderleri genelde hayır)
-- Supabase SQL Editor'da çalıştırın.

alter table company_finance_monthly_expenses
  add column if not exists include_in_cash_flow boolean not null default true;

notify pgrst, 'reload config';
