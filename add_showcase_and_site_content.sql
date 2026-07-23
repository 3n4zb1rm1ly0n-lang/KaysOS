-- Showcase CMS + site content (Supabase SQL Editor)

-- Project vitrin fields
alter table projects add column if not exists showcase boolean default false;
alter table projects add column if not exists showcase_summary text default '';
alter table projects add column if not exists showcase_image text default '';
alter table projects add column if not exists showcase_order integer default 0;

-- Site content (single row)
create table if not exists site_content (
  id text primary key default 'main',
  about_title text default 'Ürün odaklı bir stüdyo',
  about_body text default '',
  service_1 text default 'Web ürünleri & arayüz',
  service_2 text default 'Yönetim panelleri',
  service_3 text default 'Entegrasyon & sistemler',
  contact_email text default 'hello@kaysia.co',
  contact_note text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into site_content (id)
values ('main')
on conflict (id) do nothing;

alter table site_content enable row level security;

drop policy if exists "Enable access to all users" on site_content;
create policy "Enable access to all users" on site_content for all using (true) with check (true);
