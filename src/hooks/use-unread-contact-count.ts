'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Okunmamış iletişim mesajı sayısı — sidebar badge. */
export function useUnreadContactCount(pollMs = 30_000) {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        const { count: c, error } = await supabase
            .from('contact_messages')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);
        if (!error && typeof c === 'number') setCount(c);
    }, []);

    useEffect(() => {
        void refresh();
        const id = window.setInterval(() => void refresh(), pollMs);
        const onFocus = () => void refresh();
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(id);
            window.removeEventListener('focus', onFocus);
        };
    }, [refresh, pollMs]);

    return { count, refresh };
}

export function UnreadBadge({ count }: { count: number }) {
    if (count <= 0) return null;
    const label = count > 99 ? '99+' : String(count);
    return (
        <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {label}
        </span>
    );
}
