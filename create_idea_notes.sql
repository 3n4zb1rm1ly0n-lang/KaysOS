-- App fikir notları (hızlı yakalama chat)
-- Supabase SQL Editor'da çalıştırın.

create table if not exists idea_notes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  body text not null,
  is_read boolean not null default false
);

create index if not exists idea_notes_created_at_idx
  on idea_notes (created_at desc);

create index if not exists idea_notes_unread_idx
  on idea_notes (is_read)
  where is_read = false;

alter table idea_notes enable row level security;

drop policy if exists "Enable access to all users" on idea_notes;
create policy "Enable access to all users" on idea_notes
  for all using (true) with check (true);

notify pgrst, 'reload config';
