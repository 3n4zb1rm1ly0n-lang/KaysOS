export type ShowcaseProject = {
    id: string;
    title: string;
    showcase_summary: string | null;
    showcase_image: string | null;
    domain_detail: string | null;
    use_domain: boolean | null;
    showcase_order: number | null;
};

export type SiteContent = {
    about_title: string | null;
    about_body: string | null;
    service_1: string | null;
    service_2: string | null;
    service_3: string | null;
    contact_email: string | null;
    contact_note: string | null;
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
    about_title: 'Ürün odaklı bir stüdyo',
    about_body:
        'Kaysia; markalar ve ekipler için web ürünleri, yönetim panelleri ve dijital sistemler tasarlar. Sade arayüzler, sağlam altyapı ve ölçülebilir sonuç.',
    service_1: 'Web ürünleri & arayüz',
    service_2: 'Yönetim panelleri',
    service_3: 'Entegrasyon & sistemler',
    contact_email: 'hello@kaysia.co',
    contact_note: 'Yeni bir ürün veya yenileme mi düşünüyorsunuz? Kısa bir not bırakın.'
};
