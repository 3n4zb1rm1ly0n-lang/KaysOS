
-- 1. Kategoriler Tablosunu Oluştur
create table if not exists categories (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text not null, -- 'income', 'expense', 'debt', 'invoice', 'saving'
  color text, -- Opsiyonel: hex code veya tailwind class
  icon text -- Opsiyonel: lucide icon name
);

-- 2. RLS (Güvenlik) Politikasını Etkinleştir
alter table categories enable row level security;

-- 3. Geliştirme için herkese okuma/yazma izni ver (Production için bunu authenticated yapmalısınız)
create policy "Categories public access" on categories for all using (true) with check (true);

-- 4. Varsayılan Kategorileri Ekle
insert into categories (name, type) values 
('Satış', 'income'), ('Hizmet', 'income'), ('Yatırım', 'income'), ('Diğer', 'income'),
('Kira', 'expense'), ('Fatura', 'expense'), ('Maaş', 'expense'), ('Vergi', 'expense'), ('Tedarik', 'expense'), ('Yiyecek', 'expense'),
('Banka Kredisi', 'debt'), ('Elden Borç', 'debt'), ('Vergi Borcu', 'debt'),
('Enerji', 'invoice'), ('Su', 'invoice'), ('İnternet', 'invoice'), ('Kira', 'invoice'),
('Araba', 'saving'), ('Ev', 'saving'), ('Tatil', 'saving'), ('Acil Durum', 'saving');
