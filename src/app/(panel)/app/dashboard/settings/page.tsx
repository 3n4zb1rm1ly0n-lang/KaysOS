'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SITE_CONTENT, type SiteContent } from '@/lib/marketing-types';

export default function SettingsPage() {
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMessage, setResetMessage] = useState<string | null>(null);

    const [siteForm, setSiteForm] = useState<SiteContent>({ ...DEFAULT_SITE_CONTENT });
    const [siteSaving, setSiteSaving] = useState(false);
    const [siteNotice, setSiteNotice] = useState<string | null>(null);

    const fetchSiteContent = async () => {
        const { data, error } = await supabase
            .from('site_content')
            .select('*')
            .eq('id', 'main')
            .maybeSingle();
        if (!error && data) {
            setSiteForm({ ...DEFAULT_SITE_CONTENT, ...data });
        }
    };

    const saveSiteContent = async () => {
        setSiteSaving(true);
        setSiteNotice(null);
        const payload = {
            id: 'main',
            about_title: siteForm.about_title || '',
            about_body: siteForm.about_body || '',
            service_1: siteForm.service_1 || '',
            service_2: siteForm.service_2 || '',
            service_3: siteForm.service_3 || '',
            contact_email: siteForm.contact_email || '',
            contact_note: siteForm.contact_note || '',
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('site_content').upsert(payload, { onConflict: 'id' });
        setSiteSaving(false);
        if (error) {
            setSiteNotice(`Kayıt başarısız: ${error.message}`);
            return;
        }
        setSiteNotice('Vitrin metinleri kaydedildi.');
    };

    useEffect(() => {
        fetchSiteContent();
    }, []);

    const handleResetDatabase = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetMessage(null);
        setResetLoading(true);
        try {
            const res = await fetch('/api/admin/reset-database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: resetPassword })
            });
            const data = await res.json();
            if (!res.ok) {
                setResetMessage(data.error || 'İşlem başarısız.');
                return;
            }
            setResetPassword('');
            setResetModalOpen(false);
            let msg = 'Veritabanı sıfırlandı.';
            if (data.failures?.length) {
                msg += ` Uyarı: ${data.failures.length} tabloda sorun oluştu. ${data.hint || ''}`;
            }
            alert(msg);
        } catch {
            setResetMessage('Ağ hatası veya sunucu yanıt vermedi.');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Ayarlar & Veri Yönetimi</h2>
                <p className="text-muted-foreground mt-1">
                    Vitrin metinlerini yönetin ve veritabanını sıfırlayın.
                </p>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden ring-1 ring-blue-500/20">
                <div className="p-6 border-b bg-secondary/10 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Vitrin (kaysia.co)</h3>
                </div>

                <div className="p-6 space-y-4 max-w-2xl">
                    <p className="text-sm text-muted-foreground">
                        Ana sayfa metinlerini buradan yönetin. Projeleri vitrine almak için Projeler
                        sayfasında &quot;Vitrinde göster&quot; işaretleyin.
                    </p>
                    {siteNotice && <p className="text-sm text-primary">{siteNotice}</p>}
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Biz — başlık</label>
                        <input
                            value={siteForm.about_title || ''}
                            onChange={(e) =>
                                setSiteForm((f) => ({ ...f, about_title: e.target.value }))
                            }
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Biz — metin</label>
                        <textarea
                            rows={3}
                            value={siteForm.about_body || ''}
                            onChange={(e) =>
                                setSiteForm((f) => ({ ...f, about_body: e.target.value }))
                            }
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                        />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                        {(['service_1', 'service_2', 'service_3'] as const).map((key, i) => (
                            <div key={key}>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Hizmet {i + 1}
                                </label>
                                <input
                                    value={siteForm[key] || ''}
                                    onChange={(e) =>
                                        setSiteForm((f) => ({ ...f, [key]: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                            </div>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                            İletişim e-posta
                        </label>
                        <input
                            type="email"
                            value={siteForm.contact_email || ''}
                            onChange={(e) =>
                                setSiteForm((f) => ({ ...f, contact_email: e.target.value }))
                            }
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                            İletişim notu
                        </label>
                        <textarea
                            rows={2}
                            value={siteForm.contact_note || ''}
                            onChange={(e) =>
                                setSiteForm((f) => ({ ...f, contact_note: e.target.value }))
                            }
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={saveSiteContent}
                        disabled={siteSaving}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                        {siteSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Kaydet
                    </button>
                </div>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden ring-1 ring-red-500/25">
                <div className="p-6 border-b bg-red-500/5 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <h3 className="font-semibold text-red-400">Tehlikeli bölge</h3>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Domainler, projeler, AI abonelikleri ve şirket finans hesap satırları kalıcı olarak
                        silinir. Bu işlem geri alınamaz. Yalnızca panel şifreniz ile yapılabilir.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setResetMessage(null);
                            setResetPassword('');
                            setResetModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Tüm verileri sıfırla…
                    </button>
                </div>
            </div>

            {resetModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75">
                    <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#161B22] shadow-2xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Veritabanını sıfırla
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Devam etmek için admin giriş şifrenizi girin. Tüm listelenen tablolar
                            boşaltılacaktır.
                        </p>
                        <form onSubmit={handleResetDatabase} className="space-y-4">
                            <div>
                                <label htmlFor="reset-db-password" className="sr-only">
                                    Şifre
                                </label>
                                <input
                                    id="reset-db-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    placeholder="Panel şifresi"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            {resetMessage && <p className="text-sm text-red-400">{resetMessage}</p>}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResetModalOpen(false);
                                        setResetPassword('');
                                        setResetMessage(null);
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary/50"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetLoading || !resetPassword}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Evet, sıfırla
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
