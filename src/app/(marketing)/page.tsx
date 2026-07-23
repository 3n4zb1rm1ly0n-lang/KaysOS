import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, resolvePublicAnonKey } from '@/lib/supabase-config';
import {
    DEFAULT_SITE_CONTENT,
    type ShowcaseProject,
    type SiteContent
} from '@/lib/marketing-types';
import { Hero } from '@/components/marketing/hero';
import { AboutSection } from '@/components/marketing/about-section';
import { WorkSection } from '@/components/marketing/work-section';
import { ProcessSection } from '@/components/marketing/process-section';
import { ContactSection } from '@/components/marketing/contact-section';

async function loadShowcase(): Promise<ShowcaseProject[]> {
    try {
        const client = createClient(supabaseUrl, resolvePublicAnonKey());
        const { data, error } = await client
            .from('projects')
            .select(
                'id, title, showcase_summary, showcase_image, domain_detail, use_domain, showcase_order'
            )
            .eq('showcase', true)
            .order('showcase_order', { ascending: true });
        if (error || !data) return [];
        return data as ShowcaseProject[];
    } catch {
        return [];
    }
}

async function loadSiteContent(): Promise<SiteContent> {
    try {
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
    const [projects, content] = await Promise.all([loadShowcase(), loadSiteContent()]);

    return (
        <>
            <Hero />
            <AboutSection content={content} />
            <WorkSection projects={projects} />
            <ProcessSection />
            <ContactSection content={content} />
        </>
    );
}
