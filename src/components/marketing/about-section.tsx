import type { SiteContent } from '@/lib/marketing-types';

export function AboutSection({ content }: { content: SiteContent }) {
    const services = [
        content.service_1 || 'Web ürünleri & arayüz',
        content.service_2 || 'Yönetim panelleri',
        content.service_3 || 'Entegrasyon & sistemler'
    ];

    return (
        <section id="biz" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                    Biz
                </p>
                <h2 className="font-display mt-4 max-w-2xl text-3xl text-white md:text-4xl">
                    {content.about_title}
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#9CA3AF] md:text-lg">
                    {content.about_body}
                </p>
                <ul className="mt-12 grid gap-6 sm:grid-cols-3">
                    {services.map((label) => (
                        <li
                            key={label}
                            className="border-t border-white/10 pt-4 text-sm font-medium text-[#E8EAED]"
                        >
                            {label}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
