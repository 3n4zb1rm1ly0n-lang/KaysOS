'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Trash2, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ContactMessage = {
    id: string;
    created_at: string;
    name: string;
    email: string | null;
    phone: string | null;
    message: string;
    source: string;
    is_read: boolean;
};

function fmtDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('tr-TR', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch {
        return iso;
    }
}

export default function MessagesPage() {
    const [rows, setRows] = useState<ContactMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });
        if (err) {
            setError(
                err.message.includes('contact_messages')
                    ? 'Mesaj tablosu yok. Supabase SQL Editor’da create_contact_messages.sql çalıştırın.'
                    : err.message
            );
            setRows([]);
        } else {
            setRows((data || []) as ContactMessage[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const markRead = async (id: string, is_read: boolean) => {
        setBusyId(id);
        const { error: err } = await supabase
            .from('contact_messages')
            .update({ is_read })
            .eq('id', id);
        setBusyId(null);
        if (err) {
            setError(err.message);
            return;
        }
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_read } : r)));
    };

    const markAllRead = async () => {
        const { error: err } = await supabase
            .from('contact_messages')
            .update({ is_read: true })
            .eq('is_read', false);
        if (err) {
            setError(err.message);
            return;
        }
        setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
    };

    const remove = async (id: string) => {
        if (!confirm('Bu mesaj silinsin mi?')) return;
        setBusyId(id);
        const { error: err } = await supabase.from('contact_messages').delete().eq('id', id);
        setBusyId(null);
        if (err) {
            setError(err.message);
            return;
        }
        setRows((prev) => prev.filter((r) => r.id !== id));
    };

    const unread = rows.filter((r) => !r.is_read).length;

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Mail className="w-7 h-7 text-primary" />
                        Mesajlar
                        {unread > 0 && (
                            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                                {unread}
                            </span>
                        )}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Siteden gelen iletişim formu mesajları
                    </p>
                </div>
                {unread > 0 && (
                    <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary"
                    >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Tümünü okundu say
                    </button>
                )}
            </div>

            {error && (
                <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                    {error}
                </p>
            )}

            {loading ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-xl">
                    Henüz mesaj yok.
                </p>
            ) : (
                <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {rows.map((row) => (
                        <li
                            key={row.id}
                            className={`p-4 space-y-3 ${
                                row.is_read ? 'bg-background' : 'bg-red-500/5'
                            }`}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {!row.is_read && (
                                            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                                        )}
                                        <p className="font-medium truncate">
                                            {row.name.trim() || 'İsimsiz'}
                                        </p>
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {row.source}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {fmtDate(row.created_at)}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        disabled={busyId === row.id}
                                        onClick={() => void markRead(row.id, !row.is_read)}
                                        className="text-xs rounded-md border border-border px-2 py-1 hover:bg-secondary disabled:opacity-50"
                                    >
                                        {row.is_read ? 'Okunmadı' : 'Okundu'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busyId === row.id}
                                        onClick={() => void remove(row.id)}
                                        className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                                        aria-label="Sil"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <dl className="text-sm space-y-1">
                                {row.email && (
                                    <div className="flex gap-2">
                                        <dt className="text-muted-foreground shrink-0">E-posta</dt>
                                        <dd>
                                            <a
                                                href={`mailto:${row.email}`}
                                                className="text-primary hover:underline"
                                            >
                                                {row.email}
                                            </a>
                                        </dd>
                                    </div>
                                )}
                                {row.phone && (
                                    <div className="flex gap-2">
                                        <dt className="text-muted-foreground shrink-0">Telefon</dt>
                                        <dd>
                                            <a
                                                href={`tel:${row.phone}`}
                                                className="hover:underline"
                                            >
                                                {row.phone}
                                            </a>
                                        </dd>
                                    </div>
                                )}
                            </dl>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed border-t border-border/60 pt-3">
                                {row.message}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
