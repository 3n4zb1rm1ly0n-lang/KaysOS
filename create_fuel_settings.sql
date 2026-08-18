-- Benzin ayarları — varsayılan ₺/L, aylık hedef, araç adı (tek satır)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists company_finance_fuel_settings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  default_price_per_liter numeric not null default 0,
  monthly_budget_tl numeric not null default 0,
  vehicle_name text not null default ''
);

create or replace function company_finance_fuel_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_fuel_settings_updated_at
  on company_finance_fuel_settings;
create trigger company_finance_fuel_settings_updated_at
  before update on company_finance_fuel_settings
  for each row
  execute function company_finance_fuel_settings_set_updated_at();

alter table company_finance_fuel_settings enable row level security;

drop policy if exists "Enable access to all users" on company_finance_fuel_settings;
create policy "Enable access to all users" on company_finance_fuel_settings
  for all using (true) with check (true);

notify pgrst, 'reload config';
