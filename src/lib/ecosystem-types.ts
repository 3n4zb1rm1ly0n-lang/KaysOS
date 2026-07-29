import type { ShowcaseLink } from '@/lib/marketing-types';
import { parseShowcaseLinks } from '@/lib/marketing-types';

export type EcosystemKind = 'technology' | 'partner';
export type EcosystemTileTone = 'light' | 'dark';

export type EcosystemItem = {
    id: string;
    name: string;
    kind: EcosystemKind;
    logo_url: string | null;
    summary: string | null;
    body: string | null;
    links: ShowcaseLink[] | null;
    sort_order: number | null;
    visible: boolean | null;
    tile_tone: EcosystemTileTone | null;
};

export function normalizeEcosystemKind(k: string | null | undefined): EcosystemKind {
    return k === 'partner' ? 'partner' : 'technology';
}

export function normalizeTileTone(t: string | null | undefined): EcosystemTileTone {
    return t === 'dark' ? 'dark' : 'light';
}

export function parseEcosystemLinks(raw: unknown): ShowcaseLink[] {
    return parseShowcaseLinks(raw);
}

export const ECOSYSTEM_KIND_LABELS: Record<EcosystemKind, string> = {
    technology: 'Teknoloji',
    partner: 'Partnerlik'
};
