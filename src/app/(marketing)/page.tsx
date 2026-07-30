import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';
import {
    DEFAULT_SITE_CONTENT,
    type ShowcaseProject,
    type SiteContent
} from '@/lib/marketing-types';
import {
    normalizeEcosystemKind,
    normalizeTileTone,
    parseEcosystemLinks,
    type EcosystemItem
} from '@/lib/ecosystem-types';
import { Hero } from '@/components/marketing/hero';
import { AboutSection } from '@/components/marketing/about-section';
import { WorkSection } from '@/components/marketing/work-section';
import { ProcessSection } from '@/components/marketing/process-section';
import { ContactSection } from '@/components/marketing/contact-section';

/** Vitrin listesi güncel kalsın (yeni proje eklenince anında görünsün) */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadShowcase(): Promise<ShowcaseProject[]> {
    try {
        if (!supabaseUrl || !resolvePublicAnonKey()) return [];
        const client = createClient(supabaseUrl, resolvePublicAnonKey());
        const full = await client
            .from('projects')
            .select(
                'id, title, showcase_summary, showcase_image, showcase_body, logo_url, showcase_gallery, showcase_links, domain_detail, use_domain, showcase_order'
            )
            .eq('showcase', true)
            .order('showcase_order', { ascending: true });

        if (!full.error && full.data) return full.data as ShowcaseProject[];

        const basic = await client
            .from('projects')
            .select(
                'id, title, showcase_summary, showcase_image, domain_detail, use_domain, showcase_order'
            )
            .eq('showcase', true)
            .order('showcase_order', { ascending: true });
        if (basic.error || !basic.data) return [];
        return basic.data.map((row) => ({
            ...row,
            showcase_body: null,
            logo_url: null,
            showcase_gallery: [],
            showcase_links: []
        })) as ShowcaseProject[];
    } catch {
        return [];
    }
}

async function loadEcosystem(): Promise<EcosystemItem[]> {
    try {
        if (!supabaseUrl || !resolvePublicAnonKey()) return [];
        const client = createClient(supabaseUrl, resolvePublicAnonKey());
        const { data, error } = await client
            .from('ecosystem_items')
            .select('*')
            .eq('visible', true)
            .order('sort_order', { ascending: true });
        if (error || !data) return [];
        return data.map((row) => ({
            id: row.id,
            name: row.name,
            kind: normalizeEcosystemKind(row.kind),
            logo_url: row.logo_url || '',
            summary: row.summary || '',
            body: row.body || '',
            links: parseEcosystemLinks(row.links),
            sort_order: Number(row.sort_order) || 0,
            visible: true,
            tile_tone: normalizeTileTone(row.tile_tone)
        }));
    } catch {
        return [];
    }
}

async function loadSiteContent(): Promise<SiteContent> {
    try {
        if (!supabaseUrl || !resolvePublicAnonKey()) return DEFAULT_SITE_CONTENT;
        const client = createClient(supabaseUrl, resolvePublicAnonKey());
        const { data, error } = await client
            .from('site_content')
            .select('*')
            .eq('id', 'main')
            .maybeSingle();
        if (error || !data) return DEFAULT_SITE_CONTENT;
        return { ...DEFAULT_SITE_CONTENT, ...data };
    } catch {
        return DEFAULT_SITE_CONTENT;
    }
}

export default async function HomePage() {
    const [projects, ecosystem, content] = await Promise.all([
        loadShowcase(),
        loadEcosystem(),
        loadSiteContent()
    ]);

    return (
        <>
            <Hero />
            <AboutSection content={content} />
            <WorkSection projects={projects} ecosystem={ecosystem} />
            <ProcessSection />
            <ContactSection content={content} />
        </>
    );
}
