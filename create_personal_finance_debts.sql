-- Kişisel Finans — Borçlar (kredi kartı, kredi, icra…)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists personal_finance_debts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  -- credit_card | loan | enforcement | other
  debt_type text not null default 'other',
  -- Banka / icra dairesi / alacaklı
  creditor text not null default '',
  amount numeric not null default 0,
  paid_amount numeric not null default 0,
  due_date date,
  is_paid boolean not null default false,
  note text not null default '',
  sort_order integer not null default 0
);

create index if not exists personal_finance_debts_type_idx
  on personal_finance_debts (debt_type);

create index if not exists personal_finance_debts_paid_idx
  on personal_finance_debts (is_paid);

alter table personal_finance_debts enable row level security;

drop policy if exists "Enable access to all users" on personal_finance_debts;
create policy "Enable access to all users" on personal_finance_debts
  for all using (true) with check (true);

notify pgrst, 'reload config';
