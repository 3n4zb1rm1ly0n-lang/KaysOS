'use client';

type TileItem = {
    label: string;
    src: string;
    tone?: 'dark' | 'light';
    crop?: boolean;
    brand?: boolean;
};

/** Tech stack for Kaysia — layout mirrors isometric ecosystem grid */
const TILES: TileItem[] = [
    {
        label: 'Kaysia',
        src: '',
        brand: true
    },
    {
        label: 'Next.js',
        src: 'https://cdn.simpleicons.org/nextdotjs/ffffff',
        tone: 'dark'
    },
    {
        label: 'React',
        src: 'https://cdn.simpleicons.org/react/61DAFB'
    },
    {
        label: 'TypeScript',
        src: 'https://cdn.simpleicons.org/typescript/3178C6'
    },
    {
        label: 'Tailwind',
        src: 'https://cdn.simpleicons.org/tailwindcss/06B6D4'
    },
    {
        label: 'Supabase',
        src: 'https://cdn.simpleicons.org/supabase/3ECF8E'
    },
    {
        label: 'Vercel',
        src: 'https://cdn.simpleicons.org/vercel/ffffff',
        tone: 'dark'
    },
    {
        label: 'GitHub',
        src: 'https://cdn.simpleicons.org/github/ffffff',
        tone: 'dark'
    },
    {
        label: 'Node.js',
        src: 'https://cdn.simpleicons.org/nodedotjs/339933'
    },
    {
        label: 'PostgreSQL',
        src: 'https://cdn.simpleicons.org/postgresql/4169E1'
    },
    {
        label: 'Figma',
        src: 'https://cdn.simpleicons.org/figma/F24E1E'
    },
    {
        label: 'OpenAI',
        src: 'https://cdn.simpleicons.org/openai/ffffff',
        tone: 'dark'
    },
    {
        label: 'Stripe',
        src: 'https://cdn.simpleicons.org/stripe/635BFF'
    },
    {
        label: 'Cloudflare',
        src: 'https://cdn.simpleicons.org/cloudflare/F38020'
    },
    {
        label: 'Docker',
        src: 'https://cdn.simpleicons.org/docker/2496ED'
    },
    {
        label: 'Prisma',
        src: 'https://cdn.simpleicons.org/prisma/ffffff',
        tone: 'dark'
    },
    {
        label: 'Zod',
        src: 'https://cdn.simpleicons.org/zod/3E67B1'
    },
    {
        label: 'Auth0',
        src: 'https://cdn.simpleicons.org/auth0/EB5424'
    },
    {
        label: 'Resend',
        src: 'https://cdn.simpleicons.org/resend/ffffff',
        tone: 'dark'
    },
    {
        label: 'Linear',
        src: 'https://cdn.simpleicons.org/linear/ffffff',
        tone: 'dark'
    }
];

/**
 * 8-col grid map: null = empty tile, number = TILES index
 * Same staggered pattern as the reference isometric ecosystem.
 */
const GRID: (number | null)[] = [
    null, 1, null, 2, null, 3, null, 4,
    5, null, 6, null, 0, null, 7, null,
    null, 8, null, 9, null, 10, null, 11,
    12, null, 13, null, 14, null, 15, null,
    null, 16, null, 17, null, 18, null, 19,
    null, null, null, null, null, null, null, null
];

function Tile({ item, index }: { item: TileItem | null; index: number }) {
    if (!item) {
        return (
            <div
                className="ecosystem-iso-tile ecosystem-iso-tile--empty"
                style={{ ['--tile-delay' as string]: `${(index % 9) * -0.36}s` }}
                aria-hidden
            />
        );
    }

    const tone = item.tone === 'dark' ? 'ecosystem-iso-tile--dark' : 'ecosystem-iso-tile--light';
    const crop = item.crop ? 'ecosystem-iso-tile--crop' : '';
    const brand = item.brand ? 'ecosystem-iso-tile--brand' : '';

    return (
        <div
            className={`ecosystem-iso-tile ${tone} ${crop} ${brand}`.trim()}
            style={{ ['--tile-delay' as string]: `${(index % 11) * -0.28}s` }}
        >
            {item.brand ? (
                <span className="ecosystem-iso-mark" aria-label={item.label}>
                    K<span />
                </span>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.src} alt={item.label} loading="lazy" width={120} height={120} />
            )}
        </div>
    );
}

export function EcosystemIso() {
    return (
        <div className="ecosystem-stage" aria-hidden>
            <div className="ecosystem-iso-scene relative mx-auto overflow-hidden">
                <div className="ecosystem-iso-plane">
                    <div className="ecosystem-iso-grid">
                        {GRID.map((id, index) => (
                            <Tile
                                key={`${id ?? 'empty'}-${index}`}
                                item={id === null ? null : TILES[id]}
                                index={index}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
