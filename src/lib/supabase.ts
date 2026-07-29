import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

const url = supabaseUrl;
const key = resolvePublicAnonKey();

if (!url || !key) {
    if (typeof console !== 'undefined' && console.error) {
        console.error(
            '[Kaysia] Supabase env eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı (Vercel’de kaydettikten sonra Redeploy).'
        );
    }
}

export const supabase = createClient(
    url || 'https://placeholder.supabase.co',
    key || 'missing-anon-key'
);
