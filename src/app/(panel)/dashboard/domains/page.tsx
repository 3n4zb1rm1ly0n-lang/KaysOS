'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, Globe, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { differenceInDays, format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

interface DomainRow {
    id: string;
    hostname: string;
    purchased_at: string | null;
    expires_at: string | null;
    registrar: string;
    auto_renew: boolean;
    annual_cost: number | null;
    notes: string;
    project_id: string | null;
    updated_at: string;
}

const emptyForm = () => ({
    hostname: '',
    purchased_at: '',
    expires_at: '',
    registrar: '',
    auto_renew: false,
    annual_cost: '',
    notes: '',
    project_id: ''
});

function daysUntilExpiry(expiresAt: string | null): number | null {
    if (!expiresAt) return null;
    try {
        return differenceInDays(parseISO(expiresAt), new Date());
    } catch {
        return null;
    }
}

export default function DomainsPage() {
    const [rows, setRows] = useState<DomainRow[]>([]);
    const [projectMap, setProjectMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saveError, setSaveError] = useState<string | null>(null);

    const projectOptions = useMemo(() => {
        return Object.entries(projectMap)
            .map(([id, title]) => ({ id, title }))
            .sort((a, b) => a.title.localeCompare(b.title, 'tr'));
    }, [projectMap]);

    const fetchAll = async () => {
        setLoadError(null);
        const [domRes, projRes] = await Promise.all([
            supabase.from('domains').select('*').order('expires_at', { ascending: true }),
            supabase.from('projects').select('id, title').order('title', { ascending: true })
        ]);

        if (domRes.error) {
            setRows([]);
            setLoadError(domRes.error.message);
        } else {
            setRows((domRes.data || []) as DomainRow[]);
        }

        if (!projRes.error && projRes.data) {
            const m: Record<string, string> = {};
            projRes.data.forEach((p: { id: string; title: string }) => {
                m[p.id] = p.title;
            });
            setProjectMap(m);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            await fetchAll();
            if (!cancelled) setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const openNew = () => {
        setEditingId(null);
        setForm(emptyForm());
        setSaveError(null);
        setModalOpen(true);
    };

    const openEdit = (r: DomainRow) => {
        setEditingId(r.id);
        setSaveError(null);
        setForm({
            hostname: r.hostname,
            purchased_at: r.purchased_at || '',
            expires_at: r.expires_at || '',
            registrar: r.registrar || '',
            auto_renew: !!r.auto_renew,
            annual_cost: r.annual_cost != null ? String(r.annual_cost) : '',
            notes: r.notes || '',
            project_id: r.project_id || ''
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        const host = form.hostname.trim().toLowerCase();
        if (!host) {
            setSaveError('Alan adı gerekli.');
            return;
        }

        const annual =
            form.annual_cost.trim() === '' ? null : parseFloat(form.annual_cost.replace(',', '.'));
        if (form.annual_cost.trim() !== '' && (annual == null || Number.isNaN(annual))) {
            setSaveError('Yıllık maliyet sayı olmalı.');
            return;
        }

        const body = {
            hostname: host,
            purchased_at: form.purchased_at.trim() || null,
            expires_at: form.expires_at.trim() || null,
            registrar: form.registrar.trim(),
            auto_renew: form.auto_renew,
            annual_cost: annual,
            notes: form.notes.trim(),
            project_id: form.project_id.trim() || null,
            updated_at: new Date().toISOString()
        };

        try {
            if (editingId) {
                const { error } = await supabase.from('domains').update(body).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('domains').insert([body]);
                if (error) throw error;
            }
            setModalOpen(false);
            setEditingId(null);
            setForm(emptyForm());
            await fetchAll();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Kayıt başarısız.';
            setSaveError(msg);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu domain kaydını silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('domains').delete().eq('id', id);
            if (error) throw error;
            setRows((r) => r.filter((x) => x.id !== id));
        } catch {
            alert('Silinirken hata oluştu.');
        }
    };

    const expiringSoon = rows.filter((r) => {
        const d = daysUntilExpiry(r.expires_at);
        return d != null && d >= 0 && d <= 30;
    }).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Globe className="w-8 h-8 text-primary" />
                        Domainler
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Satın alma ve yenileme tarihlerini takip edin; kayıtlar{' '}
                        <Link href="/dashboard/calendar" className="text-primary hover:underline">
                            Finansal Takvim
                        </Link>
                        ’de görünür.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openNew}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Domain ekle
                </button>
            </div>

            {!loading && !loadError && rows.length > 0 && (
                <div className="rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground flex flex-wrap gap-4 items-center">
                    <span>
                        <strong className="text-foreground">{rows.length}</strong> kayıt
                    </span>
                    {expiringSoon > 0 && (
                        <span className="text-amber-400">
                            {expiringSoon} domain 30 gün içinde yenilenecek / bitecek
                        </span>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
                </div>
            ) : loadError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive">
                    <p className="font-medium">Domainler yüklenemedi</p>
                    <p className="mt-2 opacity-90">{loadError}</p>
                    <p className="mt-3 text-muted-foreground text-xs">
                        Supabase’de <code className="text-foreground">create_domains.sql</code> dosyasını çalıştırdığınızdan emin olun.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-secondary/30 text-left text-muted-foreground">
                                    <th className="px-4 py-3 font-medium">Alan adı</th>
                                    <th className="px-4 py-3 font-medium">Kayıtçı</th>
                                    <th className="px-4 py-3 font-medium">Alınış</th>
                                    <th className="px-4 py-3 font-medium">Bitiş / yenileme</th>
                                    <th className="px-4 py-3 font-medium">Kalan</th>
                                    <th className="px-4 py-3 font-medium">Oto. yenileme</th>
                                    <th className="px-4 py-3 font-medium">Proje</th>
                                    <th className="px-4 py-3 font-medium w-28" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                                            Kayıt yok. Domain ekleyin veya takvimde görmek için en az yenileme veya alınış
                                            tarihi girin.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((r) => {
                                    const left = daysUntilExpiry(r.expires_at);
                                    const leftLabel =
                                        left == null
                                            ? '—'
                                            : left < 0
                                              ? `${Math.abs(left)} gün geçti`
                                              : `${left} gün`;
                                    const leftClass =
                                        left == null
                                            ? 'text-muted-foreground'
                                            : left < 0
                                              ? 'text-red-400 font-medium'
                                              : left <= 30
                                                ? 'text-amber-400 font-medium'
                                                : 'text-muted-foreground';

                                    return (
                                        <tr key={r.id} className="border-b border-border/80 hover:bg-secondary/20">
                                            <td className="px-4 py-3 font-medium text-foreground">{r.hostname}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{r.registrar || '—'}</td>
                                            <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                                {r.purchased_at
                                                    ? format(parseISO(r.purchased_at), 'd MMM yyyy', { locale: tr })
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                                {r.expires_at
                                                    ? format(parseISO(r.expires_at), 'd MMM yyyy', { locale: tr })
                                                    : '—'}
                                            </td>
                                            <td className={`px-4 py-3 tabular-nums ${leftClass}`}>{leftLabel}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {r.auto_renew ? 'Evet' : 'Hayır'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {r.project_id && projectMap[r.project_id] ? (
                                                    <span className="truncate max-w-[140px] inline-block align-bottom">
                                                        {projectMap[r.project_id]}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(r)}
                                                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                                                        aria-label="Düzenle"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(r.id)}
                                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
                                                        aria-label="Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
                    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-[#161B22] shadow-2xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-primary" />
                            {editingId ? 'Domaini düzenle' : 'Yeni domain'}
                        </h2>
                        {saveError && (
                            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {saveError}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Alan adı
                                </label>
                                <input
                                    required
                                    placeholder="ornek.com"
                                    value={form.hostname}
                                    onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        Satın alma
                                    </label>
                                    <input
                                        type="date"
                                        value={form.purchased_at}
                                        onChange={(e) => setForm((f) => ({ ...f, purchased_at: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        Bitiş / yenileme
                                    </label>
                                    <input
                                        type="date"
                                        value={form.expires_at}
                                        onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Kayıtçı
                                </label>
                                <input
                                    value={form.registrar}
                                    onChange={(e) => setForm((f) => ({ ...f, registrar: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                    placeholder="Namecheap, Cloudflare…"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="auto_renew"
                                    type="checkbox"
                                    checked={form.auto_renew}
                                    onChange={(e) => setForm((f) => ({ ...f, auto_renew: e.target.checked }))}
                                    className="rounded border-border"
                                />
                                <label htmlFor="auto_renew" className="text-sm text-foreground">
                                    Otomatik yenileme
                                </label>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Yıllık maliyet (₺, opsiyonel)
                                </label>
                                <input
                                    value={form.annual_cost}
                                    onChange={(e) => setForm((f) => ({ ...f, annual_cost: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    İlişkili proje
                                </label>
                                <select
                                    value={form.project_id}
                                    onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                >
                                    <option value="">— Yok —</option>
                                    {projectOptions.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Not</label>
                                <textarea
                                    rows={2}
                                    value={form.notes}
                                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                                />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModalOpen(false);
                                        setEditingId(null);
                                        setSaveError(null);
                                    }}
                                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
