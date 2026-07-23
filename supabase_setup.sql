-- =============================================================================
-- Kaysia — Supabase sıfırdan kurulum (tek script)
-- =============================================================================
-- Nasıl: Yeni Supabase proje → SQL Editor → bu dosyanın tamamını çalıştır
-- Sonra: Project Settings → API → URL + anon key → .env.local
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1) Kategoriler
-- -----------------------------------------------------------------------------
create table if not exists categories (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text not null, -- income | expense | debt | invoice | saving
  color text,
  icon text,
  monthly_limit numeric default 0
);

-- -----------------------------------------------------------------------------
-- 2) Gelirler
-- -----------------------------------------------------------------------------
create table if not exists incomes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  amount numeric not null,
  source text not null,
  category text,
  date date not null,
  invoice_date date,
  description text,
  status text default 'Gelir',
  is_recurring boolean default false,
  tax_rate numeric default 0,
  tax_amount numeric default 0,
  withholding_rate numeric default 0,
  withholding_amount numeric default 0
);

-- -----------------------------------------------------------------------------
-- 3) Giderler
-- -----------------------------------------------------------------------------
create table if not exists expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  amount numeric not null,
  recipient text not null,
  category text,
  date date not null,
  description text,
  payment_method text,
  tax_rate numeric default 0,
  tax_amount numeric default 0
);

-- -----------------------------------------------------------------------------
-- 4) Borçlar
-- -----------------------------------------------------------------------------
create table if not exists debts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  amount numeric not null,
  creditor text not null,
  category text,
  created_date date not null,
  due_date date not null,
  description text,
  status text default 'Bekliyor' -- Bekliyor | Ödendi | Gecikmiş
);

-- -----------------------------------------------------------------------------
-- 5) Faturalar / sabit giderler
-- -----------------------------------------------------------------------------
create table if not exists recurring_expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  provider text,
  amount numeric not null,
  day_of_month integer not null,
  category text,
  status text default 'Bekliyor',
  auto_pay boolean default false,
  last_paid_date date,
  tax_rate numeric default 0
);

-- -----------------------------------------------------------------------------
-- 6) Birikim hedefleri
-- -----------------------------------------------------------------------------
create table if not exists savings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  deadline date,
  category text
);

-- -----------------------------------------------------------------------------
-- 7) Vergi kayıtları
-- -----------------------------------------------------------------------------
create table if not exists tax_entries (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  amount numeric not null,
  tax_rate numeric not null,
  tax_amount numeric not null,
  date date not null,
  category text,
  withholding_rate numeric default 0,
  withholding_amount numeric default 0
);

-- -----------------------------------------------------------------------------
-- 8) Projeler (panel + vitrin)
-- -----------------------------------------------------------------------------
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text default '',
  status text not null default 'idea',
  -- idea | potential | ongoing | on_hold | completed | cancelled
  notes text default '',
  use_domain boolean default false,
  domain_detail text default '',
  target_end_date date,
  use_vercel boolean default false,
  vercel_detail text default '',
  use_supabase boolean default false,
  supabase_detail text default '',
  use_github boolean default false,
  github_detail text default '',
  use_gmail boolean default false,
  gmail_detail text default '',
  accounts jsonb default '[]'::jsonb,
  -- Vitrin (kaysia.co)
  showcase boolean default false,
  showcase_summary text default '',
  showcase_image text default '',
  showcase_order integer default 0
);

-- -----------------------------------------------------------------------------
-- 9) Domainler (projeye bağlı)
-- -----------------------------------------------------------------------------
create table if not exists domains (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  hostname text not null,
  purchased_at date,
  expires_at date,
  registrar text default '',
  auto_renew boolean default false,
  annual_cost numeric,
  notes text default '',
  project_id uuid references projects (id) on delete set null
);

create unique index if not exists domains_hostname_lower_idx on domains (lower(hostname));

-- -----------------------------------------------------------------------------
-- 10) AI abonelikleri (panel Projeler sekmesi)
-- -----------------------------------------------------------------------------
create table if not exists ai_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  provider_name text not null,
  plan text default '',
  started_at date,
  renews_at date,
  monthly_cost numeric,
  notes text default ''
);

-- -----------------------------------------------------------------------------
-- 11) Vitrin site metinleri (tek satır)
-- -----------------------------------------------------------------------------
create table if not exists site_content (
  id text primary key default 'main',
  about_title text default 'Ürün odaklı bir stüdyo',
  about_body text default '',
  service_1 text default 'Web ürünleri & arayüz',
  service_2 text default 'Yönetim panelleri',
  service_3 text default 'Entegrasyon & sistemler',
  contact_email text default 'hello@kaysia.co',
  contact_note text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into site_content (id, about_body, contact_note)
values (
  'main',
  'Kaysia; markalar ve ekipler için web ürünleri, yönetim panelleri ve dijital sistemler tasarlar. Sade arayüzler, sağlam altyapı ve ölçülebilir sonuç.',
  'Yeni bir ürün veya yenileme mi düşünüyorsunuz? Kısa bir not bırakın.'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 12) Audit log (asistan kapalı olsa da tablo hazır)
-- -----------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  action_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason text,
  status text default 'success'
);

-- -----------------------------------------------------------------------------
-- 13) RLS — anon key ile panel/vitrin çalışsın (geliştirme)
--     App Auth0 ile korunuyor; DB tarafı şimdilik açık.
-- -----------------------------------------------------------------------------
alter table categories enable row level security;
alter table incomes enable row level security;
alter table expenses enable row level security;
alter table debts enable row level security;
alter table recurring_expenses enable row level security;
alter table savings enable row level security;
alter table tax_entries enable row level security;
alter table projects enable row level security;
alter table domains enable row level security;
alter table ai_subscriptions enable row level security;
alter table site_content enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "Enable access to all users" on categories;
drop policy if exists "Categories public access" on categories;
create policy "Enable access to all users" on categories for all using (true) with check (true);

drop policy if exists "Enable access to all users" on incomes;
create policy "Enable access to all users" on incomes for all using (true) with check (true);

drop policy if exists "Enable access to all users" on expenses;
create policy "Enable access to all users" on expenses for all using (true) with check (true);

drop policy if exists "Enable access to all users" on debts;
create policy "Enable access to all users" on debts for all using (true) with check (true);

drop policy if exists "Enable access to all users" on recurring_expenses;
create policy "Enable access to all users" on recurring_expenses for all using (true) with check (true);

drop policy if exists "Enable access to all users" on savings;
create policy "Enable access to all users" on savings for all using (true) with check (true);

drop policy if exists "Enable access to all users" on tax_entries;
drop policy if exists "Tax Entries public access" on tax_entries;
create policy "Enable access to all users" on tax_entries for all using (true) with check (true);

drop policy if exists "Enable access to all users" on projects;
create policy "Enable access to all users" on projects for all using (true) with check (true);

drop policy if exists "Enable access to all users" on domains;
create policy "Enable access to all users" on domains for all using (true) with check (true);

drop policy if exists "Enable access to all users" on ai_subscriptions;
create policy "Enable access to all users" on ai_subscriptions for all using (true) with check (true);

drop policy if exists "Enable access to all users" on site_content;
create policy "Enable access to all users" on site_content for all using (true) with check (true);

drop policy if exists "Enable access to all users" on audit_logs;
drop policy if exists "Enable all access for authenticated users" on audit_logs;
create policy "Enable access to all users" on audit_logs for all using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 14) Varsayılan kategoriler
-- -----------------------------------------------------------------------------
insert into categories (name, type) values
  ('Satış', 'income'), ('Hizmet', 'income'), ('Yatırım', 'income'), ('Diğer', 'income'),
  ('Kira', 'expense'), ('Fatura', 'expense'), ('Maaş', 'expense'), ('Vergi', 'expense'),
  ('Tedarik', 'expense'), ('Yiyecek', 'expense'),
  ('Banka Kredisi', 'debt'), ('Elden Borç', 'debt'), ('Vergi Borcu', 'debt'),
  ('Enerji', 'invoice'), ('Su', 'invoice'), ('İnternet', 'invoice'), ('Kira', 'invoice'),
  ('Araba', 'saving'), ('Ev', 'saving'), ('Tatil', 'saving'), ('Acil Durum', 'saving');

-- -----------------------------------------------------------------------------
-- 15) Schema cache yenile
-- -----------------------------------------------------------------------------
notify pgrst, 'reload config';
