
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Debugging: Check which key is actually being loaded
if (typeof window !== 'undefined') {
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key (First 10 chars):', supabaseKey ? supabaseKey.substring(0, 10) : 'MISSING');
    // Check if it's the specific anon key we expect (starts with eyJ...)
}

export const supabase = createClient(supabaseUrl, supabaseKey);
