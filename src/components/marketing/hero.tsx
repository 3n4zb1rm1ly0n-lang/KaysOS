'use client';

import { ArchitectureLayer, HeroMotion, motion, useReducedMotion } from '@/components/marketing/motion';

export function Hero() {
    const reduce = useReducedMotion();

    return (
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
            {/* Arka plan: şahsi mimari — grid + ışık katmanları */}
            <ArchitectureLayer>
                <div className="absolute inset-0 marketing-hero-grid opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#070A0E]/40 to-[#070A0E]" />
                <motion.div
                    className="absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full bg-[#1A9B8E]/12 blur-[100px]"
                    animate={
                        reduce
                            ? undefined
                            : {
                                  x: [0, -14, 0],
                                  y: [0, 18, 0],
                                  scale: [1, 1.06, 1]
                              }
                    }
                    transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute -left-20 bottom-1/4 h-[320px] w-[320px] rounded-full bg-[#2A6FDB]/10 blur-[90px]"
                    animate={
                        reduce
                            ? undefined
                            : {
                                  x: [0, 16, 0],
                                  y: [0, -12, 0],
                                  scale: [1, 1.05, 1]
                              }
                    }
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                />
            </ArchitectureLayer>

            {/* Ön plan: müşteri vitrini — marka + mesaj + CTA */}
            <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-5 py-20 md:px-8">
                <HeroMotion>
                    <p className="font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
                        Kaysia
                    </p>
                </HeroMotion>
                <HeroMotion delay={0.12}>
                    <h1 className="mt-6 max-w-xl text-2xl font-medium leading-snug text-[#E8EAED] sm:text-3xl md:text-4xl">
                        Dijital ürünler ve web sistemleri
                    </h1>
                </HeroMotion>
                <HeroMotion delay={0.22}>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-[#9CA3AF] md:text-lg">
                        Markalar için sade, hızlı ve ölçeklenebilir arayüzler ile paneller
                        tasarlıyoruz.
                    </p>
                </HeroMotion>
                <HeroMotion delay={0.32} className="mt-10 flex flex-wrap gap-4">
                    <a
                        href="#isler"
                        className="inline-flex items-center justify-center rounded-md bg-[#1A9B8E] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#158f83]"
                    >
                        İşlerimize bak
                    </a>
                    <a
                        href="#iletisim"
                        className="inline-flex items-center justify-center rounded-md border border-white/15 px-6 py-3 text-sm font-medium text-[#E8EAED] transition hover:border-white/30 hover:bg-white/5"
                    >
                        Mesaj yazın
                    </a>
                </HeroMotion>
            </div>
        </section>
    );
}
