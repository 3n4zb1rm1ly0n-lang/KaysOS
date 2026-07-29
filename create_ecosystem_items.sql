-- =============================================================================
-- Teknolojiler & partnerlikler (izometrik ekosistem)
-- SQL Editor → Run
-- =============================================================================

create extension if not exists "uuid-ossp";

create table if not exists ecosystem_items (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  kind text not null default 'technology', -- technology | partner
  logo_url text default '',
  summary text default '',
  body text default '',
  links jsonb default '[]'::jsonb,
  sort_order integer not null default 0,
  visible boolean not null default true,
  tile_tone text not null default 'light' -- light | dark
);

alter table ecosystem_items enable row level security;

drop policy if exists "Enable access to all users" on ecosystem_items;
create policy "Enable access to all users" on ecosystem_items for all using (true) with check (true);

-- 8 örnek (yoksa ekle)
insert into ecosystem_items (name, kind, logo_url, summary, body, links, sort_order, visible, tile_tone)
select * from (values
  (
    'Next.js',
    'technology',
    'https://cdn.simpleicons.org/nextdotjs/ffffff',
    'App Router ile modern web ürünleri.',
    'Kaysia projelerinde React tabanlı arayüzleri Next.js ile sunuyoruz: SSR/SSG, API route’ları ve Vercel deploy akışı.',
    '[{"label":"nextjs.org","url":"https://nextjs.org"}]'::jsonb,
    0,
    true,
    'dark'
  ),
  (
    'React',
    'technology',
    'https://cdn.simpleicons.org/react/61DAFB',
    'Bileşen odaklı arayüzler.',
    'Yeniden kullanılabilir UI parçaları ve panel deneyimleri React ile kuruluyor.',
    '[{"label":"react.dev","url":"https://react.dev"}]'::jsonb,
    1,
    true,
    'light'
  ),
  (
    'TypeScript',
    'technology',
    'https://cdn.simpleicons.org/typescript/3178C6',
    'Tip güvenli kod tabanı.',
    'Ürün ve panel kodunda TypeScript ile hata yüzeyini küçültüyor, bakımı kolaylaştırıyoruz.',
    '[{"label":"typescriptlang.org","url":"https://www.typescriptlang.org"}]'::jsonb,
    2,
    true,
    'light'
  ),
  (
    'Supabase',
    'partner',
    'https://cdn.simpleicons.org/supabase/3ECF8E',
    'Postgres + Storage + Auth altyapısı.',
    'Veri, dosya yükleme ve API katmanında Supabase ile hızlı ve ölçeklenebilir backend kuruyoruz.',
    '[{"label":"supabase.com","url":"https://supabase.com"}]'::jsonb,
    3,
    true,
    'light'
  ),
  (
    'Vercel',
    'partner',
    'https://cdn.simpleicons.org/vercel/ffffff',
    'Edge deploy ve önizleme ortamları.',
    'Next.js uygulamalarını Vercel üzerinde yayınlıyor; preview deploy’larla güvenli teslimat sağlıyoruz.',
    '[{"label":"vercel.com","url":"https://vercel.com"}]'::jsonb,
    4,
    true,
    'dark'
  ),
  (
    'Google',
    'partner',
    'https://cdn.simpleicons.org/google/4285F4',
    'Analytics, Search ve iş araçları.',
    'Ölçüm, arama görünürlüğü ve Google ekosistemi entegrasyonlarında partner olarak çalışıyoruz.',
    '[{"label":"Google","url":"https://www.google.com"}]'::jsonb,
    5,
    true,
    'light'
  ),
  (
    'GitHub',
    'partner',
    'https://cdn.simpleicons.org/github/ffffff',
    'Kaynak kontrolü ve iş birliği.',
    'Kod gözden geçirme, CI ve ekip çalışması GitHub üzerinden yürüyor.',
    '[{"label":"github.com","url":"https://github.com"}]'::jsonb,
    6,
    true,
    'dark'
  ),
  (
    'Tailwind CSS',
    'technology',
    'https://cdn.simpleicons.org/tailwindcss/06B6D4',
    'Hızlı, tutarlı arayüz stilleri.',
    'Tasarım sistemi ve responsive arayüzleri Tailwind ile sade tutuyoruz.',
    '[{"label":"tailwindcss.com","url":"https://tailwindcss.com"}]'::jsonb,
    7,
    true,
    'light'
  )
) as seed(name, kind, logo_url, summary, body, links, sort_order, visible, tile_tone)
where not exists (select 1 from ecosystem_items limit 1);

notify pgrst, 'reload config';
