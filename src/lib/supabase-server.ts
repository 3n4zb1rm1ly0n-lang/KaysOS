import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

/**
 * Yalnızca Route Handler / Server Actions içinden import edin.
 * Önce SUPABASE_SERVICE_ROLE_KEY, yoksa anon.
 */
export function createSupabaseServiceClient() {
    const url = supabaseUrl || 'https://placeholder.supabase.co';
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const key =
        service ||
        resolvePublicAnonKey() ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjAsImV4cCI6MH0.placeholder';
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
