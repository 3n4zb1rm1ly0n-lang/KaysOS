# Supabase kurulumu (Kaysia)

Eski Supabase projesini sildiyseniz sıfırdan bağlamak için bu adımları izleyin.

## 1. Yeni proje

1. [supabase.com](https://supabase.com) → giriş yapın.
2. **New project** → organizasyon seçin.
3. **Name**, güçlü bir **Database password** (kaydedin), **Region** (örn. Frankfurt) → Create.
4. Proje hazır olana kadar 1–2 dakika bekleyin.

## 2. API anahtarları

**Project Settings** (dişli) → **API**:

| Dashboard | `.env.local` değişkeni |
|-----------|------------------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` (sadece sunucu; asla `NEXT_PUBLIC_` ile kullanmayın) |

## 3. Uygulamaya yazma

Proje kökünde `.env.local` (şablon: `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_PASSWORD=  # yalnızca Ayarlar → DB sıfırlama onayı (opsiyonel)
```

`npm run dev` sürecini durdurup yeniden başlatın — Next.js env’i yalnızca restart’ta okur.

## 3b. Panel girişi (e-posta + şifre)

1. Dashboard → **Authentication** → **Providers** → **Email** açık olsun.
2. **Authentication** → **Users** → **Add user** → e-posta + şifre (Auto Confirm User önerilir).
3. `/login` sayfasında bu e-posta ve şifre ile giriş yapın.

Oturum Supabase Auth cookie’leri ile tutulur; eski `auth=true` / admin şifre girişi kaldırıldı.

## 4. Şema

1. Dashboard → **SQL Editor** → New query.
2. [`supabase_setup.sql`](supabase_setup.sql) dosyasının **tamamını** yapıştırıp **Run** (yeni proje).
3. Mevcut projeye ek alanlar + görsel yükleme için [`add_showcase_logo_and_links.sql`](add_showcase_logo_and_links.sql) çalıştırın (sütunlar + `project-assets` Storage bucket).
4. **Table Editor**’da `projects` içinde `logo_url`, `showcase_body`, `showcase_links` görünmeli.
5. **Storage** → `project-assets` bucket’ı public olmalı.

## 5. Doğrulama

- `/login` → Supabase kullanıcısı ile panele girin.
- Projeler / Domainler açılmalı (boş liste normal).
- **Şirket Finans → Hesaplama** satırları seed ile gelmeli; yüzde değiştirip kaydedin, sayfayı yenileyin.

Konsolda `placeholder.supabase.co` veya JWT/role hatası görürseniz URL/anon key yanlıştır veya `service_role` yanlışlıkla anon yerine yazılmıştır.

## Notlar

- Panel girişi: Supabase Auth (e-posta + şifre). Kullanıcıyı Dashboard’dan siz oluşturursunuz.
- RLS açık politikalarla (anon/authenticated CRUD) — erişim panelle sınırlı (geliştirme modeli).
- Eski finans tabloları (`incomes`, `expenses`, `debts`, …) bu scriptte yok.

## Ekosistem (teknoloji & partner)

SQL Editor’da [`create_ecosystem_items.sql`](create_ecosystem_items.sql) çalıştırın — tablo + 8 örnek (Next.js, React, TypeScript, Supabase, Vercel, Google, GitHub, Tailwind).

Panel menüsü **Ekosistem**: ekle/düzenle, logo yükle, detay + linkler, sitede göster.
