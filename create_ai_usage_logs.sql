-- ChatGPT asistan token / maliyet logu
-- Supabase SQL Editor'da çalıştırın.

create table if not exists ai_usage_logs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  tool_rounds integer not null default 0,
  ok boolean not null default true,
  error text
);

create index if not exists ai_usage_logs_created_at_idx
  on ai_usage_logs (created_at desc);

alter table ai_usage_logs enable row level security;

drop policy if exists "Enable access to all users" on ai_usage_logs;
create policy "Enable access to all users" on ai_usage_logs
  for all using (true) with check (true);

notify pgrst, 'reload config';
