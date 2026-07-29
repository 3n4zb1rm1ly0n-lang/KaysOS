'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Loader2,
    Plus,
    Pencil,
    Trash2,
    Sparkles,
    FolderKanban
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { syncProjectDomain } from '@/lib/project-domain-sync';
import { ImageUploadField } from '@/components/panel/image-upload-field';
import { MultiImageUploadField } from '@/components/panel/multi-image-upload-field';
import { parseShowcaseGallery } from '@/lib/marketing-types';

type ProjectStatus =
    | 'idea'
    | 'potential'
    | 'ongoing'
    | 'on_hold'
    | 'completed'
    | 'cancelled';

type ProjectAccount = { tag: string; email: string };

interface ProjectRow {
    id: string;
    created_at: string;
    updated_at: string;
    title: string;
    description: string | null;
    status: ProjectStatus;
    notes: string | null;
    use_domain?: boolean;
    domain_detail?: string | null;
    target_end_date?: string | null;
    showcase?: boolean;
    showcase_summary?: string | null;
    showcase_image?: string | null;
    showcase_order?: number | null;
    logo_url?: string | null;
    showcase_body?: string | null;
    showcase_gallery?: string[] | null;
    showcase_links?: { label: string; url: string }[] | null;
    use_vercel: boolean;
    vercel_detail: string | null;
    use_supabase: boolean;
    supabase_detail: string | null;
    use_github: boolean;
    github_detail: string | null;
    use_gmail: boolean;
    gmail_detail: string | null;
    accounts: ProjectAccount[] | null;
}

interface AiSubscriptionRow {
    id: string;
    created_at: string;
    provider_name: string;
    plan: string | null;
    started_at: string | null;
    renews_at: string | null;
    monthly_cost: number | null;
    notes: string | null;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
    idea: 'Fikir',
    potential: 'Potansiyel',
    ongoing: 'Devam ediyor',
    on_hold: 'Yarıda / Beklemede',
    completed: 'Bitti',
    cancelled: 'İptal'
};

const STATUS_BADGE: Record<ProjectStatus, string> = {
    idea: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    potential: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    ongoing: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    on_hold: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    completed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    cancelled: 'bg-red-500/15 text-red-300 border-red-500/30'
};

const STATUSES: ProjectStatus[] = [
    'idea',
    'potential',
    'ongoing',
    'on_hold',
    'completed',
    'cancelled'
];

function normalizeStatus(s: string): ProjectStatus {
    if (STATUSES.includes(s as ProjectStatus)) return s as ProjectStatus;
    return 'idea';
}

function parseAccounts(raw: unknown): ProjectAccount[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(
            (x): x is ProjectAccount =>
                typeof x === 'object' &&
                x !== null &&
                'tag' in x &&
                'email' in x &&
                typeof (x as ProjectAccount).tag === 'string' &&
                typeof (x as ProjectAccount).email === 'string'
        )
        .map((x) => ({ tag: x.tag.trim(), email: x.email.trim() }))
        .filter((x) => x.tag || x.email);
}

const emptyProjectForm = () => ({
    title: '',
    description: '',
    status: 'idea' as ProjectStatus,
    notes: '',
    use_domain: false,
    domain_detail: '',
    target_end_date: '',
    showcase: false,
    showcase_summary: '',
    showcase_image: '',
    showcase_order: '0',
    logo_url: '',
    showcase_body: '',
    showcase_gallery: [] as string[],
    showcase_links: [{ label: '', url: '' }] as { label: string; url: string }[],
    use_vercel: false,
    vercel_detail: '',
    use_supabase: false,
    supabase_detail: '',
    use_github: false,
    github_detail: '',
    use_gmail: false,
    gmail_detail: '',
    accounts: [{ tag: '', email: '' }] as ProjectAccount[]
});

const emptyAiForm = () => ({
    provider_name: '',
    plan: '',
    started_at: '',
    renews_at: '',
    monthly_cost: '',
    notes: ''
});

type ProjectSavePayload = {
    title: string;
    description: string;
    status: ProjectStatus;
    notes: string;
    use_domain: boolean;
    domain_detail: string;
    target_end_date: string | null;
    showcase: boolean;
    showcase_summary: string;
    showcase_image: string;
    showcase_order: number;
    logo_url: string;
    showcase_body: string;
    showcase_gallery: string[];
    showcase_links: { label: string; url: string }[];
    use_vercel: boolean;
    vercel_detail: string;
    use_supabase: boolean;
    supabase_detail: string;
    use_github: boolean;
    github_detail: string;
    use_gmail: boolean;
    gmail_detail: string;
    accounts: ProjectAccount[];
    updated_at: string;
};

type ShowcaseFields =
    | 'showcase'
    | 'showcase_summary'
    | 'showcase_image'
    | 'showcase_order'
    | 'logo_url'
    | 'showcase_body'
    | 'showcase_gallery'
    | 'showcase_links';

function isMissingShowcaseColumnError(err: { message?: string; code?: string } | null): boolean {
    const msg = (err?.message || '').toLowerCase();
    if (
        msg.includes('showcase') ||
        msg.includes('logo_url') ||
        msg.includes('showcase_body') ||
        msg.includes('showcase_links') ||
        msg.includes('showcase_gallery')
    ) {
        return true;
    }
    if (err?.code === '42703' && (msg.includes('showcase') || msg.includes('logo'))) return true;
    return false;
}

function payloadWithoutShowcase(
    p: ProjectSavePayload
): Omit<ProjectSavePayload, ShowcaseFields> {
    const {
        showcase: _a,
        showcase_summary: _b,
        showcase_image: _c,
        showcase_order: _d,
        logo_url: _e,
        showcase_body: _f,
        showcase_gallery: _g,
        showcase_links: _h,
        ...rest
    } = p;
    return rest;
}

/** Form state = kayıt gövdesi + güncelleme zamanı (submit’te eklenir) */
type ProjectFormState = Omit<ProjectSavePayload, 'updated_at' | 'showcase_order'> & {
    showcase_order: string;
};

function isMissingDomainColumnError(err: { message?: string; code?: string } | null): boolean {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('use_domain') || msg.includes('domain_detail')) return true;
    if (err?.code === '42703' && msg.includes('domain')) return true;
    return false;
}

function isMissingTargetEndDateColumnError(err: { message?: string; code?: string } | null): boolean {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('target_end_date')) return true;
    if (err?.code === '42703' && msg.includes('target_end_date')) return true;
    return false;
}

function payloadWithoutDomainFields(
    p: ProjectSavePayload
): Omit<ProjectSavePayload, 'use_domain' | 'domain_detail'> {
    const { use_domain: _u, domain_detail: _d, ...rest } = p;
    return rest;
}

function describeSaveError(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
        const m = String((err as { message: string }).message).trim();
        if (m) return m;
    }
    return 'Bilinmeyen hata.';
}

export default function ProjectsPage() {
    const [tab, setTab] = useState<'projects' | 'ai'>('projects');
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [aiSubs, setAiSubs] = useState<AiSubscriptionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [projectForm, setProjectForm] = useState<ProjectFormState>(() =>
        emptyProjectForm()
    );
    const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
    const [projectListNotice, setProjectListNotice] = useState<string | null>(null);

    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [editingAiId, setEditingAiId] = useState<string | null>(null);
    const [aiForm, setAiForm] = useState(emptyAiForm);

    /** Hata mesajı döner; başarıda null */
    const fetchProjects = async (): Promise<string | null> => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('projects select', error);
            return error.message || String(error);
        }

        const rows: ProjectRow[] = (data || []).map((row) => ({
            ...row,
            status: normalizeStatus(row.status),
            accounts: parseAccounts(row.accounts)
        }));
        setProjects(rows);
        return null;
    };

    const fetchAi = async (): Promise<string | null> => {
        const { data, error } = await supabase
            .from('ai_subscriptions')
            .select('*')
            .order('renews_at', { ascending: true });

        if (error) {
            console.error('ai_subscriptions select', error);
            return error.message || String(error);
        }
        setAiSubs((data || []) as AiSubscriptionRow[]);
        return null;
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(null);
            setProjectListNotice(null);

            const errProjects = await fetchProjects();
            if (cancelled) return;

            const errAi = await fetchAi();
            if (cancelled) return;

            if (errProjects && errAi) {
                setProjects([]);
                setAiSubs([]);
                setLoadError(
                    `Supabase hatası (her iki tablo):\n• Projeler: ${errProjects}\n• AI abonelikleri: ${errAi}\n\n` +
                        'Kontrol: Supabase’de aynı projede `projects` ve `ai_subscriptions` tabloları var mı? SQL Editor’de `create_projects_ai_subscriptions.sql` tamamı çalıştı mı? Vercel’deki `NEXT_PUBLIC_SUPABASE_URL` / anon key bu projeye ait mi?'
                );
            } else if (errProjects) {
                setProjects([]);
                setLoadError(
                    `Projeler yüklenemedi: ${errProjects}\n\n` +
                        'Tablo yoksa `create_projects_ai_subscriptions.sql` çalıştırın. RLS / API anahtarı için Supabase → Project Settings → API.'
                );
            } else if (errAi) {
                setAiSubs([]);
                setProjectListNotice(
                    `AI abonelikleri yüklenemedi (projeler listelendi): ${errAi}. Tablo yoksa aynı SQL dosyasındaki ai_subscriptions bölümünü çalıştırın.`
                );
            }

            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredProjects = useMemo(() => {
        if (statusFilter === 'all') return projects;
        return projects.filter((p) => p.status === statusFilter);
    }, [projects, statusFilter]);

    const openNewProject = () => {
        setEditingProjectId(null);
        setProjectForm(emptyProjectForm());
        setProjectSaveError(null);
        setProjectModalOpen(true);
    };

    const openEditProject = (p: ProjectRow) => {
        setEditingProjectId(p.id);
        setProjectSaveError(null);
        setProjectForm({
            title: p.title,
            description: p.description || '',
            status: p.status,
            notes: p.notes || '',
            use_domain: !!p.use_domain,
            domain_detail: p.domain_detail || '',
            target_end_date: p.target_end_date
                ? String(p.target_end_date).slice(0, 10)
                : '',
            showcase: !!p.showcase,
            showcase_summary: p.showcase_summary || '',
            showcase_image: p.showcase_image || '',
            showcase_order: String(p.showcase_order ?? 0),
            logo_url: p.logo_url || '',
            showcase_body: p.showcase_body || '',
            showcase_gallery: parseShowcaseGallery(p.showcase_gallery),
            showcase_links:
                Array.isArray(p.showcase_links) && p.showcase_links.length > 0
                    ? p.showcase_links.map((l) => ({
                          label: l.label || '',
                          url: l.url || ''
                      }))
                    : [{ label: '', url: '' }],
            use_vercel: !!p.use_vercel,
            vercel_detail: p.vercel_detail || '',
            use_supabase: !!p.use_supabase,
            supabase_detail: p.supabase_detail || '',
            use_github: !!p.use_github,
            github_detail: p.github_detail || '',
            use_gmail: !!p.use_gmail,
            gmail_detail: p.gmail_detail || '',
            accounts:
                parseAccounts(p.accounts).length > 0
                    ? parseAccounts(p.accounts)
                    : [{ tag: '', email: '' }]
        });
        setProjectModalOpen(true);
    };

    const saveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setProjectSaveError(null);
        if (!projectForm.title.trim()) {
            setProjectSaveError('Proje adı gerekli.');
            return;
        }

        const payload: ProjectSavePayload = {
            title: projectForm.title.trim(),
            description: projectForm.description.trim(),
            status: projectForm.status,
            notes: projectForm.notes.trim(),
            use_domain: projectForm.use_domain,
            domain_detail: projectForm.domain_detail.trim(),
            target_end_date: projectForm.target_end_date.trim() || null,
            showcase: projectForm.showcase,
            showcase_summary: projectForm.showcase_summary.trim(),
            showcase_image: projectForm.showcase_image.trim(),
            showcase_order: Number.parseInt(projectForm.showcase_order, 10) || 0,
            logo_url: projectForm.logo_url.trim(),
            showcase_body: projectForm.showcase_body.trim(),
            showcase_gallery: projectForm.showcase_gallery.filter(Boolean),
            showcase_links: projectForm.showcase_links
                .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
                .filter((l) => l.label && l.url),
            use_vercel: projectForm.use_vercel,
            vercel_detail: projectForm.vercel_detail.trim(),
            use_supabase: projectForm.use_supabase,
            supabase_detail: projectForm.supabase_detail.trim(),
            use_github: projectForm.use_github,
            github_detail: projectForm.github_detail.trim(),
            use_gmail: projectForm.use_gmail,
            gmail_detail: projectForm.gmail_detail.trim(),
            accounts: projectForm.accounts
                .map((a) => ({ tag: a.tag.trim(), email: a.email.trim() }))
                .filter((a) => a.tag || a.email),
            updated_at: new Date().toISOString()
        };

        const runSave = async (
            body:
                | ProjectSavePayload
                | Omit<ProjectSavePayload, 'use_domain' | 'domain_detail'>
                | Omit<ProjectSavePayload, ShowcaseFields>
                | Record<string, unknown>
        ) => {
            if (editingProjectId) {
                return supabase.from('projects').update(body).eq('id', editingProjectId).select('id');
            }
            return supabase.from('projects').insert([body]).select('id');
        };

        try {
            const notices: string[] = [];
            let body: Record<string, unknown> = { ...payload };
            let { data: savedRows, error } = await runSave(body as ProjectSavePayload);

            if (error && isMissingShowcaseColumnError(error)) {
                body = { ...payloadWithoutShowcase(payload) };
                notices.push(
                    'Vitrin sütunları henüz yok: kayıt vitrin bilgisi olmadan saklandı. Supabase SQL Editor’da `add_showcase_logo_and_links.sql` (veya eski `add_showcase_and_site_content.sql`) çalıştırın.'
                );
                ({ data: savedRows, error } = await runSave(body));
            }

            if (error && isMissingDomainColumnError(error)) {
                body = { ...payloadWithoutDomainFields(payload as ProjectSavePayload) };
                notices.push(
                    'Domain sütunları henüz yok: kayıt domain bilgisi olmadan saklandı. `add_projects_domain.sql` çalıştırın.'
                );
                ({ data: savedRows, error } = await runSave(body));
            }

            if (error && isMissingTargetEndDateColumnError(error)) {
                const { target_end_date: _t, ...rest } = body;
                body = rest;
                notices.push(
                    'Hedef bitiş sütunu henüz yok: tarih kaydedilmedi. `add_projects_target_end_date.sql` çalıştırın.'
                );
                ({ data: savedRows, error } = await runSave(body));
            }

            if (error) {
                const detail = describeSaveError(error);
                const hint =
                    /permission|policy|rls|jwt|auth/i.test(detail)
                        ? ' Supabase RLS / API anahtarı ayarlarını kontrol edin.'
                        : '';
                setProjectSaveError(`Kayıt başarısız: ${detail}${hint}`);
                return;
            }

            const projectId =
                editingProjectId ||
                (savedRows && savedRows[0] && (savedRows[0] as { id: string }).id) ||
                null;

            if (projectId && payload.use_domain) {
                const sync = await syncProjectDomain({
                    projectId,
                    useDomain: payload.use_domain,
                    domainDetail: payload.domain_detail
                });
                if (sync.error) {
                    notices.push(`Domain senkronu: ${sync.error}`);
                } else if (sync.synced && sync.hostname) {
                    notices.push(`Domainler listesine eklendi/bağlandı: ${sync.hostname}`);
                }
            } else if (projectId && !payload.use_domain) {
                await syncProjectDomain({
                    projectId,
                    useDomain: false,
                    domainDetail: ''
                });
            }

            setProjectModalOpen(false);
            setProjectSaveError(null);
            if (notices.length > 0) setProjectListNotice(notices.join(' '));
            await fetchProjects();
        } catch (err) {
            console.error(err);
            setProjectSaveError(`Kayıt başarısız: ${describeSaveError(err)}`);
        }
    };

    const deleteProject = async (id: string) => {
        if (!confirm('Bu projeyi silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) throw error;
            await fetchProjects();
        } catch (err) {
            console.error(err);
            alert('Silinemedi.');
        }
    };

    const addAccountRow = () => {
        setProjectForm((f) => ({
            ...f,
            accounts: [...f.accounts, { tag: '', email: '' }]
        }));
    };

    const updateAccountRow = (index: number, field: keyof ProjectAccount, value: string) => {
        setProjectForm((f) => {
            const next = [...f.accounts];
            next[index] = { ...next[index], [field]: value };
            return { ...f, accounts: next };
        });
    };

    const updateShowcaseLink = (
        index: number,
        field: 'label' | 'url',
        value: string
    ) => {
        setProjectForm((f) => {
            const next = [...f.showcase_links];
            next[index] = { ...next[index], [field]: value };
            return { ...f, showcase_links: next };
        });
    };

    const removeAccountRow = (index: number) => {
        setProjectForm((f) => {
            const next = f.accounts.filter((_, i) => i !== index);
            return {
                ...f,
                accounts: next.length > 0 ? next : [{ tag: '', email: '' }]
            };
        });
    };

    const openNewAi = () => {
        setEditingAiId(null);
        setAiForm(emptyAiForm());
        setAiModalOpen(true);
    };

    const openEditAi = (row: AiSubscriptionRow) => {
        setEditingAiId(row.id);
        setAiForm({
            provider_name: row.provider_name,
            plan: row.plan || '',
            started_at: row.started_at || '',
            renews_at: row.renews_at || '',
            monthly_cost:
                row.monthly_cost != null ? String(row.monthly_cost) : '',
            notes: row.notes || ''
        });
        setAiModalOpen(true);
    };

    const saveAi = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiForm.provider_name.trim()) {
            alert('Sağlayıcı adı gerekli.');
            return;
        }

        const monthly =
            aiForm.monthly_cost.trim() === ''
                ? null
                : Number(aiForm.monthly_cost.replace(',', '.'));

        const payload = {
            provider_name: aiForm.provider_name.trim(),
            plan: aiForm.plan.trim(),
            started_at: aiForm.started_at || null,
            renews_at: aiForm.renews_at || null,
            monthly_cost: monthly != null && !Number.isNaN(monthly) ? monthly : null,
            notes: aiForm.notes.trim()
        };

        try {
            if (editingAiId) {
                const { error } = await supabase
                    .from('ai_subscriptions')
                    .update(payload)
                    .eq('id', editingAiId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('ai_subscriptions').insert([payload]);
                if (error) throw error;
            }
            setAiModalOpen(false);
            await fetchAi();
        } catch (err) {
            console.error(err);
            alert('Kaydedilemedi.');
        }
    };

    const deleteAi = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('ai_subscriptions').delete().eq('id', id);
            if (error) throw error;
            await fetchAi();
        } catch (err) {
            console.error(err);
            alert('Silinemedi.');
        }
    };

    const aiRenewalHint = (renewsAt: string | null) => {
        if (!renewsAt) return null;
        const d = new Date(renewsAt);
        if (Number.isNaN(d.getTime())) return null;
        const days = differenceInDays(d, new Date());
        if (isPast(d) && days < 0) return 'Süresi dolmuş';
        if (days === 0) return 'Bugün son gün';
        if (days > 0 && days <= 14) return `${days} gün kaldı`;
        return null;
    };

    if (loading) {
        return (
            <div className="h-[50vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <FolderKanban className="w-7 h-7 text-primary" />
                        Projeler
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Web uygulama işlerinizi ve AI aboneliklerinizi tek yerden takip edin.
                    </p>
                </div>
            </div>

            {loadError && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm whitespace-pre-wrap">
                    {loadError}
                </div>
            )}

            {projectListNotice && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                    <p>{projectListNotice}</p>
                    <button
                        type="button"
                        onClick={() => setProjectListNotice(null)}
                        className="shrink-0 text-amber-100/80 hover:text-amber-50 text-xs underline"
                    >
                        Kapat
                    </button>
                </div>
            )}

            <div className="flex gap-1 p-1 rounded-xl bg-secondary/40 border border-border w-fit">
                <button
                    type="button"
                    onClick={() => setTab('projects')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tab === 'projects'
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Projeler
                </button>
                <button
                    type="button"
                    onClick={() => setTab('ai')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        tab === 'ai'
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Sparkles className="w-4 h-4" />
                    AI abonelikleri
                </button>
            </div>

            {tab === 'projects' && (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                statusFilter === 'all'
                                    ? 'bg-primary/20 border-primary text-primary'
                                    : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                            }`}
                        >
                            Tümü
                        </button>
                        {STATUSES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                    statusFilter === s
                                        ? 'bg-primary/20 border-primary text-primary'
                                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                                }`}
                            >
                                {STATUS_LABELS[s]}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={openNewProject}
                            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                        >
                            <Plus className="w-4 h-4" />
                            Proje ekle
                        </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {filteredProjects.length === 0 && (
                            <div className="sm:col-span-2 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                                Henüz proje yok veya filtreye uyan kayıt yok.
                            </div>
                        )}
                        {filteredProjects.map((p) => (
                            <article
                                key={p.id}
                                className="rounded-xl border border-border bg-card/40 p-4 flex flex-col gap-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="font-semibold text-white leading-snug">
                                        {p.title}
                                    </h2>
                                    <span
                                        className={`shrink-0 text-xs px-2 py-0.5 rounded-md border ${STATUS_BADGE[p.status]}`}
                                    >
                                        {STATUS_LABELS[p.status]}
                                    </span>
                                </div>
                                {p.description ? (
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {p.description}
                                    </p>
                                ) : null}

                                {p.target_end_date ? (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <span className="text-indigo-400 font-medium">Hedef bitiş:</span>
                                        {format(new Date(p.target_end_date), 'd MMM yyyy', { locale: tr })}
                                    </p>
                                ) : null}

                                <div className="flex flex-wrap gap-2 text-xs">
                                    {p.use_domain && (
                                        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                            Domain
                                        </span>
                                    )}
                                    {p.use_vercel && (
                                        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                            Vercel
                                        </span>
                                    )}
                                    {p.use_supabase && (
                                        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                            Supabase
                                        </span>
                                    )}
                                    {p.use_github && (
                                        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                            GitHub
                                        </span>
                                    )}
                                    {p.use_gmail && (
                                        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                            Gmail
                                        </span>
                                    )}
                                </div>

                                {parseAccounts(p.accounts).length > 0 && (
                                    <ul className="text-xs space-y-1 text-muted-foreground border-t border-border pt-2">
                                        {parseAccounts(p.accounts).map((a, i) => (
                                            <li key={i}>
                                                <span className="text-foreground/90 font-medium">
                                                    {a.tag || '—'}
                                                </span>
                                                {a.email ? (
                                                    <span className="ml-2 opacity-80">{a.email}</span>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {p.notes ? (
                                    <p className="text-xs text-muted-foreground border-t border-border pt-2 whitespace-pre-wrap line-clamp-4">
                                        {p.notes}
                                    </p>
                                ) : null}

                                <div className="flex gap-2 mt-auto pt-2">
                                    <button
                                        type="button"
                                        onClick={() => openEditProject(p)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-secondary/60"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Düzenle
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteProject(p.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Sil
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </>
            )}

            {tab === 'ai' && (
                <>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={openNewAi}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                        >
                            <Plus className="w-4 h-4" />
                            Abonelik ekle
                        </button>
                    </div>

                    <div className="rounded-xl border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-secondary/30 text-left text-muted-foreground">
                                        <th className="px-4 py-3 font-medium">Sağlayıcı</th>
                                        <th className="px-4 py-3 font-medium">Plan</th>
                                        <th className="px-4 py-3 font-medium">Başlangıç</th>
                                        <th className="px-4 py-3 font-medium">Yenileme / Bitiş</th>
                                        <th className="px-4 py-3 font-medium">Aylık</th>
                                        <th className="px-4 py-3 font-medium w-28" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {aiSubs.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-10 text-center text-muted-foreground"
                                            >
                                                Kayıt yok. Yeni abonelik ekleyin.
                                            </td>
                                        </tr>
                                    )}
                                    {aiSubs.map((row) => {
                                        const hint = aiRenewalHint(row.renews_at);
                                        const renewDate = row.renews_at
                                            ? new Date(row.renews_at)
                                            : null;
                                        return (
                                            <tr
                                                key={row.id}
                                                className="border-b border-border/60 hover:bg-secondary/20"
                                            >
                                                <td className="px-4 py-3 font-medium text-white">
                                                    {row.provider_name}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {row.plan || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {row.started_at
                                                        ? format(new Date(row.started_at), 'd MMM yyyy', {
                                                              locale: tr
                                                          })
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renewDate && !Number.isNaN(renewDate.getTime()) ? (
                                                        <div>
                                                            <div className="text-foreground">
                                                                {format(renewDate, 'd MMM yyyy', {
                                                                    locale: tr
                                                                })}
                                                            </div>
                                                            {hint && (
                                                                <div
                                                                    className={`text-xs mt-0.5 ${
                                                                        hint.includes('dolmuş')
                                                                            ? 'text-red-400'
                                                                            : hint.includes('gün')
                                                                              ? 'text-amber-400'
                                                                              : 'text-muted-foreground'
                                                                    }`}
                                                                >
                                                                    {hint}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {row.monthly_cost != null
                                                        ? `₺${Number(row.monthly_cost).toLocaleString('tr-TR', {
                                                              minimumFractionDigits: 2
                                                          })}`
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-1 justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditAi(row)}
                                                            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                                                            aria-label="Düzenle"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteAi(row.id)}
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
                </>
            )}

            {projectModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-[#161B22] shadow-2xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-white">
                            {editingProjectId ? 'Projeyi düzenle' : 'Yeni proje'}
                        </h2>
                        {projectSaveError && (
                            <div
                                className={`rounded-lg border px-3 py-2 text-sm ${
                                    projectSaveError.includes('domain bilgisi olmadan')
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                                        : 'border-red-500/40 bg-red-500/10 text-red-200'
                                }`}
                            >
                                {projectSaveError}
                            </div>
                        )}
                        <form onSubmit={saveProject} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Proje adı
                                </label>
                                <input
                                    required
                                    value={projectForm.title}
                                    onChange={(e) =>
                                        setProjectForm((f) => ({ ...f, title: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Açıklama
                                </label>
                                <textarea
                                    rows={2}
                                    value={projectForm.description}
                                    onChange={(e) =>
                                        setProjectForm((f) => ({
                                            ...f,
                                            description: e.target.value
                                        }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Durum
                                </label>
                                <select
                                    value={projectForm.status}
                                    onChange={(e) =>
                                        setProjectForm((f) => ({
                                            ...f,
                                            status: e.target.value as ProjectStatus
                                        }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                >
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {STATUS_LABELS[s]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Takvim: hedef bitiş tarihi (opsiyonel)
                                </label>
                                <input
                                    type="date"
                                    value={projectForm.target_end_date}
                                    onChange={(e) =>
                                        setProjectForm((f) => ({
                                            ...f,
                                            target_end_date: e.target.value
                                        }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Doluysa Takvim’de proje olarak görünür.
                                </p>
                            </div>

                            <div className="rounded-lg border border-border/60 p-3 space-y-3">
                                <label className="flex items-center gap-2 text-sm text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={projectForm.showcase}
                                        onChange={(e) =>
                                            setProjectForm((f) => ({
                                                ...f,
                                                showcase: e.target.checked
                                            }))
                                        }
                                        className="rounded border-border"
                                    />
                                    Vitrinde göster (site İşler + izometrik kareler)
                                </label>
                                {projectForm.showcase && (
                                    <>
                                        <ImageUploadField
                                            label="Logo"
                                            folder="logos"
                                            value={projectForm.logo_url}
                                            onChange={(url) =>
                                                setProjectForm((f) => ({ ...f, logo_url: url }))
                                            }
                                            hint="Kartın önünde ve modalda görünür. Kare PNG/SVG önerilir."
                                        />
                                        <MultiImageUploadField
                                            label="Site görselleri (slider)"
                                            folder="covers"
                                            value={projectForm.showcase_gallery}
                                            onChange={(urls) =>
                                                setProjectForm((f) => ({
                                                    ...f,
                                                    showcase_gallery: urls
                                                }))
                                            }
                                            hint="Logonun arkasında kayar. Birden fazla ekleyebilirsiniz. Sıra ← → ile değişir."
                                        />
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                Kart özeti (kısa)
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={projectForm.showcase_summary}
                                                onChange={(e) =>
                                                    setProjectForm((f) => ({
                                                        ...f,
                                                        showcase_summary: e.target.value
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                                                placeholder="Kartta görünen 1–2 cümle"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                Modal detay (uzun açıklama)
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={projectForm.showcase_body}
                                                onChange={(e) =>
                                                    setProjectForm((f) => ({
                                                        ...f,
                                                        showcase_body: e.target.value
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                                                placeholder="Tıklanınca açılan detay metni"
                                            />
                                        </div>
                                        <ImageUploadField
                                            label="Kapak görseli (opsiyonel)"
                                            folder="covers"
                                            value={projectForm.showcase_image}
                                            onChange={(url) =>
                                                setProjectForm((f) => ({
                                                    ...f,
                                                    showcase_image: url
                                                }))
                                            }
                                            hint="İleride kart/modal kapak için. Şimdilik opsiyonel."
                                        />
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                Vitrin sırası
                                            </label>
                                            <input
                                                type="number"
                                                value={projectForm.showcase_order}
                                                onChange={(e) =>
                                                    setProjectForm((f) => ({
                                                        ...f,
                                                        showcase_order: e.target.value
                                                    }))
                                                }
                                                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                            />
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                Küçük sayı önce; izo karelerde de bu sırayla dolar.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Modal linkleri (etiket + URL)
                                            </p>
                                            {projectForm.showcase_links.map((link, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <input
                                                        placeholder="GitHub"
                                                        value={link.label}
                                                        onChange={(e) =>
                                                            updateShowcaseLink(
                                                                idx,
                                                                'label',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-28 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                                    />
                                                    <input
                                                        placeholder="https://..."
                                                        value={link.url}
                                                        onChange={(e) =>
                                                            updateShowcaseLink(
                                                                idx,
                                                                'url',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setProjectForm((f) => ({
                                                                ...f,
                                                                showcase_links:
                                                                    f.showcase_links.length <= 1
                                                                        ? [{ label: '', url: '' }]
                                                                        : f.showcase_links.filter(
                                                                              (_, i) => i !== idx
                                                                          )
                                                            }))
                                                        }
                                                        className="text-xs text-muted-foreground hover:text-red-400 px-1"
                                                    >
                                                        Sil
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setProjectForm((f) => ({
                                                        ...f,
                                                        showcase_links: [
                                                            ...f.showcase_links,
                                                            { label: '', url: '' }
                                                        ]
                                                    }))
                                                }
                                                className="text-xs text-primary hover:underline"
                                            >
                                                + Link ekle
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Hesaplar (etiket + e-posta)
                                </p>
                                {projectForm.accounts.map((acc, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input
                                            placeholder="work@"
                                            value={acc.tag}
                                            onChange={(e) =>
                                                updateAccountRow(idx, 'tag', e.target.value)
                                            }
                                            className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                        />
                                        <input
                                            type="email"
                                            placeholder="ornek@mail.com"
                                            value={acc.email}
                                            onChange={(e) =>
                                                updateAccountRow(idx, 'email', e.target.value)
                                            }
                                            className="flex-[2] min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeAccountRow(idx)}
                                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                                            aria-label="Satırı sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addAccountRow}
                                    className="text-xs text-primary hover:underline"
                                >
                                    + Hesap satırı ekle
                                </button>
                            </div>

                            {[
                                {
                                    key: 'domain' as const,
                                    label: 'Domain',
                                    use: projectForm.use_domain,
                                    detail: projectForm.domain_detail,
                                    setUse: (v: boolean) =>
                                        setProjectForm((f) => ({ ...f, use_domain: v })),
                                    setDetail: (v: string) =>
                                        setProjectForm((f) => ({ ...f, domain_detail: v }))
                                },
                                {
                                    key: 'vercel' as const,
                                    label: 'Vercel',
                                    use: projectForm.use_vercel,
                                    detail: projectForm.vercel_detail,
                                    setUse: (v: boolean) =>
                                        setProjectForm((f) => ({ ...f, use_vercel: v })),
                                    setDetail: (v: string) =>
                                        setProjectForm((f) => ({ ...f, vercel_detail: v }))
                                },
                                {
                                    key: 'supabase' as const,
                                    label: 'Supabase',
                                    use: projectForm.use_supabase,
                                    detail: projectForm.supabase_detail,
                                    setUse: (v: boolean) =>
                                        setProjectForm((f) => ({ ...f, use_supabase: v })),
                                    setDetail: (v: string) =>
                                        setProjectForm((f) => ({ ...f, supabase_detail: v }))
                                },
                                {
                                    key: 'github' as const,
                                    label: 'GitHub',
                                    use: projectForm.use_github,
                                    detail: projectForm.github_detail,
                                    setUse: (v: boolean) =>
                                        setProjectForm((f) => ({ ...f, use_github: v })),
                                    setDetail: (v: string) =>
                                        setProjectForm((f) => ({ ...f, github_detail: v }))
                                },
                                {
                                    key: 'gmail' as const,
                                    label: 'Gmail',
                                    use: projectForm.use_gmail,
                                    detail: projectForm.gmail_detail,
                                    setUse: (v: boolean) =>
                                        setProjectForm((f) => ({ ...f, use_gmail: v })),
                                    setDetail: (v: string) =>
                                        setProjectForm((f) => ({ ...f, gmail_detail: v }))
                                }
                            ].map((row) => (
                                <div
                                    key={row.key}
                                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3"
                                >
                                    <label className="flex items-center gap-2 text-sm text-foreground shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={row.use}
                                            onChange={(e) => row.setUse(e.target.checked)}
                                            className="rounded border-border"
                                        />
                                        {row.label}
                                    </label>
                                    <input
                                        placeholder={
                                            row.key === 'domain'
                                                ? 'Alan adı, registrar veya not'
                                                : 'Proje URL, repo veya not'
                                        }
                                        value={row.detail}
                                        onChange={(e) => row.setDetail(e.target.value)}
                                        disabled={!row.use}
                                        className="flex-1 min-w-[12rem] rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-40"
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Notlar (diğer servisler, bağlantılar)
                                </label>
                                <textarea
                                    rows={3}
                                    value={projectForm.notes}
                                    onChange={(e) =>
                                        setProjectForm((f) => ({ ...f, notes: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProjectModalOpen(false);
                                        setProjectSaveError(null);
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary/50"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {aiModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-[#161B22] shadow-2xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-white">
                            {editingAiId ? 'Aboneliği düzenle' : 'Yeni AI aboneliği'}
                        </h2>
                        <form onSubmit={saveAi} className="space-y-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Sağlayıcı
                                </label>
                                <input
                                    required
                                    placeholder="OpenAI, Cursor, ..."
                                    value={aiForm.provider_name}
                                    onChange={(e) =>
                                        setAiForm((f) => ({ ...f, provider_name: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Plan
                                </label>
                                <input
                                    value={aiForm.plan}
                                    onChange={(e) =>
                                        setAiForm((f) => ({ ...f, plan: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">
                                        Satın alma / başlangıç
                                    </label>
                                    <input
                                        type="date"
                                        value={aiForm.started_at}
                                        onChange={(e) =>
                                            setAiForm((f) => ({ ...f, started_at: e.target.value }))
                                        }
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">
                                        Yenileme / bitiş
                                    </label>
                                    <input
                                        type="date"
                                        value={aiForm.renews_at}
                                        onChange={(e) =>
                                            setAiForm((f) => ({ ...f, renews_at: e.target.value }))
                                        }
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Aylık maliyet (₺, opsiyonel)
                                </label>
                                <input
                                    value={aiForm.monthly_cost}
                                    onChange={(e) =>
                                        setAiForm((f) => ({ ...f, monthly_cost: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    Notlar
                                </label>
                                <textarea
                                    rows={2}
                                    value={aiForm.notes}
                                    onChange={(e) =>
                                        setAiForm((f) => ({ ...f, notes: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setAiModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary/50"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground"
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
