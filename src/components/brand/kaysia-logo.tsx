import { cn } from '@/lib/utils';

type KaysiaLogoProps = {
    className?: string;
    /** Sadece ızgara işareti (favicon / küçük yerler) */
    markOnly?: boolean;
    /** mark boyutu (px sınıfları yerine) */
    markClassName?: string;
    wordmarkClassName?: string;
};

/** Resmi Kaysia logosu: 2×2 ızgara, dolu hücre sağ alt (90° sağa). */
export function KaysiaLogo({
    className,
    markOnly = false,
    markClassName,
    wordmarkClassName
}: KaysiaLogoProps) {
    return (
        <span className={cn('inline-flex items-center gap-2.5', className)}>
            <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn('h-8 w-8 shrink-0 text-white', markClassName)}
                aria-hidden={markOnly ? undefined : true}
                role={markOnly ? 'img' : undefined}
                aria-label={markOnly ? 'Kaysia' : undefined}
            >
                {/* Dış kare + ızgara */}
                <rect
                    x="1.5"
                    y="1.5"
                    width="37"
                    height="37"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
                <line
                    x1="20"
                    y1="1.5"
                    x2="20"
                    y2="38.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
                <line
                    x1="1.5"
                    y1="20"
                    x2="38.5"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
                {/* Dolu hücre: sağ alt (üst sağdan 90° saat yönü) */}
                <rect x="20.75" y="20.75" width="16.75" height="16.75" fill="currentColor" />
            </svg>
            {!markOnly && (
                <span
                    className={cn(
                        'font-display text-lg tracking-[0.28em] text-white uppercase md:text-xl',
                        wordmarkClassName
                    )}
                >
                    Kaysia
                </span>
            )}
        </span>
    );
}
