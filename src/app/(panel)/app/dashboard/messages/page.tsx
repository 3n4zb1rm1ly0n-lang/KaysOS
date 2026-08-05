'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, Lightbulb, Loader2, Mail, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Tab = 'contact' | 'ideas';

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

type IdeaNote = {
    id: string;
    created_at: string;
    body: string;
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
    const [tab, setTab] = useState<Tab>('contact');
    const [contacts, setContacts] = useState<ContactMessage[]>([]);
    const [ideas, setIdeas] = useState<IdeaNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        const [cRes, iRes] = await Promise.all([
            supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
            supabase.from('idea_notes').select('*').order('created_at', { ascending: false })
        ]);

        const errors: string[] = [];
        if (cRes.error) {
            errors.push(
                cRes.error.message.includes('contact_messages')
                    ? 'İletişim tablosu yok (create_contact_messages.sql).'
                    : cRes.error.message
            );
            setContacts([]);
        } else {
            setContacts((cRes.data || []) as ContactMessage[]);
        }

        if (iRes.error) {
            errors.push(
                iRes.error.message.includes('idea_notes') || iRes.error.code === '42P01'
                    ? 'Fikir tablosu yok (create_idea_notes.sql).'
                    : iRes.error.message
            );
            setIdeas([]);
        } else {
            setIdeas((iRes.data || []) as IdeaNote[]);
        }

        setError(errors.length ? errors.join(' ') : null);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const unreadContact = contacts.filter((r) => !r.is_read).length;
    const unreadIdeas = ideas.filter((r) => !r.is_read).length;
    const unread = tab === 'contact' ? unreadContact : unreadIdeas;

    const markContactRead = async (id: string, is_read: boolean) => {
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
        setContacts((prev) => prev.map((r) => (r.id === id ? { ...r, is_read } : r)));
    };

    const markIdeaRead = async (id: string, is_read: boolean) => {
        setBusyId(id);
        const { error: err } = await supabase.from('idea_notes').update({ is_read }).eq('id', id);
        setBusyId(null);
        if (err) {
            setError(err.message);
            return;
        }
        setIdeas((prev) => prev.map((r) => (r.id === id ? { ...r, is_read } : r)));
    };

    const markAllRead = async () => {
        if (tab === 'contact') {
            const { error: err } = await supabase
                .from('contact_messages')
                .update({ is_read: true })
                .eq('is_read', false);
            if (err) {
                setError(err.message);
                return;
            }
            setContacts((prev) => prev.map((r) => ({ ...r, is_read: true })));
        } else {
            const { error: err } = await supabase
                .from('idea_notes')
                .update({ is_read: true })
                .eq('is_read', false);
            if (err) {
                setError(err.message);
                return;
            }
            setIdeas((prev) => prev.map((r) => ({ ...r, is_read: true })));
        }
    };

    const removeContact = async (id: string) => {
        if (!confirm('Bu mesaj silinsin mi?')) return;
        setBusyId(id);
        const { error: err } = await supabase.from('contact_messages').delete().eq('id', id);
        setBusyId(null);
        if (err) {
            setError(err.message);
            return;
        }
        setContacts((prev) => prev.filter((r) => r.id !== id));
    };

    const removeIdea = async (id: string) => {
        if (!confirm('Bu fikir silinsin mi?')) return;
        setBusyId(id);
        const { error: err } = await supabase.from('idea_notes').delete().eq('id', id);
        setBusyId(null);
        if (err) {
            setError(err.message);
            return;
        }
        setIdeas((prev) => prev.filter((r) => r.id !== id));
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Mail className="w-7 h-7 text-primary" />
                        Mesajlar
                        {unreadContact + unreadIdeas > 0 && (
                            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                                {unreadContact + unreadIdeas}
                            </span>
                        )}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        İletişim formu ve App fikir notları
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

            <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/20">
                <button
                    type="button"
                    onClick={() => setTab('contact')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        tab === 'contact'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Mail className="w-3.5 h-3.5" />
                    İletişim
                    {unreadContact > 0 && (
                        <span className="ml-0.5 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] text-white">
                            {unreadContact}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setTab('ideas')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        tab === 'ideas'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Fikirler
                    {unreadIdeas > 0 && (
                        <span className="ml-0.5 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] text-white">
                            {unreadIdeas}
                        </span>
                    )}
                </button>
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
            ) : tab === 'contact' ? (
                contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-xl">
                        Henüz iletişim mesajı yok.
                    </p>
                ) : (
                    <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                        {contacts.map((row) => (
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
                                            onClick={() => void markContactRead(row.id, !row.is_read)}
                                            className="text-xs rounded-md border border-border px-2 py-1 hover:bg-secondary disabled:opacity-50"
                                        >
                                            {row.is_read ? 'Okunmadı' : 'Okundu'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === row.id}
                                            onClick={() => void removeContact(row.id)}
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
                                                <a href={`tel:${row.phone}`} className="hover:underline">
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
                )
            ) : ideas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-xl">
                    Henüz fikir notu yok. Sağ alttaki ampul ile ekle.
                </p>
            ) : (
                <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {ideas.map((row) => (
                        <li
                            key={row.id}
                            className={`p-4 space-y-3 ${
                                row.is_read ? 'bg-background' : 'bg-primary/5'
                            }`}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {!row.is_read && (
                                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                        )}
                                        <p className="font-medium flex items-center gap-1.5">
                                            <Lightbulb className="w-4 h-4 text-primary" />
                                            Fikir
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {fmtDate(row.created_at)}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        disabled={busyId === row.id}
                                        onClick={() => void markIdeaRead(row.id, !row.is_read)}
                                        className="text-xs rounded-md border border-border px-2 py-1 hover:bg-secondary disabled:opacity-50"
                                    >
                                        {row.is_read ? 'Okunmadı' : 'Okundu'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busyId === row.id}
                                        onClick={() => void removeIdea(row.id)}
                                        className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                                        aria-label="Sil"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed border-t border-border/60 pt-3">
                                {row.body}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
