import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = resolvePublicAnonKey() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjAsImV4cCI6MH0.placeholder';

export const supabase = createClient(url, key);
