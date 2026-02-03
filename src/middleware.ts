
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const authCookie = request.cookies.get('auth');
    const { pathname } = request.nextUrl;

    // If user is on login page and authenticated, redirect to dashboard
    if (pathname === '/login') {
        if (authCookie && authCookie.value === 'true') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    // Protect /dashboard and all subroutes
    if (pathname.startsWith('/dashboard')) {
        if (!authCookie || authCookie.value !== 'true') {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // Redirect / to /login if not authenticated, or /dashboard if authenticated
    if (pathname === '/') {

        // Check if auth cookie is valid 'true'
        if (authCookie && authCookie.value === 'true') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*', '/login'],
};
