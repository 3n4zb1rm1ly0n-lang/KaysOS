import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Panel çıkışı — Supabase oturumu + eski cookie. */
export async function signOutAndRedirect(redirectTo = '/') {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    document.cookie = 'auth=; path=/; max-age=0';
    window.location.href = redirectTo;
}
