import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0/edge';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const res = NextResponse.next();

    // Legacy cookie auth → send to Auth0 login
    if (pathname === '/login') {
        const returnTo = request.nextUrl.searchParams.get('returnTo') || '/app/dashboard';
        const login = new URL('/api/auth/login', request.url);
        login.searchParams.set('returnTo', returnTo);
        return NextResponse.redirect(login);
    }

    // Protect /app (panel) — Auth0 session required
    if (pathname.startsWith('/app')) {
        const session = await getSession(request, res);
        if (!session?.user) {
            const login = new URL('/api/auth/login', request.url);
            login.searchParams.set('returnTo', pathname);
            return NextResponse.redirect(login);
        }
        return res;
    }

    // Protect admin API
    if (pathname.startsWith('/api/admin')) {
        const session = await getSession(request, res);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return res;
    }

    // Legacy /dashboard → /app/dashboard
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        const target = pathname.replace(/^\/dashboard/, '/app/dashboard');
        return NextResponse.redirect(new URL(target, request.url));
    }

    return res;
}

export const config = {
    matcher: [
        '/login',
        '/app/:path*',
        '/dashboard/:path*',
        '/api/admin/:path*'
    ]
};
