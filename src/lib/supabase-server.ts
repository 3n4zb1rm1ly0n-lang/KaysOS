import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

/**
 * Yalnızca Route Handler / Server Actions içinden import edin.
 * Önce SUPABASE_SERVICE_ROLE_KEY (Vercel’de Secret, NEXT_PUBLIC değil), yoksa anon.
 */
export function createSupabaseServiceClient() {
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const key = service || resolvePublicAnonKey();
    return createClient(supabaseUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
