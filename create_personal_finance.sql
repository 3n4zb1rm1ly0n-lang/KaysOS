-- Kişisel Finans — gelirler + giderler
-- Supabase SQL Editor'da çalıştırın.

-- -----------------------------------------------------------------------------
-- Gelirler
-- source = 'company_cash' → Şirket Aylık kazanç nakiti (Bu ayı bağla)
-- -----------------------------------------------------------------------------
create table if not exists personal_finance_incomes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  name text not null,
  amount numeric not null default 0,
  -- '' = manuel · company_cash = şirket aylık net (nakit)
  source text not null default '',
  company_monthly_entry_id uuid references company_finance_monthly_entries(id) on delete set null,
  due_date date,
  is_received boolean not null default true,
  repeats_monthly boolean not null default false,
  note text not null default '',
  sort_order integer not null default 0
);

create index if not exists personal_finance_incomes_ym_idx
  on personal_finance_incomes (year, month);

-- Ay başına tek şirket bağlama
create unique index if not exists personal_finance_incomes_company_ym_uidx
  on personal_finance_incomes (year, month)
  where source = 'company_cash';

-- -----------------------------------------------------------------------------
-- Giderler
-- -----------------------------------------------------------------------------
create table if not exists personal_finance_expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  name text not null,
  amount numeric not null default 0,
  -- Parçalı ödeme: kalan = amount - paid_amount
  paid_amount numeric not null default 0,
  due_date date,
  is_paid boolean not null default false,
  repeats_monthly boolean not null default false,
  note text not null default '',
  sort_order integer not null default 0
);

create index if not exists personal_finance_expenses_ym_idx
  on personal_finance_expenses (year, month);

-- -----------------------------------------------------------------------------
-- RLS (diğer panel tablolarıyla aynı)
-- -----------------------------------------------------------------------------
alter table personal_finance_incomes enable row level security;
alter table personal_finance_expenses enable row level security;

drop policy if exists "Enable access to all users" on personal_finance_incomes;
create policy "Enable access to all users" on personal_finance_incomes
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on personal_finance_expenses;
create policy "Enable access to all users" on personal_finance_expenses
  for all using (true) with check (true);

notify pgrst, 'reload config';
