import { createBrowserClient } from '@supabase/ssr';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

/** Tarayıcı: oturum cookie ile (@supabase/ssr). */
export function createSupabaseBrowserClient() {
    const url = supabaseUrl || 'https://placeholder.supabase.co';
    const key = resolvePublicAnonKey() || 'missing-anon-key';
    return createBrowserClient(url, key);
}
