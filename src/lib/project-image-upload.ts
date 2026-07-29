import { supabase } from '@/lib/supabase';

const BUCKET = 'project-assets';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/svg+xml'
]);

function extFromFile(file: File): string {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 5) return fromName;
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') return 'jpg';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif') return 'gif';
    if (file.type === 'image/svg+xml') return 'svg';
    return 'png';
}

export function validateProjectImage(file: File): string | null {
    if (!ALLOWED.has(file.type)) {
        return 'Sadece PNG, JPG, WEBP, GIF veya SVG yükleyebilirsiniz.';
    }
    if (file.size > MAX_BYTES) {
        return 'Dosya en fazla 5 MB olabilir.';
    }
    return null;
}

/** Klasör: logos | covers */
export async function uploadProjectImage(
    file: File,
    folder: 'logos' | 'covers' = 'logos'
): Promise<{ url: string } | { error: string }> {
    const invalid = validateProjectImage(file);
    if (invalid) return { error: invalid };

    const ext = extFromFile(file);
    const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${folder}/${id}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined
    });

    if (error) {
        const msg = error.message || String(error);
        if (msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found')) {
            return {
                error: 'Storage bucket yok. SQL Editor’da add_showcase_logo_and_links.sql çalıştırın.'
            };
        }
        return { error: msg };
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) return { error: 'Yükleme tamamlandı ama public URL alınamadı.' };
    return { url: data.publicUrl };
}
