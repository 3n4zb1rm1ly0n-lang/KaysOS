import type { SiteContent } from '@/lib/marketing-types';

export function ContactSection({ content }: { content: SiteContent }) {
    const email = content.contact_email || 'hello@kaysia.co';

    return (
        <section id="iletisim" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                    İletişim
                </p>
                <h2 className="font-display mt-4 max-w-xl text-3xl text-white md:text-4xl">
                    Birlikte bir şey inşa edelim
                </h2>
                <p className="mt-5 max-w-md text-[#9CA3AF]">
                    {content.contact_note ||
                        'Yeni bir ürün veya yenileme mi düşünüyorsunuz? Kısa bir not bırakın.'}
                </p>
                <a
                    href={`mailto:${email}`}
                    className="mt-10 inline-flex items-center justify-center rounded-md bg-[#1A9B8E] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#158f83]"
                >
                    {email}
                </a>
            </div>
        </section>
    );
}
