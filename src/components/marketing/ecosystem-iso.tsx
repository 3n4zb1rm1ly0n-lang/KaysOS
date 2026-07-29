'use client';

import type { EcosystemItem } from '@/lib/ecosystem-types';
import { normalizeTileTone } from '@/lib/ecosystem-types';

/** Fixed staggered pattern: null = empty, 0 = brand center, >0 = item slot order */
const GRID: (number | null)[] = [
    null, 1, null, 2, null, 3, null, 4,
    5, null, 6, null, 0, null, 7, null,
    null, 8, null, 9, null, 10, null, 11,
    12, null, 13, null, 14, null, 15, null,
    null, 16, null, 17, null, 18, null, 19,
    null, null, null, null, null, null, null, null
];

type TileProps = {
    index: number;
    kind: 'empty' | 'brand' | 'item';
    item?: EcosystemItem;
    onSelect?: (id: string) => void;
};

function Tile({ index, kind, item, onSelect }: TileProps) {
    const delay = `${(index % 11) * -0.28}s`;

    if (kind === 'empty') {
        return (
            <div
                className="ecosystem-iso-tile ecosystem-iso-tile--empty"
                style={{ ['--tile-delay' as string]: `${(index % 9) * -0.36}s` }}
                aria-hidden
            />
        );
    }

    if (kind === 'brand') {
        return (
            <div
                className="ecosystem-iso-tile ecosystem-iso-tile--brand"
                style={{ ['--tile-delay' as string]: delay }}
            >
                <span className="ecosystem-iso-mark" aria-label="Kaysia">
                    K<span />
                </span>
            </div>
        );
    }

    const tone =
        normalizeTileTone(item?.tile_tone) === 'dark'
            ? 'ecosystem-iso-tile--dark'
            : 'ecosystem-iso-tile--light';

    const interactive = Boolean(item && onSelect);

    const inner = item?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.logo_url} alt={item.name} loading="lazy" width={120} height={120} />
    ) : (
        <span className="ecosystem-iso-mark" style={{ fontSize: '2rem', letterSpacing: 0 }}>
            {(item?.name || '?').slice(0, 1)}
        </span>
    );

    if (interactive && item) {
        return (
            <button
                type="button"
                className={`ecosystem-iso-tile ${tone}`}
                style={{ ['--tile-delay' as string]: delay }}
                onClick={() => onSelect?.(item.id)}
                aria-label={`${item.name} detayını aç`}
            >
                {inner}
            </button>
        );
    }

    return (
        <div className={`ecosystem-iso-tile ${tone}`} style={{ ['--tile-delay' as string]: delay }}>
            {inner}
        </div>
    );
}

export function EcosystemIso({
    items = [],
    onSelectItem
}: {
    items?: EcosystemItem[];
    onSelectItem?: (id: string) => void;
}) {
    let cursor = 0;

    const cells = GRID.map((slot, index) => {
        if (slot === null) {
            return <Tile key={`e-${index}`} index={index} kind="empty" />;
        }
        if (slot === 0) {
            return <Tile key={`b-${index}`} index={index} kind="brand" />;
        }
        const item = items[cursor++];
        if (!item) {
            return <Tile key={`e-${index}`} index={index} kind="empty" />;
        }
        return (
            <Tile
                key={`i-${item.id}-${index}`}
                index={index}
                kind="item"
                item={item}
                onSelect={onSelectItem}
            />
        );
    });

    return (
        <div className="ecosystem-stage">
            <div className="ecosystem-iso-scene relative mx-auto overflow-hidden">
                <div className="ecosystem-iso-plane">
                    <div className="ecosystem-iso-grid">{cells}</div>
                </div>
            </div>
        </div>
    );
}
