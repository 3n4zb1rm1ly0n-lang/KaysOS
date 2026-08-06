'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SiteContent } from '@/lib/marketing-types';
import { Reveal } from '@/components/marketing/motion';

export function ContactSection({ content }: { content: SiteContent }) {
    const emailDisplay = content.contact_email || 'hello@kaysia.co';
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [ok, setOk] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setOk(false);

        const emailTrim = email.trim();
        const phoneTrim = phone.trim();
        const messageTrim = message.trim();

        if (!messageTrim) {
            setError('Lütfen bir mesaj yazın.');
            return;
        }
        if (!emailTrim && !phoneTrim) {
            setError('E-posta veya telefon numarasından en az birini girin.');
            return;
        }
        if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
            setError('Geçerli bir e-posta adresi girin.');
            return;
        }

        setLoading(true);
        const { error: insertError } = await supabase.from('contact_messages').insert([
            {
                name: name.trim(),
                email: emailTrim || null,
                phone: phoneTrim || null,
                message: messageTrim,
                source: 'contact',
                is_read: false
            }
        ]);
        setLoading(false);

        if (insertError) {
            setError(
                insertError.message.includes('contact_messages')
                    ? 'Mesaj tablosu henüz yok. Supabase’te create_contact_messages.sql çalıştırın.'
                    : insertError.message
            );
            return;
        }

        setOk(true);
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
    };

    return (
        <section id="iletisim" className="scroll-mt-20 border-t border-white/5 py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <Reveal>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1A9B8E]">
                        İletişim
                    </p>
                </Reveal>
                <Reveal delay={0.06}>
                    <h2 className="font-display mt-4 max-w-xl text-3xl text-white md:text-4xl">
                        Birlikte bir şey inşa edelim
                    </h2>
                </Reveal>
                <Reveal delay={0.12}>
                    <p className="mt-5 max-w-md text-[#9CA3AF]">
                        {content.contact_note ||
                            'Yeni bir ürün veya yenileme mi düşünüyorsunuz? Kısa bir not bırakın.'}
                    </p>
                </Reveal>
                <Reveal delay={0.16}>
                    <p className="mt-3 text-sm text-[#6B7280]">
                        Doğrudan yazmak isterseniz:{' '}
                        <a
                            href={`mailto:${emailDisplay}`}
                            className="text-[#9CA3AF] underline-offset-2 hover:text-white hover:underline"
                        >
                            {emailDisplay}
                        </a>
                    </p>
                </Reveal>

                <Reveal delay={0.2}>
                <form onSubmit={handleSubmit} className="mt-10 max-w-lg space-y-4">
                    <div>
                        <label htmlFor="contact-name" className="sr-only">
                            Ad
                        </label>
                        <input
                            id="contact-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Adınız (isteğe bağlı)"
                            className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#1A9B8E]/50 focus:ring-1 focus:ring-[#1A9B8E]/40"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="contact-email" className="sr-only">
                                E-posta
                            </label>
                            <input
                                id="contact-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="E-posta"
                                className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#1A9B8E]/50 focus:ring-1 focus:ring-[#1A9B8E]/40"
                            />
                        </div>
                        <div>
                            <label htmlFor="contact-phone" className="sr-only">
                                Telefon
                            </label>
                            <input
                                id="contact-phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Telefon"
                                className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#1A9B8E]/50 focus:ring-1 focus:ring-[#1A9B8E]/40"
                            />
                        </div>
                    </div>
                    <p className="text-[11px] text-[#6B7280]">
                        E-posta veya telefon — en az biri zorunlu.
                    </p>
                    <div>
                        <label htmlFor="contact-message" className="sr-only">
                            Mesaj
                        </label>
                        <textarea
                            id="contact-message"
                            required
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mesajınız"
                            className="w-full resize-y rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#1A9B8E]/50 focus:ring-1 focus:ring-[#1A9B8E]/40"
                        />
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {ok && (
                        <p className="text-sm text-emerald-400">
                            Mesajınız alındı. En kısa sürede dönüş yapacağız.
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1A9B8E] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#158f83] disabled:opacity-60"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        Mesaj gönder
                    </button>
                </form>
                </Reveal>
            </div>
        </section>
    );
}
