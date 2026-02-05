
-- 1. Create Tax Entries Table
create table if not exists tax_entries (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  amount numeric not null, -- The total receipt amount
  tax_rate numeric not null, -- 1, 10, 20
  tax_amount numeric not null, -- Calculated tax amount
  date date not null,
  category text
);

-- 2. Enable Security
alter table tax_entries enable row level security;
create policy "Tax Entries public access" on tax_entries for all using (true) with check (true);
