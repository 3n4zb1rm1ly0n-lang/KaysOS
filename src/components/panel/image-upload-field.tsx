'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Link2 } from 'lucide-react';
import { uploadProjectImage } from '@/lib/project-image-upload';

type Props = {
    label: string;
    hint?: string;
    value: string;
    onChange: (url: string) => void;
    folder?: 'logos' | 'covers';
};

export function ImageUploadField({
    label,
    hint,
    value,
    onChange,
    folder = 'logos'
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showUrl, setShowUrl] = useState(false);

    const handleFiles = useCallback(
        async (files: FileList | File[] | null) => {
            const file = files?.[0];
            if (!file) return;
            setError(null);
            setUploading(true);
            const result = await uploadProjectImage(file, folder);
            setUploading(false);
            if ('error' in result) {
                setError(result.error);
                return;
            }
            onChange(result.url);
        },
        [folder, onChange]
    );

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-muted-foreground">{label}</label>
                <button
                    type="button"
                    onClick={() => setShowUrl((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                    <Link2 className="w-3 h-3" />
                    {showUrl ? 'URL gizle' : 'URL ile yapıştır'}
                </button>
            </div>

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
                onDrop={onDrop}
                className={`relative rounded-xl border border-dashed transition-colors ${
                    dragging
                        ? 'border-primary bg-primary/10'
                        : 'border-border/80 bg-secondary/20 hover:border-primary/40'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="sr-only"
                    onChange={(e) => {
                        void handleFiles(e.target.files);
                        e.target.value = '';
                    }}
                />

                {value ? (
                    <div className="flex items-center gap-3 p-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                            <p className="truncate text-xs text-muted-foreground">{value}</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => inputRef.current?.click()}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary/50 disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <ImagePlus className="w-3.5 h-3.5" />
                                    )}
                                    Değiştir
                                </button>
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => onChange('')}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Kaldır
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => inputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center gap-2 px-4 py-8 text-center disabled:opacity-50"
                    >
                        {uploading ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        ) : (
                            <ImagePlus className="w-8 h-8 text-muted-foreground" />
                        )}
                        <span className="text-sm text-foreground">
                            {uploading
                                ? 'Yükleniyor…'
                                : 'Sürükleyip bırakın veya dosya seçin'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                            PNG, JPG, WEBP, GIF, SVG · max 5 MB
                        </span>
                    </button>
                )}
            </div>

            {showUrl && (
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="https://…/logo.png"
                />
            )}

            {hint && !error && (
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            )}
            {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
    );
}
