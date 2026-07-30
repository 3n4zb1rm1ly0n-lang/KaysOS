export function Hero() {
    return (
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
            {/* Full-bleed tech atmosphere */}
            <div
                className="pointer-events-none absolute inset-0 marketing-hero-grid opacity-40"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#070A0E]/40 to-[#070A0E]"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full bg-[#1A9B8E]/12 blur-[100px] marketing-orb"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -left-20 bottom-1/4 h-[320px] w-[320px] rounded-full bg-[#2A6FDB]/10 blur-[90px] marketing-orb-delayed"
                aria-hidden
            />

            <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-5 py-20 md:px-8">
                <p className="font-display marketing-fade-up text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
                    Kaysia
                </p>
                <h1 className="marketing-fade-up-delay mt-6 max-w-xl text-2xl font-medium leading-snug text-[#E8EAED] sm:text-3xl md:text-4xl">
                    Dijital ürünler ve web sistemleri
                </h1>
                <p className="marketing-fade-up-delay-2 mt-5 max-w-md text-base leading-relaxed text-[#9CA3AF] md:text-lg">
                    Markalar için sade, hızlı ve ölçeklenebilir arayüzler ile paneller
                    tasarlıyoruz.
                </p>
                <div className="marketing-fade-up-delay-3 mt-10 flex flex-wrap gap-4">
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
                </div>
            </div>
        </section>
    );
}
