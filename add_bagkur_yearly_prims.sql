-- Bağkur ayarlarına yıllık prim tablosu (jsonb)
-- Mevcut projelerde bir kez çalıştırın.

alter table company_finance_bagkur_settings
  add column if not exists yearly_prims jsonb not null default '{
    "2024": 6900.86,
    "2025": 9036.91,
    "2026": 11808.23,
    "2027": 0
  }'::jsonb;

notify pgrst, 'reload config';
