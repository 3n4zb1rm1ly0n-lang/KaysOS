import { supabase } from '@/lib/supabase';
import { extractHostname } from '@/lib/hostname';

export { extractHostname };

/**
 * Keep domains table in sync with a project's domain fields.
 * - use_domain + hostname → upsert domain linked to project_id
 * - cleared domain → unlink (do not delete domain row)
 */
export async function syncProjectDomain(opts: {
    projectId: string;
    useDomain: boolean;
    domainDetail: string;
}): Promise<{ synced: boolean; hostname?: string; error?: string }> {
    const hostname = opts.useDomain ? extractHostname(opts.domainDetail) : null;

    if (!hostname) {
        // Unlink any domain currently tied to this project (keep inventory row)
        await supabase
            .from('domains')
            .update({ project_id: null, updated_at: new Date().toISOString() })
            .eq('project_id', opts.projectId);
        return { synced: false };
    }

    const now = new Date().toISOString();

    // Prefer existing row with same hostname
    const { data: existingByHost } = await supabase
        .from('domains')
        .select('id, project_id')
        .ilike('hostname', hostname)
        .maybeSingle();

    if (existingByHost?.id) {
        const { error } = await supabase
            .from('domains')
            .update({
                project_id: opts.projectId,
                hostname,
                updated_at: now,
                notes:
                    opts.domainDetail.trim() !== hostname
                        ? opts.domainDetail.trim()
                        : undefined
            })
            .eq('id', existingByHost.id);
        if (error) return { synced: false, error: error.message };
        return { synced: true, hostname };
    }

    // Or update domain already linked to this project
    const { data: existingByProject } = await supabase
        .from('domains')
        .select('id')
        .eq('project_id', opts.projectId)
        .maybeSingle();

    if (existingByProject?.id) {
        const { error } = await supabase
            .from('domains')
            .update({
                hostname,
                updated_at: now,
                notes:
                    opts.domainDetail.trim() !== hostname
                        ? opts.domainDetail.trim()
                        : ''
            })
            .eq('id', existingByProject.id);
        if (error) return { synced: false, error: error.message };
        return { synced: true, hostname };
    }

    const { error } = await supabase.from('domains').insert([
        {
            hostname,
            project_id: opts.projectId,
            registrar: '',
            notes:
                opts.domainDetail.trim() !== hostname ? opts.domainDetail.trim() : '',
            auto_renew: false,
            updated_at: now
        }
    ]);

    if (error) return { synced: false, error: error.message };
    return { synced: true, hostname };
}
