-- =============================================================================
-- Vitrin alanları + proje görselleri için Storage bucket
-- Supabase SQL Editor → Run
-- =============================================================================

alter table projects add column if not exists logo_url text default '';
alter table projects add column if not exists showcase_body text default '';
alter table projects add column if not exists showcase_links jsonb default '[]'::jsonb;

-- Public bucket (panel cookie ile korunuyor; anon upload açık — mevcut app modeli)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_assets_select" on storage.objects;
drop policy if exists "project_assets_insert" on storage.objects;
drop policy if exists "project_assets_update" on storage.objects;
drop policy if exists "project_assets_delete" on storage.objects;

create policy "project_assets_select"
  on storage.objects for select
  using (bucket_id = 'project-assets');

create policy "project_assets_insert"
  on storage.objects for insert
  with check (bucket_id = 'project-assets');

create policy "project_assets_update"
  on storage.objects for update
  using (bucket_id = 'project-assets');

create policy "project_assets_delete"
  on storage.objects for delete
  using (bucket_id = 'project-assets');

notify pgrst, 'reload config';
