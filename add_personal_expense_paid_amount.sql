-- Gider: parçalı ödeme (ödenecek tutar vs ödenen)
-- Supabase SQL Editor'da çalıştırın.

alter table personal_finance_expenses
  add column if not exists paid_amount numeric not null default 0;

-- Eski "ödendi" işaretliler → tam ödenmiş say
update personal_finance_expenses
set paid_amount = amount
where is_paid = true and paid_amount = 0 and amount > 0;

notify pgrst, 'reload config';
