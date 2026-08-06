'use client';

import { type ReactNode } from 'react';
import {
    motion,
    useReducedMotion,
    type Variants
} from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 28 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, ease: EASE }
    }
};

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { duration: 0.55, ease: EASE }
    }
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.96, y: 16 },
    show: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.55, ease: EASE }
    }
};

export const stagger: Variants = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.1, delayChildren: 0.06 }
    }
};

export const staggerFast: Variants = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.07, delayChildren: 0.04 }
    }
};

function withDelay(variants: Variants, delay: number): Variants {
    if (!delay) return variants;
    const show = variants.show;
    if (!show || typeof show !== 'object') return variants;
    const prev = 'transition' in show && show.transition && typeof show.transition === 'object'
        ? show.transition
        : {};
    return {
        ...variants,
        show: {
            ...show,
            transition: { ...prev, delay }
        }
    };
}

/** Scroll-triggered reveal; respects prefers-reduced-motion */
export function Reveal({
    children,
    className,
    variants = fadeUp,
    once = true,
    amount = 0.2,
    delay = 0
}: {
    children: ReactNode;
    className?: string;
    variants?: Variants;
    once?: boolean;
    amount?: number;
    delay?: number;
}) {
    const reduce = useReducedMotion();

    if (reduce) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={className}
            initial="hidden"
            whileInView="show"
            viewport={{ once, amount, margin: '0px 0px -8% 0px' }}
            variants={withDelay(variants, delay)}
        >
            {children}
        </motion.div>
    );
}

/** Parent for staggered children */
export function RevealGroup({
    children,
    className,
    variants = stagger,
    once = true,
    amount = 0.15,
    as = 'div'
}: {
    children: ReactNode;
    className?: string;
    variants?: Variants;
    once?: boolean;
    amount?: number;
    as?: 'div' | 'ul' | 'ol';
}) {
    const reduce = useReducedMotion();

    if (reduce) {
        if (as === 'ul') return <ul className={className}>{children}</ul>;
        if (as === 'ol') return <ol className={className}>{children}</ol>;
        return <div className={className}>{children}</div>;
    }

    const Comp = as === 'ul' ? motion.ul : as === 'ol' ? motion.ol : motion.div;

    return (
        <Comp
            className={className}
            initial="hidden"
            whileInView="show"
            viewport={{ once, amount, margin: '0px 0px -6% 0px' }}
            variants={variants}
        >
            {children}
        </Comp>
    );
}

export function RevealItem({
    children,
    className,
    variants = fadeUp,
    as = 'div'
}: {
    children: ReactNode;
    className?: string;
    variants?: Variants;
    as?: 'div' | 'li' | 'span';
}) {
    const reduce = useReducedMotion();

    if (reduce) {
        if (as === 'li') return <li className={className}>{children}</li>;
        if (as === 'span') return <span className={className}>{children}</span>;
        return <div className={className}>{children}</div>;
    }

    const Comp = as === 'li' ? motion.li : as === 'span' ? motion.span : motion.div;

    return (
        <Comp className={className} variants={variants}>
            {children}
        </Comp>
    );
}

/** Hero entrance — mount animation, not scroll */
export function HeroMotion({
    children,
    className,
    delay = 0
}: {
    children: ReactNode;
    className?: string;
    delay?: number;
}) {
    const reduce = useReducedMotion();

    if (reduce) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}

/** Soft fade-in for background architecture layer */
export function ArchitectureLayer({ children }: { children: ReactNode }) {
    const reduce = useReducedMotion();

    if (reduce) {
        return (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
                {children}
            </div>
        );
    }

    return (
        <motion.div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: EASE }}
        >
            {children}
        </motion.div>
    );
}

export { motion, useReducedMotion, EASE };
