import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

export const supabase = createClient(supabaseUrl, resolvePublicAnonKey());
