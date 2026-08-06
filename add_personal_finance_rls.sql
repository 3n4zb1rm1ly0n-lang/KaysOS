-- Kişisel finans RLS — tablolar zaten varsa bunu çalıştırın.
-- Supabase SQL Editor.

alter table personal_finance_incomes enable row level security;
alter table personal_finance_expenses enable row level security;

drop policy if exists "Enable access to all users" on personal_finance_incomes;
create policy "Enable access to all users" on personal_finance_incomes
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on personal_finance_expenses;
create policy "Enable access to all users" on personal_finance_expenses
  for all using (true) with check (true);

notify pgrst, 'reload config';
