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
  showcase_order integer default 0
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
-- 5) Şirket finansı — brüt maaş hesaplama satırları
-- -----------------------------------------------------------------------------
create table if not exists company_finance_calc_lines (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  percentage numeric not null default 0,
  sort_order integer not null default 0,
  is_deduction boolean not null default true
);

insert into company_finance_calc_lines (name, percentage, sort_order, is_deduction)
select * from (values
  ('Gelir vergisi', 15::numeric, 0, true),
  ('SGK / kesinti', 20::numeric, 1, true)
) as seed(name, percentage, sort_order, is_deduction)
where not exists (select 1 from company_finance_calc_lines limit 1);

-- -----------------------------------------------------------------------------
-- 6) RLS — anon key ile panel/vitrin (geliştirme; panel cookie ile korunuyor)
-- -----------------------------------------------------------------------------
alter table projects enable row level security;
alter table domains enable row level security;
alter table ai_subscriptions enable row level security;
alter table site_content enable row level security;
alter table company_finance_calc_lines enable row level security;

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

-- -----------------------------------------------------------------------------
-- 7) Schema cache yenile
-- -----------------------------------------------------------------------------
notify pgrst, 'reload config';
