'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ImageUploadField } from '@/components/panel/image-upload-field';
import {
    ECOSYSTEM_KIND_LABELS,
    normalizeEcosystemKind,
    normalizeTileTone,
    parseEcosystemLinks,
    type EcosystemItem,
    type EcosystemKind,
    type EcosystemTileTone
} from '@/lib/ecosystem-types';
import { Loader2, Plus, Pencil, Trash2, Blocks } from 'lucide-react';

type FormState = {
    name: string;
    kind: EcosystemKind;
    logo_url: string;
    summary: string;
    body: string;
    links: { label: string; url: string }[];
    sort_order: string;
    visible: boolean;
    tile_tone: EcosystemTileTone;
};

const emptyForm = (): FormState => ({
    name: '',
    kind: 'technology',
    logo_url: '',
    summary: '',
    body: '',
    links: [{ label: '', url: '' }],
    sort_order: '0',
    visible: true,
    tile_tone: 'light'
});

export default function EcosystemAdminPage() {
    const [items, setItems] = useState<EcosystemItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, err } = await (async () => {
            const res = await supabase
                .from('ecosystem_items')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });
            return { data: res.data, err: res.error };
        })();

        if (err) {
            setError(
                err.message.includes('ecosystem_items')
                    ? `${err.message} — SQL Editor’da create_ecosystem_items.sql çalıştırın.`
                    : err.message
            );
            setItems([]);
        } else {
            setItems(
                (data || []).map((row) => ({
                    id: row.id,
                    name: row.name,
                    kind: normalizeEcosystemKind(row.kind),
                    logo_url: row.logo_url || '',
                    summary: row.summary || '',
                    body: row.body || '',
                    links: parseEcosystemLinks(row.links),
                    sort_order: Number(row.sort_order) || 0,
                    visible: row.visible !== false,
                    tile_tone: normalizeTileTone(row.tile_tone)
                }))
            );
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchItems();
    }, [fetchItems]);

    const openNew = () => {
        setEditingId(null);
        setForm(emptyForm());
        setSaveError(null);
        setModalOpen(true);
    };

    const openEdit = (item: EcosystemItem) => {
        setEditingId(item.id);
        setSaveError(null);
        const links = parseEcosystemLinks(item.links);
        setForm({
            name: item.name,
            kind: normalizeEcosystemKind(item.kind),
            logo_url: item.logo_url || '',
            summary: item.summary || '',
            body: item.body || '',
            links: links.length ? links : [{ label: '', url: '' }],
            sort_order: String(item.sort_order ?? 0),
            visible: item.visible !== false,
            tile_tone: normalizeTileTone(item.tile_tone)
        });
        setModalOpen(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setSaveError('Ad gerekli.');
            return;
        }
        setSaving(true);
        setSaveError(null);

        const payload = {
            name: form.name.trim(),
            kind: form.kind,
            logo_url: form.logo_url.trim(),
            summary: form.summary.trim(),
            body: form.body.trim(),
            links: form.links
                .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
                .filter((l) => l.label && l.url),
            sort_order: Number.parseInt(form.sort_order, 10) || 0,
            visible: form.visible,
            tile_tone: form.tile_tone
        };

        const res = editingId
            ? await supabase.from('ecosystem_items').update(payload).eq('id', editingId)
            : await supabase.from('ecosystem_items').insert([payload]);

        setSaving(false);
        if (res.error) {
            setSaveError(res.error.message);
            return;
        }
        setModalOpen(false);
        await fetchItems();
    };

    const remove = async (id: string) => {
        if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
        const { error: err } = await supabase.from('ecosystem_items').delete().eq('id', id);
        if (err) {
            alert(err.message);
            return;
        }
        await fetchItems();
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Blocks className="w-7 h-7 text-primary" />
                        Teknolojiler & Partnerlikler
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Site İşler bölümündeki izometrik kareleri buradan yönetin. Detay modalı ve logo
                        yükleme desteklenir.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openNew}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                    <Plus className="w-4 h-4" />
                    Ekle
                </button>
            </div>

            {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </p>
            )}

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8">
                    Henüz kayıt yok. Ekle veya SQL seed’i çalıştırın.
                </p>
            ) : (
                <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/20"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                                {item.logo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.logo_url}
                                        alt=""
                                        className="max-h-8 max-w-8 object-contain"
                                    />
                                ) : (
                                    <span className="text-sm font-medium text-primary">
                                        {item.name.slice(0, 1)}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-foreground truncate">
                                        {item.name}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                        {ECOSYSTEM_KIND_LABELS[item.kind]}
                                    </span>
                                    {!item.visible && (
                                        <span className="text-[10px] text-amber-400">Gizli</span>
                                    )}
                                </div>
                                {item.summary && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {item.summary}
                                    </p>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                #{item.sort_order ?? 0}
                            </span>
                            <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                aria-label="Düzenle"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(item.id)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                aria-label="Sil"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-[#161B22] shadow-2xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white">
                            {editingId ? 'Kaydı düzenle' : 'Yeni kayıt'}
                        </h3>
                        <form onSubmit={save} className="space-y-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Ad</label>
                                <input
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, name: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">
                                        Tür
                                    </label>
                                    <select
                                        value={form.kind}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                kind: e.target.value as EcosystemKind
                                            }))
                                        }
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="technology">Teknoloji</option>
                                        <option value="partner">Partnerlik</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">
                                        Kare tonu
                                    </label>
                                    <select
                                        value={form.tile_tone}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                tile_tone: e.target.value as EcosystemTileTone
                                            }))
                                        }
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="light">Açık</option>
                                        <option value="dark">Koyu (beyaz logo için)</option>
                                    </select>
                                </div>
                            </div>

                            <ImageUploadField
                                label="Logo"
                                folder="logos"
                                value={form.logo_url}
                                onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
                                hint="Sürükle-bırak veya dosya seç. İstersen URL yapıştır."
                            />

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Kısa özet
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.summary}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, summary: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Detay (modal)
                                </label>
                                <textarea
                                    rows={4}
                                    value={form.body}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, body: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">Linkler</p>
                                {form.links.map((link, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            placeholder="Etiket"
                                            value={link.label}
                                            onChange={(e) =>
                                                setForm((f) => {
                                                    const next = [...f.links];
                                                    next[idx] = {
                                                        ...next[idx],
                                                        label: e.target.value
                                                    };
                                                    return { ...f, links: next };
                                                })
                                            }
                                            className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                        />
                                        <input
                                            placeholder="https://..."
                                            value={link.url}
                                            onChange={(e) =>
                                                setForm((f) => {
                                                    const next = [...f.links];
                                                    next[idx] = {
                                                        ...next[idx],
                                                        url: e.target.value
                                                    };
                                                    return { ...f, links: next };
                                                })
                                            }
                                            className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                        />
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setForm((f) => ({
                                            ...f,
                                            links: [...f.links, { label: '', url: '' }]
                                        }))
                                    }
                                    className="text-xs text-primary hover:underline"
                                >
                                    + Link
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">
                                        Sıra
                                    </label>
                                    <input
                                        type="number"
                                        value={form.sort_order}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                sort_order: e.target.value
                                            }))
                                        }
                                        className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-sm pt-5">
                                    <input
                                        type="checkbox"
                                        checked={form.visible}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                visible: e.target.checked
                                            }))
                                        }
                                        className="rounded border-border"
                                    />
                                    Sitede göster
                                </label>
                            </div>

                            {saveError && (
                                <p className="text-sm text-red-400">{saveError}</p>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary/50"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
