import { DEFAULT_ADMIN_PASSWORD } from '@/lib/admin-password';

/** Sunucu tarafı: sıfırlama API’sinin beklediği şifre (girişle aynı olmalı). */
export function getServerAdminPassword(): string {
    const admin = process.env.ADMIN_PASSWORD?.trim();
    if (admin) return admin;
    const pub = process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim();
    if (pub) return pub;
    return DEFAULT_ADMIN_PASSWORD;
}
