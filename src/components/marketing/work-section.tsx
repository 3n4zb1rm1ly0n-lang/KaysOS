import type { ShowcaseProject } from '@/lib/marketing-types';
import { extractHostname } from '@/lib/hostname';

export function WorkSection({ projects }: { projects: ShowcaseProject[] }) {
    return (
        <section id="isler" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                    İşler
                </p>
                <h2 className="font-display mt-4 text-3xl text-white md:text-4xl">
                    Seçilmiş işler
                </h2>
                <p className="mt-4 max-w-xl text-[#9CA3AF]">
                    Panelden vitrine taşıdığımız güncel çalışmalar.
                </p>

                {projects.length === 0 ? (
                    <p className="mt-16 text-sm text-[#6B7280]">
                        Yakında burada seçilmiş projeler görünecek.
                    </p>
                ) : (
                    <ul className="mt-14 divide-y divide-white/10">
                        {projects.map((p, i) => {
                            const host =
                                p.use_domain && p.domain_detail
                                    ? extractHostname(p.domain_detail)
                                    : null;
                            return (
                                <li
                                    key={p.id}
                                    className="group flex flex-col gap-3 py-8 md:flex-row md:items-end md:justify-between md:gap-8"
                                >
                                    <div className="min-w-0">
                                        <span className="text-xs text-[#4B5563]">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <h3 className="mt-2 font-display text-2xl text-white transition group-hover:text-[#1A9B8E] md:text-3xl">
                                            {p.title}
                                        </h3>
                                        {p.showcase_summary && (
                                            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#9CA3AF]">
                                                {p.showcase_summary}
                                            </p>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-sm text-[#6B7280]">
                                        {host ? (
                                            <a
                                                href={`https://${host}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-[#1A9B8E]"
                                            >
                                                {host}
                                            </a>
                                        ) : (
                                            <span>—</span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
