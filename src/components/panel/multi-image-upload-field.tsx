'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, GripVertical } from 'lucide-react';
import { uploadProjectImage } from '@/lib/project-image-upload';

type Props = {
    label: string;
    hint?: string;
    value: string[];
    onChange: (urls: string[]) => void;
    folder?: 'logos' | 'covers';
    max?: number;
};

export function MultiImageUploadField({
    label,
    hint,
    value,
    onChange,
    folder = 'covers',
    max = 12
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFiles = useCallback(
        async (files: FileList | File[] | null) => {
            if (!files?.length) return;
            const remaining = max - value.length;
            if (remaining <= 0) {
                setError(`En fazla ${max} görsel ekleyebilirsiniz.`);
                return;
            }
            const list = Array.from(files).slice(0, remaining);
            setError(null);
            setUploading(true);
            const next = [...value];
            for (const file of list) {
                const result = await uploadProjectImage(file, folder);
                if ('error' in result) {
                    setError(result.error);
                    break;
                }
                next.push(result.url);
            }
            onChange(next);
            setUploading(false);
        },
        [folder, max, onChange, value]
    );

    const removeAt = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const move = (from: number, dir: -1 | 1) => {
        const to = from + dir;
        if (to < 0 || to >= value.length) return;
        const next = [...value];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">{label}</label>

            {value.length > 0 && (
                <ul className="space-y-2">
                    {value.map((url, idx) => (
                        <li
                            key={`${url}-${idx}`}
                            className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-2"
                        >
                            <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background border border-border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] text-muted-foreground truncate">{url}</p>
                                <div className="flex gap-1 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => move(idx, -1)}
                                        disabled={idx === 0}
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-border disabled:opacity-30"
                                    >
                                        ←
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(idx, 1)}
                                        disabled={idx === value.length - 1}
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-border disabled:opacity-30"
                                    >
                                        →
                                    </button>
                                </div>
                            </div>
                            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                            <button
                                type="button"
                                onClick={() => removeAt(idx)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                aria-label="Kaldır"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div
                onDragEnter={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragging(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void handleFiles(e.dataTransfer.files);
                }}
                className={`rounded-xl border border-dashed transition-colors ${
                    dragging
                        ? 'border-primary bg-primary/10'
                        : 'border-border/80 bg-secondary/20 hover:border-primary/40'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                        void handleFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
                <button
                    type="button"
                    disabled={uploading || value.length >= max}
                    onClick={() => inputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center disabled:opacity-50"
                >
                    {uploading ? (
                        <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    ) : (
                        <ImagePlus className="w-7 h-7 text-muted-foreground" />
                    )}
                    <span className="text-sm text-foreground">
                        {uploading
                            ? 'Yükleniyor…'
                            : 'Site görselleri — sürükle veya seç (çoklu)'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        {value.length}/{max} · PNG/JPG/WEBP · max 5 MB
                    </span>
                </button>
            </div>

            {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
            {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
    );
}
