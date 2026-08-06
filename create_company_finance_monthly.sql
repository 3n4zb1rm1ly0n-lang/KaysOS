-- Şirket finansı — aylık kazanç + gider + GV dilimleri + KDV hazır oranları
-- Sadece girilmiş aylar satır olarak tutulur; kayıt yok / gelecek ay → 0.

-- -----------------------------------------------------------------------------
-- Aylık kayıtlar
-- -----------------------------------------------------------------------------
create table if not exists company_finance_monthly_entries (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  gross_amount numeric not null default 0,
  kdv_paid numeric not null default 0,
  -- Manuel ek indirilecek KDV (gider KDV'leri ayrı hesaplanır)
  kdv_deductible numeric not null default 0,
  note text not null default '',
  unique (year, month)
);

create index if not exists company_finance_monthly_entries_year_idx
  on company_finance_monthly_entries (year);

-- -----------------------------------------------------------------------------
-- Aylık gider satırları (KDV dahil tutar + oran; toggle → indirilecek KDV)
-- -----------------------------------------------------------------------------
create table if not exists company_finance_monthly_expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  monthly_entry_id uuid not null references company_finance_monthly_entries(id) on delete cascade,
  name text not null,
  amount_gross numeric not null default 0,
  kdv_rate numeric not null default 20 check (kdv_rate >= 0 and kdv_rate <= 100),
  include_in_deductible_kdv boolean not null default true,
  note text not null default '',
  sort_order integer not null default 0,
  -- Örn. fuel = Benzin sayfasından aktarılan (KDV’siz net gider)
  source text not null default '',
  -- false = vergi/matrah için gider, nakit (aylık net) hesabına girmez
  include_in_cash_flow boolean not null default true
);

create index if not exists company_finance_monthly_expenses_entry_idx
  on company_finance_monthly_expenses (monthly_entry_id);

-- -----------------------------------------------------------------------------
-- Yıllık gelir vergisi dilimleri (ayarlanabilir)
-- -----------------------------------------------------------------------------
create table if not exists company_finance_income_tax_brackets (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  min_amount numeric not null default 0,
  -- null = üst sınır yok
  max_amount numeric,
  rate_percent numeric not null,
  sort_order integer not null default 0
);

create index if not exists company_finance_income_tax_brackets_year_idx
  on company_finance_income_tax_brackets (year);

-- 2026 varsayılan dilimler (kullanıcı tanımı)
insert into company_finance_income_tax_brackets (year, min_amount, max_amount, rate_percent, sort_order)
select * from (values
  (2026, 0::numeric, 190000::numeric, 15::numeric, 0),
  (2026, 190000::numeric, 400000::numeric, 20::numeric, 1),
  (2026, 400000::numeric, 1500000::numeric, 27::numeric, 2),
  (2026, 1500000::numeric, 5300000::numeric, 35::numeric, 3),
  (2026, 5300000::numeric, null::numeric, 40::numeric, 4)
) as seed(year, min_amount, max_amount, rate_percent, sort_order)
where not exists (
  select 1 from company_finance_income_tax_brackets where year = 2026 limit 1
);

-- -----------------------------------------------------------------------------
-- KDV hazır oranları (hazır + ayarlanabilir)
-- -----------------------------------------------------------------------------
create table if not exists company_finance_kdv_presets (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  rate_percent numeric not null default 20 check (rate_percent >= 0 and rate_percent <= 100),
  sort_order integer not null default 0
);

insert into company_finance_kdv_presets (name, rate_percent, sort_order)
select * from (values
  ('Genel', 20::numeric, 0),
  ('Yemek', 10::numeric, 1),
  ('Market', 1::numeric, 2),
  ('KDV''siz', 0::numeric, 3)
) as seed(name, rate_percent, sort_order)
where not exists (select 1 from company_finance_kdv_presets limit 1);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table company_finance_monthly_entries enable row level security;
alter table company_finance_monthly_expenses enable row level security;
alter table company_finance_income_tax_brackets enable row level security;
alter table company_finance_kdv_presets enable row level security;

drop policy if exists "Enable access to all users" on company_finance_monthly_entries;
create policy "Enable access to all users" on company_finance_monthly_entries
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_monthly_expenses;
create policy "Enable access to all users" on company_finance_monthly_expenses
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_income_tax_brackets;
create policy "Enable access to all users" on company_finance_income_tax_brackets
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_kdv_presets;
create policy "Enable access to all users" on company_finance_kdv_presets
  for all using (true) with check (true);

notify pgrst, 'reload config';
