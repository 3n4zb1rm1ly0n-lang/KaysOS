-- Proje galeri görselleri (çoklu)
alter table projects add column if not exists showcase_gallery jsonb default '[]'::jsonb;

notify pgrst, 'reload config';
