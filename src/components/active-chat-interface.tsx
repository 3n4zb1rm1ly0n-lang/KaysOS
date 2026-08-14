'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = 'user' | 'assistant';

type ChatMessage = {
    role: Role;
    content: string;
    usage?: {
        model: string;
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cost_usd: number;
        tool_rounds: number;
    };
};

function fmtUsd(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

const SUGGESTIONS = [
    'Bu ay paket prim özetini yorumla.',
    'Aylık kazançta son 3 ayı karşılaştır.',
    'Yaklaşan domain yenilemelerini listele.',
    'Aktif ve bekleyen projeleri özetle.'
];

export function ActiveChatInterface({
    className,
    onClose
}: {
    className?: string;
    onClose?: () => void;
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState<boolean | null>(null);
    const [model, setModel] = useState('gpt-4o-mini');
    const [dataHint, setDataHint] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void fetch('/api/assistant')
            .then((r) => r.json())
            .then((d) => {
                setReady(Boolean(d.ok));
                if (typeof d.model === 'string') setModel(d.model);
                const sb = d.supabase as
                    | {
                          paket_prim_days?: boolean;
                          paket_prim_error?: string | null;
                          has_service_role?: boolean;
                      }
                    | undefined;
                if (sb && sb.paket_prim_days === false) {
                    setDataHint(
                        sb.paket_prim_error ||
                            'Paket prim tablosuna erişilemiyor. create_paket_prim_days.sql ve Vercel Supabase env’lerini kontrol et.'
                    );
                } else if (sb && sb.has_service_role === false) {
                    setDataHint(
                        'SUPABASE_SERVICE_ROLE_KEY Vercel’de yok; anon ile denenecek. Okuma sorununda service role ekle.'
                    );
                }
            })
            .catch(() => setReady(false));
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const next = [...messages, userMessage];
        setMessages(next);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: next.map((m) => ({ role: m.role, content: m.content }))
                })
            });
            const data = (await response.json()) as {
                content?: string;
                error?: string;
                usage?: ChatMessage['usage'];
            };
            if (!response.ok) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: data.error || 'İstek başarısız.'
                    }
                ]);
                return;
            }
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.content || 'Yanıt boş.',
                    usage: data.usage
                }
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: 'Bağlantı hatası. Dev sunucusunun çalıştığından emin ol.'
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn('flex flex-col h-full min-h-0', className)}>
            {onClose && (
                <div className="flex justify-end px-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary/50"
                        aria-label="Kapat"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 p-4 md:p-5">
                {ready === false && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 space-y-2">
                        <p className="font-medium">OpenAI anahtarı sunucuda yok.</p>
                        <p>
                            <strong>Canlı site:</strong> Vercel → Project → Settings → Environment
                            Variables → <code className="text-xs">OPENAI_API_KEY</code> ekle
                            (Production) → Redeploy.
                        </p>
                        <p>
                            <strong>Yerel:</strong> proje kökünde <code className="text-xs">.env</code>{' '}
                            dosyasına koy, Cursor terminalinde <code className="text-xs">npm run
                            dev</code>’i durdurup yeniden başlat. Canlı için yerel .env yetmez.
                        </p>
                    </div>
                )}

                {dataHint && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                        {dataHint}
                    </div>
                )}

                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary/30">
                            <Bot className="w-7 h-7 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">KaysOS asistan</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                ChatGPT ({model}) Supabase verilerini okuyup yorumlar. Yazma yok.
                                Her yanıtın token maliyeti kaydedilir.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => void send(s)}
                                    className="p-3 text-left text-xs rounded-xl border border-border hover:bg-secondary/50 text-muted-foreground"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                                msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'bg-secondary/40 border border-border rounded-tl-sm'
                            }`}
                        >
                            {msg.content}
                            {msg.usage && (
                                <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground tabular-nums">
                                    {msg.usage.total_tokens} token · {fmtUsd(msg.usage.cost_usd)} ·{' '}
                                    {msg.usage.model}
                                    {msg.usage.tool_rounds > 0
                                        ? ` · ${msg.usage.tool_rounds} veri turu`
                                        : ''}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Veriler okunuyor…
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                }}
                className="flex gap-2 p-4 border-t border-border bg-background"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Sor: bu ay net kazanç, prim, domain…"
                    disabled={loading}
                    className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-3 py-2.5 disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>

            <p className="px-4 pb-3 text-[11px] text-muted-foreground">
                Maliyet dökümü:{' '}
                <Link href="/app/dashboard/ai-usage" className="text-primary hover:underline">
                    AI kullanım
                </Link>
            </p>
        </div>
    );
}
