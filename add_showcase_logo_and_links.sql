-- =============================================================================
-- Vitrin proje alanları (logo + modal detay + linkler)
-- SQL Editor'da bir kez çalıştırın
-- =============================================================================

alter table projects add column if not exists logo_url text default '';
alter table projects add column if not exists showcase_body text default '';
alter table projects add column if not exists showcase_links jsonb default '[]'::jsonb;

notify pgrst, 'reload config';
