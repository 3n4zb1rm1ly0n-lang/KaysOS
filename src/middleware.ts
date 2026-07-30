import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const { response, user } = await updateSession(request);

    // Eski şifre cookie’sini temizle
    if (request.cookies.get('auth')?.value) {
        response.cookies.set('auth', '', { path: '/', maxAge: 0 });
    }

    if (pathname === '/login') {
        if (user) {
            return NextResponse.redirect(new URL('/app/dashboard', request.url));
        }
        return response;
    }

    if (pathname.startsWith('/app')) {
        if (!user) {
            const login = new URL('/login', request.url);
            login.searchParams.set('returnTo', pathname);
            return NextResponse.redirect(login);
        }
        return response;
    }

    if (pathname.startsWith('/api/admin')) {
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return response;
    }

    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        const target = pathname.replace(/^\/dashboard/, '/app/dashboard');
        return NextResponse.redirect(new URL(target, request.url));
    }

    return response;
}

export const config = {
    matcher: ['/login', '/app/:path*', '/dashboard/:path*', '/api/admin/:path*']
};
