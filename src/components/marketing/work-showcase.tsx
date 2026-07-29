'use client';

import { useEffect, useId, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { ShowcaseProject } from '@/lib/marketing-types';
import { parseShowcaseLinks } from '@/lib/marketing-types';
import type { EcosystemItem } from '@/lib/ecosystem-types';
import { ECOSYSTEM_KIND_LABELS, parseEcosystemLinks } from '@/lib/ecosystem-types';
import { extractHostname } from '@/lib/hostname';
import { EcosystemIso } from '@/components/marketing/ecosystem-iso';

function siteUrl(p: ShowcaseProject): string | null {
    if (p.use_domain && p.domain_detail) {
        const host = extractHostname(p.domain_detail);
        return host ? `https://${host}` : null;
    }
    return null;
}

function DetailModal({
    title,
    summary,
    body,
    logoUrl,
    links,
    badge,
    onClose
}: {
    title: string;
    summary?: string | null;
    body?: string | null;
    logoUrl?: string | null;
    links: { label: string; url: string }[];
    badge?: string;
    onClose: () => void;
}) {
    const titleId = useId();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                aria-label="Kapat"
                onClick={onClose}
            />
            <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0F1419] shadow-2xl sm:rounded-2xl">
                <div className="flex items-start gap-4 border-b border-white/10 px-5 py-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />
                        ) : (
                            <span className="font-display text-lg text-[#1A9B8E]">
                                {title.slice(0, 1)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 id={titleId} className="font-display text-xl text-white">
                                {title}
                            </h3>
                            {badge && (
                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/15 text-[#9CA3AF]">
                                    {badge}
                                </span>
                            )}
                        </div>
                        {summary && (
                            <p className="mt-1 text-sm text-[#9CA3AF]">{summary}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-[#9CA3AF] hover:bg-white/5 hover:text-white"
                        aria-label="Kapat"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-5 space-y-5">
                    {body ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D1D5DB]">
                            {body}
                        </p>
                    ) : (
                        <p className="text-sm text-[#6B7280]">Detaylı açıklama henüz eklenmedi.</p>
                    )}

                    {links.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                                Bağlantılar
                            </p>
                            <ul className="space-y-2">
                                {links.map((l) => (
                                    <li key={`${l.label}-${l.url}`}>
                                        <a
                                            href={l.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#E8EAED] transition hover:border-[#1A9B8E]/40 hover:text-white"
                                        >
                                            {l.label}
                                            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function WorkShowcase({
    projects,
    ecosystem
}: {
    projects: ShowcaseProject[];
    ecosystem: EcosystemItem[];
}) {
    const [ecoId, setEcoId] = useState<string | null>(null);
    const [projectId, setProjectId] = useState<string | null>(null);

    const ecoActive = ecosystem.find((i) => i.id === ecoId) ?? null;
    const projectActive = projects.find((p) => p.id === projectId) ?? null;

    const projectLinks = projectActive
        ? [
              ...(siteUrl(projectActive)
                  ? [{ label: 'Siteyi aç', url: siteUrl(projectActive)! }]
                  : []),
              ...parseShowcaseLinks(projectActive.showcase_links)
          ]
        : [];

    return (
        <>
            <div className="mx-auto max-w-6xl px-5 md:px-8 mb-2">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]/90">
                    Teknolojiler & partnerlikler
                </p>
            </div>

            <EcosystemIso items={ecosystem} onSelectItem={setEcoId} />

            <div className="mx-auto max-w-6xl px-5 md:px-8 mt-14 md:mt-16">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                    Projeler
                </p>
                <h3 className="font-display mt-3 text-2xl text-white md:text-3xl">
                    Seçilmiş işler
                </h3>
            </div>

            {projects.length === 0 ? (
                <p className="mx-auto mt-8 max-w-6xl px-5 text-sm text-[#6B7280] md:px-8">
                    Yakında burada seçilmiş projeler görünecek.
                </p>
            ) : (
                <ul className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-4 px-5 sm:grid-cols-2 md:gap-5 md:px-8 lg:grid-cols-3">
                    {projects.map((p) => (
                        <li key={p.id}>
                            <button
                                type="button"
                                onClick={() => setProjectId(p.id)}
                                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12171E] text-left transition hover:border-[#1A9B8E]/40 hover:bg-[#161C24]"
                            >
                                <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-b from-white/[0.06] to-transparent p-8">
                                    {p.logo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={p.logo_url}
                                            alt=""
                                            className="max-h-16 max-w-[70%] object-contain transition duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <span className="font-display text-4xl text-[#1A9B8E]/80">
                                            {p.title.slice(0, 1)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-1 flex-col border-t border-white/5 px-5 py-4">
                                    <h3 className="font-display text-lg text-white transition group-hover:text-[#1A9B8E]">
                                        {p.title}
                                    </h3>
                                    {p.showcase_summary && (
                                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#9CA3AF]">
                                            {p.showcase_summary}
                                        </p>
                                    )}
                                    <span className="mt-4 text-xs font-medium text-[#1A9B8E]/90">
                                        Detayı aç →
                                    </span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {ecoActive && (
                <DetailModal
                    title={ecoActive.name}
                    summary={ecoActive.summary}
                    body={ecoActive.body}
                    logoUrl={ecoActive.logo_url}
                    links={parseEcosystemLinks(ecoActive.links)}
                    badge={ECOSYSTEM_KIND_LABELS[ecoActive.kind]}
                    onClose={() => setEcoId(null)}
                />
            )}

            {projectActive && (
                <DetailModal
                    title={projectActive.title}
                    summary={projectActive.showcase_summary}
                    body={projectActive.showcase_body}
                    logoUrl={projectActive.logo_url}
                    links={projectLinks}
                    badge="Proje"
                    onClose={() => setProjectId(null)}
                />
            )}
        </>
    );
}
