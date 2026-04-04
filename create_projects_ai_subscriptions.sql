-- Projeler ve AI abonelikleri (Supabase SQL Editor'de çalıştırın)
-- Önkoşul: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text default '',
  status text not null default 'idea',
  notes text default '',
  use_domain boolean default false,
  domain_detail text default '',
  use_vercel boolean default false,
  vercel_detail text default '',
  use_supabase boolean default false,
  supabase_detail text default '',
  use_github boolean default false,
  github_detail text default '',
  use_gmail boolean default false,
  gmail_detail text default '',
  accounts jsonb default '[]'::jsonb
);

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

alter table projects enable row level security;
alter table ai_subscriptions enable row level security;

-- Politika zaten varsa 42710 hatası vermemesi için önce kaldır, sonra oluştur (script tekrar çalıştırılabilir)
drop policy if exists "Enable access to all users" on projects;
create policy "Enable access to all users" on projects for all using (true) with check (true);

drop policy if exists "Enable access to all users" on ai_subscriptions;
create policy "Enable access to all users" on ai_subscriptions for all using (true) with check (true);
