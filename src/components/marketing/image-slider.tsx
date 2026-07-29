'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ImageSlider({
    images,
    alt = '',
    className = '',
    overlay
}: {
    images: string[];
    alt?: string;
    className?: string;
    overlay?: React.ReactNode;
}) {
    const [index, setIndex] = useState(0);
    const list = images.filter(Boolean);

    useEffect(() => {
        setIndex(0);
    }, [list.join('|')]);

    useEffect(() => {
        if (list.length <= 1) return;
        const t = window.setInterval(() => {
            setIndex((i) => (i + 1) % list.length);
        }, 4200);
        return () => window.clearInterval(t);
    }, [list.length]);

    if (list.length === 0) {
        return (
            <div className={`relative overflow-hidden bg-gradient-to-b from-white/[0.06] to-transparent ${className}`}>
                {overlay}
            </div>
        );
    }

    const go = (dir: -1 | 1) => {
        setIndex((i) => (i + dir + list.length) % list.length);
    };

    return (
        <div className={`relative overflow-hidden bg-[#0a0d11] ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={list[index]}
                alt={alt}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d11]/85 via-[#0a0d11]/25 to-transparent" />
            {overlay && (
                <div className="relative z-10 flex h-full items-center justify-center p-6">
                    {overlay}
                </div>
            )}
            {list.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            go(-1);
                        }}
                        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/90 hover:bg-black/70"
                        aria-label="Önceki"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            go(1);
                        }}
                        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/90 hover:bg-black/70"
                        aria-label="Sonraki"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
                        {list.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIndex(i);
                                }}
                                className={`h-1.5 rounded-full transition-all ${
                                    i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                                }`}
                                aria-label={`Görsel ${i + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
