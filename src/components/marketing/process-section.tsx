'use client';

import { Reveal, RevealGroup, RevealItem, fadeUp } from '@/components/marketing/motion';

const STEPS = [
    {
        n: '01',
        title: 'Keşif',
        body: 'Hedef, kullanıcı ve kısıtları netleştiririz. Kısa bir çerçeve ile ilerleriz.'
    },
    {
        n: '02',
        title: 'Yapım',
        body: 'Arayüz ve sistemi birlikte kurarız. Hızlı iterasyon, görünür ilerleme.'
    },
    {
        n: '03',
        title: 'Teslim',
        body: 'Canlıya alır, dokümante eder ve gerekirse bakım ile yanınızda kalırız.'
    }
];

export function ProcessSection() {
    return (
        <section id="surec" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <Reveal>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                        Süreç
                    </p>
                </Reveal>
                <Reveal delay={0.06}>
                    <h2 className="font-display mt-4 text-3xl text-white md:text-4xl">
                        Nasıl çalışırız
                    </h2>
                </Reveal>
                <RevealGroup className="mt-14 grid gap-10 md:grid-cols-3" as="ol">
                    {STEPS.map((s) => (
                        <RevealItem key={s.n} as="li" variants={fadeUp}>
                            <span className="font-display text-sm text-[#1A9B8E]">{s.n}</span>
                            <h3 className="mt-3 text-xl font-medium text-white">{s.title}</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[#9CA3AF]">{s.body}</p>
                        </RevealItem>
                    ))}
                </RevealGroup>
            </div>
        </section>
    );
}
