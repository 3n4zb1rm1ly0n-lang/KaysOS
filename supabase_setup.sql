-- =============================================================================
-- Kaysia — Supabase sıfırdan kurulum (tek script)
-- =============================================================================
-- Anlatımlı kurulum: proje kökündeki SUPABASE.md dosyasına bakın.
--
-- Kısa yol:
--   1) https://supabase.com → New project
--   2) SQL Editor → bu dosyanın tamamını Run
--   3) Project Settings → API → URL + anon key (+ service_role)
--   4) .env.local doldur → npm run dev yeniden başlat
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1) Projeler (panel + vitrin)
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
  showcase boolean default false,
  showcase_summary text default '',
  showcase_image text default '',
  showcase_order integer default 0,
  logo_url text default '',
  showcase_body text default '',
  showcase_links jsonb default '[]'::jsonb,
  showcase_gallery jsonb default '[]'::jsonb
);

-- -----------------------------------------------------------------------------
-- 2) Domainler (projeye bağlı)
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
-- 3) AI abonelikleri
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
-- 4) Vitrin site metinleri (tek satır)
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
-- 5) Şirket finansı — brüt maaş hesaplama satırları (zincir: add_calc_line_steps.sql)
-- -----------------------------------------------------------------------------
create table if not exists company_finance_calc_lines (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  percentage numeric not null default 0,
  sort_order integer not null default 0,
  is_deduction boolean not null default true,
  source_type text not null default 'gross',
  source_line_id uuid references company_finance_calc_lines(id) on delete set null,
  steps jsonb not null default '[]'::jsonb,
  result_effect text not null default 'deduction'
);

insert into company_finance_calc_lines (name, percentage, sort_order, is_deduction, source_type, steps, result_effect)
select * from (values
  ('Gelir vergisi', 15::numeric, 0, true, 'gross', '[{"op":"percent","value":15,"operand_kind":"number"}]'::jsonb, 'deduction'),
  ('SGK / kesinti', 20::numeric, 1, true, 'gross', '[{"op":"percent","value":20,"operand_kind":"number"}]'::jsonb, 'deduction')
) as seed(name, percentage, sort_order, is_deduction, source_type, steps, result_effect)
where not exists (select 1 from company_finance_calc_lines limit 1);

-- -----------------------------------------------------------------------------
-- 5a) Şirket finansı — aylık kazanç / gider / GV dilimleri / KDV preset
--     (detay: create_company_finance_monthly.sql)
-- -----------------------------------------------------------------------------
create table if not exists company_finance_monthly_entries (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  gross_amount numeric not null default 0,
  kdv_paid numeric not null default 0,
  kdv_deductible numeric not null default 0,
  note text not null default '',
  unique (year, month)
);

create index if not exists company_finance_monthly_entries_year_idx
  on company_finance_monthly_entries (year);

create table if not exists company_finance_monthly_expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  monthly_entry_id uuid not null references company_finance_monthly_entries(id) on delete cascade,
  name text not null,
  amount_gross numeric not null default 0,
  kdv_rate numeric not null default 20 check (kdv_rate >= 0 and kdv_rate <= 100),
  include_in_deductible_kdv boolean not null default true,
  note text not null default '',
  sort_order integer not null default 0
);

create index if not exists company_finance_monthly_expenses_entry_idx
  on company_finance_monthly_expenses (monthly_entry_id);

-- -----------------------------------------------------------------------------
-- 5b) Paket prim günlük kayıtlar (detay: create_paket_prim_days.sql)
-- -----------------------------------------------------------------------------
create table if not exists company_finance_paket_prim_days (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  work_date date not null,
  status text not null default 'work'
    check (status in ('work', 'leave')),
  packages integer not null default 0
    check (packages >= 0),
  tip text
    check (tip is null or tip in ('hemen', 'sanal')),
  note text not null default '',
  unique (work_date),
  constraint company_finance_paket_prim_days_status_payload check (
    (status = 'leave' and tip is null and packages = 0)
    or (status = 'work' and tip in ('hemen', 'sanal'))
  )
);

create index if not exists company_finance_paket_prim_days_date_idx
  on company_finance_paket_prim_days (work_date);

create table if not exists company_finance_income_tax_brackets (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  min_amount numeric not null default 0,
  max_amount numeric,
  rate_percent numeric not null,
  sort_order integer not null default 0
);

create index if not exists company_finance_income_tax_brackets_year_idx
  on company_finance_income_tax_brackets (year);

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
-- 5b) Teknolojiler & partnerlikler (izometrik ekosistem)
-- -----------------------------------------------------------------------------
create table if not exists ecosystem_items (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  kind text not null default 'technology',
  logo_url text default '',
  summary text default '',
  body text default '',
  links jsonb default '[]'::jsonb,
  sort_order integer not null default 0,
  visible boolean not null default true,
  tile_tone text not null default 'light'
);

-- Örnek seed: create_ecosystem_items.sql dosyasına bakın (8 kayıt)

-- -----------------------------------------------------------------------------
-- 5c) Site iletişim mesajları
-- -----------------------------------------------------------------------------
create table if not exists contact_messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null default '',
  email text,
  phone text,
  message text not null,
  source text not null default 'contact',
  is_read boolean not null default false,
  constraint contact_messages_email_or_phone check (
    (email is not null and length(trim(email)) > 0)
    or (phone is not null and length(trim(phone)) > 0)
  )
);

create index if not exists contact_messages_created_at_idx
  on contact_messages (created_at desc);

create index if not exists contact_messages_unread_idx
  on contact_messages (is_read)
  where is_read = false;

-- -----------------------------------------------------------------------------
-- 6) RLS — anon key ile panel/vitrin (geliştirme; panel cookie ile korunuyor)
-- -----------------------------------------------------------------------------
alter table projects enable row level security;
alter table domains enable row level security;
alter table ai_subscriptions enable row level security;
alter table site_content enable row level security;
alter table company_finance_calc_lines enable row level security;
alter table company_finance_monthly_entries enable row level security;
alter table company_finance_monthly_expenses enable row level security;
alter table company_finance_paket_prim_days enable row level security;
alter table company_finance_income_tax_brackets enable row level security;
alter table company_finance_kdv_presets enable row level security;
alter table ecosystem_items enable row level security;
alter table contact_messages enable row level security;

drop policy if exists "Enable access to all users" on projects;
create policy "Enable access to all users" on projects for all using (true) with check (true);

drop policy if exists "Enable access to all users" on domains;
create policy "Enable access to all users" on domains for all using (true) with check (true);

drop policy if exists "Enable access to all users" on ai_subscriptions;
create policy "Enable access to all users" on ai_subscriptions for all using (true) with check (true);

drop policy if exists "Enable access to all users" on site_content;
create policy "Enable access to all users" on site_content for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_calc_lines;
create policy "Enable access to all users" on company_finance_calc_lines for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_monthly_entries;
create policy "Enable access to all users" on company_finance_monthly_entries for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_monthly_expenses;
create policy "Enable access to all users" on company_finance_monthly_expenses for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_paket_prim_days;
create policy "Enable access to all users" on company_finance_paket_prim_days for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_income_tax_brackets;
create policy "Enable access to all users" on company_finance_income_tax_brackets for all using (true) with check (true);

drop policy if exists "Enable access to all users" on company_finance_kdv_presets;
create policy "Enable access to all users" on company_finance_kdv_presets for all using (true) with check (true);

drop policy if exists "Enable access to all users" on ecosystem_items;
create policy "Enable access to all users" on ecosystem_items for all using (true) with check (true);

drop policy if exists "Public insert contact messages" on contact_messages;
create policy "Public insert contact messages"
  on contact_messages for insert
  with check (true);

drop policy if exists "Auth read contact messages" on contact_messages;
create policy "Auth read contact messages"
  on contact_messages for select
  using (auth.role() = 'authenticated');

drop policy if exists "Auth update contact messages" on contact_messages;
create policy "Auth update contact messages"
  on contact_messages for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Auth delete contact messages" on contact_messages;
create policy "Auth delete contact messages"
  on contact_messages for delete
  using (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 7) Proje görselleri (Storage)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_assets_select" on storage.objects;
drop policy if exists "project_assets_insert" on storage.objects;
drop policy if exists "project_assets_update" on storage.objects;
drop policy if exists "project_assets_delete" on storage.objects;

create policy "project_assets_select"
  on storage.objects for select
  using (bucket_id = 'project-assets');

create policy "project_assets_insert"
  on storage.objects for insert
  with check (bucket_id = 'project-assets');

create policy "project_assets_update"
  on storage.objects for update
  using (bucket_id = 'project-assets');

create policy "project_assets_delete"
  on storage.objects for delete
  using (bucket_id = 'project-assets');

-- -----------------------------------------------------------------------------
-- 8) Schema cache yenile
-- -----------------------------------------------------------------------------
notify pgrst, 'reload config';
