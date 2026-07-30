import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

/** Server Components / Route Handlers — cookie oturumu. */
export function createSupabaseServerClient() {
    const cookieStore = cookies();
    const url = supabaseUrl || 'https://placeholder.supabase.co';
    const key = resolvePublicAnonKey() || 'missing-anon-key';

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // Server Component’te set yok sayılabilir; middleware yeniler.
                }
            }
        }
    });
}
