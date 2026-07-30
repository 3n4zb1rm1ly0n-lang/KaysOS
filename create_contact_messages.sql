-- Site iletişim formundan gelen mesajlar
create table if not exists contact_messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null default '',
  email text,
  phone text,
  message text not null,
  source text not null default 'contact', -- contact | hero (ileride)
  is_read boolean not null default false,
  constraint contact_messages_email_or_phone check (
    (email is not null and length(trim(email)) > 0)
    or (phone is not null and length(trim(phone)) > 0)
  )
);

create index if not exists contact_messages_created_at_idx
  on contact_messages (created_at desc);

create index if not exists contact_messages_unread_idx
  on contact_messages (is_read)
  where is_read = false;

alter table contact_messages enable row level security;

-- Ziyaretçi: sadece ekleme
drop policy if exists "Public insert contact messages" on contact_messages;
create policy "Public insert contact messages"
  on contact_messages for insert
  with check (true);

-- Panel (authenticated): okuma / güncelleme / silme
drop policy if exists "Auth read contact messages" on contact_messages;
create policy "Auth read contact messages"
  on contact_messages for select
  using (auth.role() = 'authenticated');

drop policy if exists "Auth update contact messages" on contact_messages;
create policy "Auth update contact messages"
  on contact_messages for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Auth delete contact messages" on contact_messages;
create policy "Auth delete contact messages"
  on contact_messages for delete
  using (auth.role() = 'authenticated');

notify pgrst, 'reload config';
