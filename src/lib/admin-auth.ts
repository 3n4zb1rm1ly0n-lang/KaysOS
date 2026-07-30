import { DEFAULT_ADMIN_PASSWORD } from '@/lib/admin-password';

/** Sunucu tarafı: DB sıfırlama API’sinin beklediği onay şifresi. */
export function getServerAdminPassword(): string {
    const admin = process.env.ADMIN_PASSWORD?.trim();
    if (admin) return admin;
    return DEFAULT_ADMIN_PASSWORD;
}
