import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Geçici: cookie auth (şifre). Auth0 / Supabase Auth sonra eklenecek. */
function isAuthed(request: NextRequest): boolean {
    return request.cookies.get('auth')?.value === 'true';
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Login: oturum varsa panele
    if (pathname === '/login') {
        if (isAuthed(request)) {
            return NextResponse.redirect(new URL('/app/dashboard', request.url));
        }
        return NextResponse.next();
    }

    // /app koruması
    if (pathname.startsWith('/app')) {
        if (!isAuthed(request)) {
            const login = new URL('/login', request.url);
            login.searchParams.set('returnTo', pathname);
            return NextResponse.redirect(login);
        }
        return NextResponse.next();
    }

    // Admin API
    if (pathname.startsWith('/api/admin')) {
        if (!isAuthed(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.next();
    }

    // Eski /dashboard → /app/dashboard
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        const target = pathname.replace(/^\/dashboard/, '/app/dashboard');
        return NextResponse.redirect(new URL(target, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/login', '/app/:path*', '/dashboard/:path*', '/api/admin/:path*']
};
