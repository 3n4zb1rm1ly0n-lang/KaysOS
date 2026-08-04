-- Paket prim ay kapanışı → aylık kazanç (gross_amount) aktarımı
-- Supabase SQL Editor'da çalıştırın.

create table if not exists company_finance_paket_prim_closings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  is_closed boolean not null default true,
  -- Aylık kazanca yazılan brüt (manuel düzeltilebilir)
  gross_sent numeric not null default 0,
  fixed_pay numeric not null default 0,
  daily_prim_total numeric not null default 0,
  monthly_bonus numeric not null default 0,
  total_packages integer not null default 0,
  work_days integer not null default 0,
  sent_at timestamp with time zone,
  note text not null default '',
  unique (year, month)
);

create index if not exists company_finance_paket_prim_closings_ym_idx
  on company_finance_paket_prim_closings (year, month);

create or replace function company_finance_paket_prim_closings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_paket_prim_closings_updated_at
  on company_finance_paket_prim_closings;
create trigger company_finance_paket_prim_closings_updated_at
  before update on company_finance_paket_prim_closings
  for each row
  execute function company_finance_paket_prim_closings_set_updated_at();

alter table company_finance_paket_prim_closings enable row level security;

drop policy if exists "Enable access to all users" on company_finance_paket_prim_closings;
create policy "Enable access to all users" on company_finance_paket_prim_closings
  for all using (true) with check (true);

notify pgrst, 'reload config';
