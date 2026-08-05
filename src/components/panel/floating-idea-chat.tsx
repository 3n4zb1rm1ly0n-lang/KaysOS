'use client';

import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Loader2, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Bubble = {
    id: string;
    role: 'user' | 'system';
    text: string;
};

/**
 * Mobil fikir yakalama: her gönderi = 1 kayıt (idea_notes).
 * Chat state oturumluk — kapanınca / unmount’ta sıfırlanır.
 */
export function FloatingIdeaChat() {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [bubbles, setBubbles] = useState<Bubble[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!open) {
            setBubbles([]);
            setDraft('');
            setError(null);
            return;
        }
        const t = window.setTimeout(() => inputRef.current?.focus(), 100);
        return () => window.clearTimeout(t);
    }, [open]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [bubbles, open]);

    const send = async () => {
        const text = draft.trim();
        if (!text || sending) return;

        const userBubble: Bubble = {
            id: `u-${Date.now()}`,
            role: 'user',
            text
        };
        setBubbles((prev) => [...prev, userBubble]);
        setDraft('');
        setSending(true);
        setError(null);

        const { error: err } = await supabase.from('idea_notes').insert({ body: text });

        setSending(false);
        if (err) {
            setError(
                err.message.includes('idea_notes') || err.code === '42P01'
                    ? 'Tablo yok. Supabase’te create_idea_notes.sql çalıştırın.'
                    : err.message
            );
            setBubbles((prev) => [
                ...prev,
                {
                    id: `e-${Date.now()}`,
                    role: 'system',
                    text: 'Kaydedilemedi. Tekrar dene.'
                }
            ]);
            return;
        }

        setBubbles((prev) => [
            ...prev,
            {
                id: `s-${Date.now()}`,
                role: 'system',
                text: 'Kaydedildi → Mesajlar / Fikirler'
            }
        ]);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    };

    return (
        <>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-end md:justify-end md:p-6">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm md:bg-black/30"
                        aria-label="Kapat"
                        onClick={() => setOpen(false)}
                    />

                    <div
                        className={cn(
                            'relative z-10 flex w-full flex-col border border-border bg-[#0B0F14] shadow-2xl',
                            'max-md:h-[78vh] max-md:rounded-t-2xl',
                            'md:h-[520px] md:w-[380px] md:rounded-2xl'
                        )}
                    >
                        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <Lightbulb className="h-5 w-5 text-primary shrink-0" />
                                <div className="min-w-0">
                                    <h2 className="text-sm font-semibold truncate">Fikir notu</h2>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        Her gönderi Mesajlar’a kaydolur · chat sıfırlanır
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                aria-label="Kapat"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            {bubbles.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-10 px-4">
                                    Aklına gelen fikri veya yapılacakı yaz, gönder.
                                    Sayfa kapanınca burası boşalır; kayıtlar kalır.
                                </p>
                            )}
                            {bubbles.map((b) => (
                                <div
                                    key={b.id}
                                    className={cn(
                                        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
                                        b.role === 'user'
                                            ? 'ml-auto bg-primary text-primary-foreground rounded-br-md'
                                            : 'mr-auto bg-secondary/60 text-foreground rounded-bl-md'
                                    )}
                                >
                                    {b.text}
                                </div>
                            ))}
                            <div ref={endRef} />
                        </div>

                        {error && (
                            <p className="px-4 pb-1 text-xs text-red-400">{error}</p>
                        )}

                        <div className="border-t border-border p-3 flex gap-2 items-end">
                            <textarea
                                ref={inputRef}
                                rows={2}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder="Fikir veya yapılacak…"
                                disabled={sending}
                                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 max-h-28"
                            />
                            <button
                                type="button"
                                disabled={sending || !draft.trim()}
                                onClick={() => void send()}
                                className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                                aria-label="Gönder"
                            >
                                {sending ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={cn(
                        'fixed z-[90] flex h-14 w-14 items-center justify-center rounded-full',
                        'bg-primary text-primary-foreground shadow-lg',
                        'hover:opacity-90 active:scale-95 transition',
                        'bottom-6 right-6 md:bottom-8 md:right-8',
                        'ring-1 ring-white/10'
                    )}
                    aria-label="Fikir notu aç"
                >
                    <Lightbulb className="h-6 w-6" />
                </button>
            )}
        </>
    );
}
