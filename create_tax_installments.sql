-- Vergi borcu taksitlendirme — 4 taksitli borç + vadesi geçmiş toplu borçlar
-- Supabase SQL Editor'da çalıştırın.

create table if not exists company_finance_tax_installment_debts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null default '',
  total_amount numeric not null default 0 check (total_amount >= 0),
  installment_count integer not null default 12
    check (installment_count >= 1 and installment_count <= 60),
  start_year integer not null,
  start_month integer not null check (start_month >= 1 and start_month <= 12),
  -- Her taksitin vade günü (örn. 30); ay kısaysa ayın son gününe iner
  due_day integer not null default 30 check (due_day >= 1 and due_day <= 31),
  sort_order integer not null default 0,
  note text not null default ''
);

-- Mevcut kurulumlarda kolon yoksa ekle
alter table company_finance_tax_installment_debts
  add column if not exists due_day integer not null default 30;

create table if not exists company_finance_tax_installment_rows (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  debt_id uuid not null references company_finance_tax_installment_debts (id) on delete cascade,
  seq integer not null check (seq >= 1),
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  amount numeric not null default 0 check (amount >= 0),
  is_paid boolean not null default false,
  paid_at date,
  note text not null default '',
  unique (debt_id, seq)
);

create index if not exists company_finance_tax_installment_rows_debt_idx
  on company_finance_tax_installment_rows (debt_id, seq);

create index if not exists company_finance_tax_installment_rows_ym_idx
  on company_finance_tax_installment_rows (year, month);

-- Vadesi geçmiş, planı olmayan 4 borç (tek seferlik ödeme)
create table if not exists company_finance_tax_lump_debts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null default '',
  amount numeric not null default 0 check (amount >= 0),
  is_paid boolean not null default false,
  paid_at date,
  note text not null default '',
  sort_order integer not null default 0
);

create index if not exists company_finance_tax_lump_debts_sort_idx
  on company_finance_tax_lump_debts (sort_order);

create or replace function company_finance_tax_installment_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_tax_installment_debts_updated_at
  on company_finance_tax_installment_debts;
create trigger company_finance_tax_installment_debts_updated_at
  before update on company_finance_tax_installment_debts
  for each row execute function company_finance_tax_installment_set_updated_at();

drop trigger if exists company_finance_tax_installment_rows_updated_at
  on company_finance_tax_installment_rows;
create trigger company_finance_tax_installment_rows_updated_at
  before update on company_finance_tax_installment_rows
  for each row execute function company_finance_tax_installment_set_updated_at();

drop trigger if exists company_finance_tax_lump_debts_updated_at
  on company_finance_tax_lump_debts;
create trigger company_finance_tax_lump_debts_updated_at
  before update on company_finance_tax_lump_debts
  for each row execute function company_finance_tax_installment_set_updated_at();

alter table company_finance_tax_installment_debts enable row level security;
alter table company_finance_tax_installment_rows enable row level security;
alter table company_finance_tax_lump_debts enable row level security;

drop policy if exists "Enable access to all users" on company_finance_tax_installment_debts;
create policy "Enable access to all users" on company_finance_tax_installment_debts
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_tax_installment_rows;
create policy "Enable access to all users" on company_finance_tax_installment_rows
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_tax_lump_debts;
create policy "Enable access to all users" on company_finance_tax_lump_debts
  for all using (true) with check (true);

notify pgrst, 'reload config';
