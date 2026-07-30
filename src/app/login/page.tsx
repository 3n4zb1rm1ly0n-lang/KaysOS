'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const supabase = createSupabaseBrowserClient();
        const { error: signError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (signError) {
            setError(
                signError.message === 'Invalid login credentials'
                    ? 'E-posta veya şifre hatalı'
                    : signError.message
            );
            setLoading(false);
            return;
        }

        // Eski cookie auth kalıntısı
        document.cookie = 'auth=; path=/; max-age=0';

        const returnTo = searchParams.get('returnTo') || '/app/dashboard';
        router.push(returnTo.startsWith('/app') ? returnTo : '/app/dashboard');
        router.refresh();
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
                        E-posta ve şifrenizle giriş yapın
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="sr-only">
                            E-posta
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError('');
                            }}
                            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                            placeholder="E-posta"
                        />
                    </div>
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
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 transition disabled:opacity-60"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
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
