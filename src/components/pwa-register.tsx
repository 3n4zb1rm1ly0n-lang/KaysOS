'use client';

import { useEffect } from 'react';

/** Production’da service worker kaydı. */
export function PwaRegister() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (process.env.NODE_ENV !== 'production') return;
        if (!('serviceWorker' in navigator)) return;

        const register = () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                /* sessiz */
            });
        };

        if (document.readyState === 'complete') register();
        else window.addEventListener('load', register, { once: true });
    }, []);

    return null;
}
