-- Kişisel finans hareket günlüğü (para nereye + kritik parametre değişiklikleri)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists personal_finance_activity_log (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  action text not null,
  summary text not null default '',
  amount numeric not null default 0,
  from_kind text not null default '',
  from_id uuid,
  from_label text not null default '',
  to_kind text not null default '',
  to_id uuid,
  to_label text not null default '',
  meta jsonb not null default '{}'::jsonb
);

create index if not exists personal_finance_activity_log_created_at_idx
  on personal_finance_activity_log (created_at desc);

create index if not exists personal_finance_activity_log_ym_idx
  on personal_finance_activity_log (year, month);

alter table personal_finance_activity_log enable row level security;

drop policy if exists "Enable access to all users" on personal_finance_activity_log;
create policy "Enable access to all users" on personal_finance_activity_log
  for all using (true) with check (true);

notify pgrst, 'reload config';
