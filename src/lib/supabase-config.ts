/** Supabase public URL + anon key — yalnızca env (eski proje gömülü değil). */

export const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();

export const embeddedAnonKey = '';

function decodeJwtPayload(token: string): { role?: string } | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
        let json: string;
        if (typeof Buffer !== 'undefined') {
            json = Buffer.from(padded, 'base64').toString('utf8');
        } else if (typeof atob === 'function') {
            json = decodeURIComponent(
                atob(padded)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
        } else {
            return null;
        }
        return JSON.parse(json) as { role?: string };
    } catch {
        return null;
    }
}

/**
 * Tarayıcı / SSR anon anahtarı.
 * Env’de service_role varsa reddeder (browser’da yasak).
 */
export function resolvePublicAnonKey(): string {
    const env = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
    if (!env) return '';

    // Yeni publishable key (sb_publishable_...) — JWT değil, olduğu gibi kullanılır
    if (env.startsWith('sb_publishable_')) return env;

    // Secret / service_role tarayıcıda yasak
    if (env.startsWith('sb_secret_')) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(
                '[Kaysia] NEXT_PUBLIC_SUPABASE_ANON_KEY sb_secret olamaz. sb_publishable veya legacy anon JWT kullanın.'
            );
        }
        return '';
    }

    const role = decodeJwtPayload(env)?.role;
    if (role === 'service_role') {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(
                '[Kaysia] NEXT_PUBLIC_SUPABASE_ANON_KEY service_role olamaz. Dashboard → API → anon public / publishable key kullanın.'
            );
        }
        return '';
    }
    return env;
}

export function assertSupabaseConfigured(): void {
    if (!supabaseUrl || !resolvePublicAnonKey()) {
        throw new Error(
            'Supabase yapılandırılmamış. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlayın.'
        );
    }
}
