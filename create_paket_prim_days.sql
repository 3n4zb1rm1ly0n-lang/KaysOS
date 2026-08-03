-- Paket Taxi hızlı kurye — günlük paket / prim kayıtları
-- Sadece dolu günler (work | leave) satır olarak tutulur; boş günler takvimde türetilir.
-- Supabase SQL Editor'da çalıştırın.

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

create or replace function company_finance_paket_prim_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists company_finance_paket_prim_days_updated_at
  on company_finance_paket_prim_days;

create trigger company_finance_paket_prim_days_updated_at
  before update on company_finance_paket_prim_days
  for each row
  execute function company_finance_paket_prim_set_updated_at();

alter table company_finance_paket_prim_days enable row level security;

drop policy if exists "Enable access to all users" on company_finance_paket_prim_days;
create policy "Enable access to all users" on company_finance_paket_prim_days
  for all using (true) with check (true);

notify pgrst, 'reload config';
