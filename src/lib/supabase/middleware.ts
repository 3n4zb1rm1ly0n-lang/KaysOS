import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';

/**
 * Middleware: oturumu doğrula / yenile, cookie’leri response’a yaz.
 * Korumalı rotalar için `user` döner.
 */
export async function updateSession(request: NextRequest): Promise<{
    response: NextResponse;
    user: { id: string; email?: string | null } | null;
}> {
    let response = NextResponse.next({ request });

    const url = supabaseUrl;
    const key = resolvePublicAnonKey();
    if (!url || !key) {
        return { response, user: null };
    }

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                );
            }
        }
    });

    const {
        data: { user }
    } = await supabase.auth.getUser();

    return { response, user };
}
