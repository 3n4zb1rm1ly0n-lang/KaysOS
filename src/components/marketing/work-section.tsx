import type { ShowcaseProject } from '@/lib/marketing-types';
import { WorkShowcase } from '@/components/marketing/work-showcase';

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
                    Projelerimizi izometrik vitrinde ve kartlarda keşfedin; detay için birine tıklayın.
                </p>
            </div>

            <div className="mt-10 md:mt-14">
                <WorkShowcase projects={projects} />
            </div>
        </section>
    );
}
