-- Ek teknoloj + ödeme partnerleri (isim yoksa ekler)
-- create_ecosystem_items.sql çalıştıktan sonra Run

insert into ecosystem_items (name, kind, logo_url, summary, body, links, sort_order, visible, tile_tone)
select v.name, v.kind, v.logo_url, v.summary, v.body, v.links::jsonb, v.sort_order, true, v.tile_tone
from (values
  ('Node.js', 'technology', 'https://cdn.simpleicons.org/nodedotjs/339933',
   'Sunucu tarafı JavaScript.',
   'API’ler, otomasyon ve backend işleri Node.js ile yürütüyoruz.',
   '[{"label":"nodejs.org","url":"https://nodejs.org"}]', 8, 'light'),
  ('PostgreSQL', 'technology', 'https://cdn.simpleicons.org/postgresql/4169E1',
   'İlişkisel veri katmanı.',
   'Ürün verisini PostgreSQL üzerinde modelleyip sorguluyoruz.',
   '[{"label":"postgresql.org","url":"https://www.postgresql.org"}]', 9, 'light'),
  ('Docker', 'technology', 'https://cdn.simpleicons.org/docker/2496ED',
   'Konteyner ve ortam tutarlılığı.',
   'Geliştirme ve dağıtım ortamlarını Docker ile standardize ediyoruz.',
   '[{"label":"docker.com","url":"https://www.docker.com"}]', 10, 'light'),
  ('Figma', 'technology', 'https://cdn.simpleicons.org/figma/F24E1E',
   'Tasarım ve prototip.',
   'Arayüz tasarımı ve paylaşılan prototipler Figma üzerinden ilerliyor.',
   '[{"label":"figma.com","url":"https://www.figma.com"}]', 11, 'light'),
  ('OpenAI', 'partner', 'https://cdn.simpleicons.org/openai/ffffff',
   'Yapay zekâ API’leri.',
   'Asistan ve içerik akışlarında OpenAI modellerini entegre ediyoruz.',
   '[{"label":"openai.com","url":"https://openai.com"}]', 12, 'dark'),
  ('Stripe', 'partner', 'https://cdn.simpleicons.org/stripe/635BFF',
   'Uluslararası ödeme altyapısı.',
   'Abonelik ve kart ödemelerinde Stripe entegrasyonu kullanıyoruz.',
   '[{"label":"stripe.com","url":"https://stripe.com"}]', 13, 'light'),
  ('PayTR', 'partner', 'https://www.google.com/s2/favicons?domain=paytr.com&sz=128',
   'Türkiye odaklı ödeme geçidi.',
   'Yerel ödeme deneyimlerinde PayTR gateway entegrasyonları kuruyoruz.',
   '[{"label":"paytr.com","url":"https://www.paytr.com"}]', 14, 'light'),
  ('iyzico', 'partner', 'https://www.google.com/s2/favicons?domain=iyzico.com&sz=128',
   'TR ödeme ve taksit çözümleri.',
   'Marketplace ve e-ticaret akışlarında iyzico ile ödeme deneyimi bağlarıyoruz.',
   '[{"label":"iyzico.com","url":"https://www.iyzico.com"}]', 15, 'light')
) as v(name, kind, logo_url, summary, body, links, sort_order, tile_tone)
where not exists (
  select 1 from ecosystem_items e where lower(e.name) = lower(v.name)
);

notify pgrst, 'reload config';
