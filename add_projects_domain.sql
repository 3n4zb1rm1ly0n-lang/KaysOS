-- Mevcut projects tablosuna domain alanları (Supabase SQL Editor)
alter table projects add column if not exists use_domain boolean default false;
alter table projects add column if not exists domain_detail text default '';
