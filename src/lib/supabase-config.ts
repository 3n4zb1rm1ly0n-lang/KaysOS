/** Ortak URL ve anon anahtar (tarayıcıda yalnızca anon; service_role asla NEXT_PUBLIC olmamalı). */

export const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://veyokbxkhyqaejautyva.supabase.co';

/** Gömülü varsayılan: JWT içinde role=anon olmalı (tarayıcı güvenli). */
export const embeddedAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW9rYnhraHlxYWVqYXV0eXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTY2ODksImV4cCI6MjA4NTY5MjY4OX0.69XhSOD4tQnpZASl2rCngcVLfO_b68tQTI6K16S9dGY';

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
            // split('') — string spread [...s] eski TS hedeflerinde downlevelIteration ister
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
 * İstemci + SSR’de kullanılacak anahtar. Env’de yanlışlıkla service_role varsa
 * Supabase "Forbidden use of secret API key in browser" verir; bu durumda gömülü anon’a düşer.
 */
export function resolvePublicAnonKey(): string {
    const env = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!env) return embeddedAnonKey;
    const role = decodeJwtPayload(env)?.role;
    if (role === 'service_role') {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(
                '[KaysOS] NEXT_PUBLIC_SUPABASE_ANON_KEY bir service_role (gizli) anahtarı; tarayıcıda yasak. ' +
                    'Supabase Dashboard → Project Settings → API → "anon" "public" anahtarını Vercel’de NEXT_PUBLIC_SUPABASE_ANON_KEY olarak kullanın. ' +
                    'Geçici olarak gömülü anon anahtar kullanılıyor.'
            );
        }
        return embeddedAnonKey;
    }
    return env;
}
