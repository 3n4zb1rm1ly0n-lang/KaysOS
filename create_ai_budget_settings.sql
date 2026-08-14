-- AI bütçe ayarı (limit + dönem başlangıcı)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists ai_budget_settings (
  id text primary key default 'main',
  limit_usd numeric(12, 2) not null default 10,
  period_started_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

insert into ai_budget_settings (id, limit_usd, period_started_at)
values ('main', 10, timezone('utc'::text, now()))
on conflict (id) do nothing;

alter table ai_budget_settings enable row level security;

drop policy if exists "Enable access to all users" on ai_budget_settings;
create policy "Enable access to all users" on ai_budget_settings
  for all using (true) with check (true);

notify pgrst, 'reload config';
