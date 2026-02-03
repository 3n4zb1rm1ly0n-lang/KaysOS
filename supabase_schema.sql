
-- Gelirler Tablosu
create table incomes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  amount numeric not null,
  source text not null, -- Örn: Kredi Kartı, Nakit
  category text, -- Satış, Hizmet vs.
  date date not null,
  description text,
  status text default 'Gelir',
  is_recurring boolean default false
);

-- Giderler Tablosu
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  amount numeric not null,
  recipient text not null, -- Kime/Nereye ödendi
  category text,
  date date not null,
  description text,
  payment_method text -- Nakit, Kredi Kartı, Havale
);

-- Borçlar Tablosu
create table debts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  amount numeric not null,
  creditor text not null, -- Alacaklı
  category text,
  created_date date not null, -- Borçlanma tarihi
  due_date date not null, -- Son ödeme tarihi
  description text,
  status text default 'Bekliyor' -- Bekliyor, Ödendi, Gecikmiş
);

-- Faturalar ve Sabit Giderler Tablosu
create table recurring_expenses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null, -- Örn: Kira, Elektrik
  provider text,
  amount numeric not null,
  day_of_month integer not null, -- Ayın kaçıncı günü
  category text,
  status text default 'Bekliyor', -- Ödendi, Bekliyor
  auto_pay boolean default false,
  last_paid_date date
);

-- Örnek Veriler (Opsiyonel)
-- insert into incomes (amount, source, category, date, description) values (1250.00, 'Nakit', 'Satış', '2024-02-03', 'Gün sonu');
