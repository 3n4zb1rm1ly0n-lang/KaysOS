
import { createClient } from '@supabase/supabase-js';



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://veyokbxkhyqaejautyva.supabase.co';
// HACK: Hardcoded key to bypass environment variable caching issue.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW9rYnhraHlxYWVqYXV0eXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTY2ODksImV4cCI6MjA4NTY5MjY4OX0.69XhSOD4tQnpZASl2rCngcVLfO_b68tQTI6K16S9dGY';

export const supabase = createClient(supabaseUrl, supabaseKey);
