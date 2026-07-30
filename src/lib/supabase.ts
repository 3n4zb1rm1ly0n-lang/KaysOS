import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Tarayıcı Supabase istemcisi (cookie oturumu).
 * Panel sayfalarında `import { supabase } from '@/lib/supabase'` ile kullanın.
 */
export const supabase = createSupabaseBrowserClient();
