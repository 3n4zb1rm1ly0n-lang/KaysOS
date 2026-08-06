-- Benzin ay kapanışı → aylık kazanç gideri (KDV’siz, netten düşer)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists company_finance_fuel_closings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  is_closed boolean not null default true,
  -- Aylık kazanca yazılan tutar (KDV 0 — net gider)
  amount_sent numeric not null default 0,
  fill_count integer not null default 0,
  expense_id uuid,
  sent_at timestamp with time zone,
  note text not null default '',
  unique (year, month)
);

create index if not exists company_finance_fuel_closings_ym_idx
  on company_finance_fuel_closings (year, month);

create or replace function company_finance_fuel_closings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_fuel_closings_updated_at
  on company_finance_fuel_closings;
create trigger company_finance_fuel_closings_updated_at
  before update on company_finance_fuel_closings
  for each row
  execute function company_finance_fuel_closings_set_updated_at();

alter table company_finance_fuel_closings enable row level security;

drop policy if exists "Enable access to all users" on company_finance_fuel_closings;
create policy "Enable access to all users" on company_finance_fuel_closings
  for all using (true) with check (true);

-- Gider satırında kaynak (fuel = Benzin sayfasından)
alter table company_finance_monthly_expenses
  add column if not exists source text not null default '';

create index if not exists company_finance_monthly_expenses_source_idx
  on company_finance_monthly_expenses (monthly_entry_id, source);

notify pgrst, 'reload config';
