'use client';

import type { ShowcaseProject } from '@/lib/marketing-types';
import type { EcosystemItem } from '@/lib/ecosystem-types';
import { WorkShowcase } from '@/components/marketing/work-showcase';
import { Reveal } from '@/components/marketing/motion';

export function WorkSection({
    projects,
    ecosystem
}: {
    projects: ShowcaseProject[];
    ecosystem: EcosystemItem[];
}) {
    return (
        <section id="isler" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <Reveal>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                        İşler
                    </p>
                </Reveal>
                <Reveal delay={0.06}>
                    <h2 className="font-display mt-4 text-3xl text-white md:text-4xl">
                        Ekosistem ve seçilmiş işler
                    </h2>
                </Reveal>
                <Reveal delay={0.12}>
                    <p className="mt-4 max-w-xl text-[#9CA3AF]">
                        Kullandığımız teknolojiler, partnerlikler ve vitrine taşıdığımız projeler.
                    </p>
                </Reveal>
            </div>

            <div className="mt-10 md:mt-14">
                <WorkShowcase projects={projects} ecosystem={ecosystem} />
            </div>
        </section>
    );
}
