
import { createClient } from '@supabase/supabase-js';



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://veyokbxkhyqaejautyva.supabase.co';
// HACK: Hardcoded key to bypass environment variable caching issue.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW9rYnhraHlxYWVqYXV0eXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTY2ODksImV4cCI6MjA4NTY5MjY4OX0.69XhSOD4tQnpZASl2rCngcVLfO_b68tQTI6K16S9dGY';

<<<<<<< HEAD
const resolvedAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseKey;

export const supabase = createClient(supabaseUrl, resolvedAnonKey);

/** Sunucu: mümkünse service role (RLS bypass), yoksa anon. Toplu silme için service role önerilir. */
export function createSupabaseServiceClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || resolvedAnonKey;
    return createClient(supabaseUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
=======
export const supabase = createClient(supabaseUrl, supabaseKey);
>>>>>>> 8db5aab1423f0508f866588907576cd57d3b8583
