'use client';

import { useEffect } from 'react';

/** Legacy route — middleware redirects to Auth0; this is a fallback. */
export default function LoginPage() {
    useEffect(() => {
        window.location.href = '/api/auth/login?returnTo=/app/dashboard';
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-[#E5E7EB]">
            <p className="text-sm text-muted-foreground">Auth0 girişine yönlendiriliyor…</p>
        </div>
    );
}
