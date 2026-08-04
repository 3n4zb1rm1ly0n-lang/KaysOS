-- Bağkur 4/b — aylık prim takibi + ayarlar
-- Supabase SQL Editor'da çalıştırın.

create table if not exists company_finance_bagkur_settings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Tek satırlık ayar (uygulama her zaman ilk satırı kullanır)
  company_start_year integer not null default 2024,
  company_start_month integer not null default 12
    check (company_start_month >= 1 and company_start_month <= 12),
  -- Ödenmemiş ana borca uygulanan faiz oranı (örn. 0.43 = %43)
  -- e-Devlet: 78.392,89 / 182.304,32 ≈ 0.430012
  penalty_ratio numeric not null default 0.430012,
  -- e-Devlet referans bakiyeleri (bilgi / kalibrasyon)
  sgk_principal_ref numeric not null default 182304.32,
  sgk_penalty_ref numeric not null default 78392.89,
  sgk_total_ref numeric not null default 284313.69,
  note text not null default ''
);

create table if not exists company_finance_bagkur_months (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  prim_amount numeric not null default 0 check (prim_amount >= 0),
  is_paid boolean not null default false,
  paid_at date,
  note text not null default '',
  unique (year, month)
);

create index if not exists company_finance_bagkur_months_ym_idx
  on company_finance_bagkur_months (year, month);

create or replace function company_finance_bagkur_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_bagkur_settings_updated_at
  on company_finance_bagkur_settings;
create trigger company_finance_bagkur_settings_updated_at
  before update on company_finance_bagkur_settings
  for each row execute function company_finance_bagkur_set_updated_at();

drop trigger if exists company_finance_bagkur_months_updated_at
  on company_finance_bagkur_months;
create trigger company_finance_bagkur_months_updated_at
  before update on company_finance_bagkur_months
  for each row execute function company_finance_bagkur_set_updated_at();

alter table company_finance_bagkur_settings enable row level security;
alter table company_finance_bagkur_months enable row level security;

drop policy if exists "Enable access to all users" on company_finance_bagkur_settings;
create policy "Enable access to all users" on company_finance_bagkur_settings
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_bagkur_months;
create policy "Enable access to all users" on company_finance_bagkur_months
  for all using (true) with check (true);

-- Varsayılan ayar satırı
insert into company_finance_bagkur_settings (
  company_start_year, company_start_month, penalty_ratio,
  sgk_principal_ref, sgk_penalty_ref, sgk_total_ref
)
select 2024, 12, 0.430012, 182304.32, 78392.89, 284313.69
where not exists (select 1 from company_finance_bagkur_settings limit 1);

notify pgrst, 'reload config';
