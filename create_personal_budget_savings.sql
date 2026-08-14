-- Kişisel Finans — net nakit (bloke/haciz), Bütçe, Birikim
-- Supabase SQL Editor'da çalıştırın.

-- -----------------------------------------------------------------------------
-- Gelir: bloke / haciz düşümü → bütçeye net nakit
-- -----------------------------------------------------------------------------
alter table personal_finance_incomes
  add column if not exists withheld_amount numeric not null default 0;

alter table personal_finance_incomes
  add column if not exists withheld_kind text not null default '';

alter table personal_finance_incomes
  add column if not exists withheld_note text not null default '';

comment on column personal_finance_incomes.withheld_amount is
  'Bloke / haciz / alacaklı kesintisi; net = amount - withheld_amount';
comment on column personal_finance_incomes.withheld_kind is
  'empty | block | seizure | other';

-- -----------------------------------------------------------------------------
-- Bütçe satırları (aylık yüzde dağılımı)
-- line_type: savings | expense | debt | free
-- -----------------------------------------------------------------------------
create table if not exists personal_finance_budget_lines (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  name text not null,
  percent numeric not null default 0,
  line_type text not null default 'free',
  linked_savings_id uuid,
  linked_expense_id uuid,
  linked_debt_id uuid,
  sent_amount numeric not null default 0,
  note text not null default '',
  sort_order integer not null default 0
);

create index if not exists personal_finance_budget_lines_ym_idx
  on personal_finance_budget_lines (year, month);

-- Ay bazlı bütçe ayarı (manuel taban / not / kapanış)
create table if not exists personal_finance_budget_months (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  base_mode text not null default 'net_income',
  manual_base numeric not null default 0,
  note text not null default '',
  is_closed boolean not null default false,
  unique (year, month)
);

-- -----------------------------------------------------------------------------
-- Birikim kasaları + hareket defteri
-- -----------------------------------------------------------------------------
create table if not exists personal_finance_savings_pots (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  balance numeric not null default 0,
  goal_amount numeric not null default 0,
  note text not null default '',
  sort_order integer not null default 0,
  is_archived boolean not null default false
);

create table if not exists personal_finance_savings_ledger (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  pot_id uuid not null references personal_finance_savings_pots(id) on delete cascade,
  amount numeric not null,
  year integer,
  month integer,
  budget_line_id uuid references personal_finance_budget_lines(id) on delete set null,
  note text not null default ''
);

create index if not exists personal_finance_savings_ledger_pot_idx
  on personal_finance_savings_ledger (pot_id, created_at desc);

-- FK’ler (pots / expenses / debts) — tablo yoksa atlanır
do $$ begin
  alter table personal_finance_budget_lines
    add constraint personal_finance_budget_lines_savings_fk
    foreign key (linked_savings_id) references personal_finance_savings_pots(id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table personal_finance_budget_lines
    add constraint personal_finance_budget_lines_expense_fk
    foreign key (linked_expense_id) references personal_finance_expenses(id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table personal_finance_budget_lines
    add constraint personal_finance_budget_lines_debt_fk
    foreign key (linked_debt_id) references personal_finance_debts(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- RLS
alter table personal_finance_budget_lines enable row level security;
alter table personal_finance_budget_months enable row level security;
alter table personal_finance_savings_pots enable row level security;
alter table personal_finance_savings_ledger enable row level security;

drop policy if exists "Enable access to all users" on personal_finance_budget_lines;
create policy "Enable access to all users" on personal_finance_budget_lines
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on personal_finance_budget_months;
create policy "Enable access to all users" on personal_finance_budget_months
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on personal_finance_savings_pots;
create policy "Enable access to all users" on personal_finance_savings_pots
  for all using (true) with check (true);

drop policy if exists "Enable access to all users" on personal_finance_savings_ledger;
create policy "Enable access to all users" on personal_finance_savings_ledger
  for all using (true) with check (true);

notify pgrst, 'reload config';
