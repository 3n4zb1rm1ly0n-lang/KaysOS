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
  steps jsonb not null default '[]'::jsonb
);

insert into company_finance_calc_lines (name, percentage, sort_order, is_deduction, source_type, steps)
select * from (values
  ('Gelir vergisi', 15::numeric, 0, true, 'gross', '[{"op":"percent","value":15}]'::jsonb),
  ('SGK / kesinti', 20::numeric, 1, true, 'gross', '[{"op":"percent","value":20}]'::jsonb)
) as seed(name, percentage, sort_order, is_deduction, source_type, steps)
where not exists (select 1 from company_finance_calc_lines limit 1);

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
-- 6) RLS — anon key ile panel/vitrin (geliştirme; panel cookie ile korunuyor)
-- -----------------------------------------------------------------------------
alter table projects enable row level security;
alter table domains enable row level security;
alter table ai_subscriptions enable row level security;
alter table site_content enable row level security;
alter table company_finance_calc_lines enable row level security;
alter table ecosystem_items enable row level security;

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

drop policy if exists "Enable access to all users" on ecosystem_items;
create policy "Enable access to all users" on ecosystem_items for all using (true) with check (true);

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
