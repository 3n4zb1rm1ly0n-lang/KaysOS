-- Domain envanteri (Supabase SQL Editor)
-- Önkoşul: projects tablosu mevcut; uuid-ossp

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

alter table domains enable row level security;

drop policy if exists "Enable access to all users" on domains;
create policy "Enable access to all users" on domains for all using (true) with check (true);
