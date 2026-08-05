-- Benzin / yakıt dolum kayıtları (şirket kartı)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists company_finance_fuel_logs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  fill_date date not null,
  amount_tl numeric not null check (amount_tl > 0),
  price_per_liter numeric not null check (price_per_liter > 0),
  odometer_km numeric not null check (odometer_km >= 0),
  note text not null default ''
);

create index if not exists company_finance_fuel_logs_date_idx
  on company_finance_fuel_logs (fill_date desc);

create or replace function company_finance_fuel_logs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_fuel_logs_updated_at
  on company_finance_fuel_logs;
create trigger company_finance_fuel_logs_updated_at
  before update on company_finance_fuel_logs
  for each row
  execute function company_finance_fuel_logs_set_updated_at();

alter table company_finance_fuel_logs enable row level security;

drop policy if exists "Enable access to all users" on company_finance_fuel_logs;
create policy "Enable access to all users" on company_finance_fuel_logs
  for all using (true) with check (true);

notify pgrst, 'reload config';
