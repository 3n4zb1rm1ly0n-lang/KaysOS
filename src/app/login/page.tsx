'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { DEFAULT_ADMIN_PASSWORD } from '@/lib/admin-password';
import { Suspense } from 'react';

function LoginForm() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const expected =
            process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
        if (password === expected) {
            document.cookie = 'auth=true; path=/; max-age=86400; SameSite=Lax';
            const returnTo = searchParams.get('returnTo') || '/app/dashboard';
            router.push(returnTo.startsWith('/app') ? returnTo : '/app/dashboard');
        } else {
            setError('Hatalı şifre');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-[#E5E7EB]">
            <div className="w-full max-w-sm p-8 space-y-8 bg-[#161B22] rounded-2xl shadow-2xl border border-gray-800">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Kaysia App</h2>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Devam etmek için şifreyi girin
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="sr-only">
                            Şifre
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                            placeholder="Şifre"
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-400">{error}</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 transition"
                    >
                        Giriş Yap
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-[#E5E7EB]">
                    <p className="text-sm text-muted-foreground">Yükleniyor…</p>
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
