'use client';

import type { SiteContent } from '@/lib/marketing-types';
import { Reveal, RevealGroup, RevealItem, fadeUp } from '@/components/marketing/motion';

export function AboutSection({ content }: { content: SiteContent }) {
    const services = [
        content.service_1 || 'Web ürünleri & arayüz',
        content.service_2 || 'Yönetim panelleri',
        content.service_3 || 'Entegrasyon & sistemler'
    ];

    return (
        <section id="biz" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <Reveal>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                        Biz
                    </p>
                </Reveal>
                <Reveal delay={0.06}>
                    <h2 className="font-display mt-4 max-w-2xl text-3xl text-white md:text-4xl">
                        {content.about_title}
                    </h2>
                </Reveal>
                <Reveal delay={0.12}>
                    <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#9CA3AF] md:text-lg">
                        {content.about_body}
                    </p>
                </Reveal>
                <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-3" as="ul">
                    {services.map((label) => (
                        <RevealItem key={label} as="li" variants={fadeUp}>
                            <span className="block border-t border-white/10 pt-4 text-sm font-medium text-[#E8EAED]">
                                {label}
                            </span>
                        </RevealItem>
                    ))}
                </RevealGroup>
            </div>
        </section>
    );
}
