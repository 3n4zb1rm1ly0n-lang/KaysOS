'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import { ActiveChatInterface } from '@/components/active-chat-interface';

export default function AssistantPage() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto h-[calc(100vh-5.5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
            <header className="mb-4 flex items-end justify-between gap-3 shrink-0">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Bot className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wide">ChatGPT</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Asistan</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Supabase verilerini okur ve yorumlar. Fikir balonu ayrıdır; burası gerçek model.
                    </p>
                </div>
                <Link
                    href="/app/dashboard/ai-usage"
                    className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary/50 shrink-0"
                >
                    Token maliyet
                </Link>
            </header>
            <div className="flex-1 min-h-0 rounded-xl border border-border overflow-hidden bg-background">
                <ActiveChatInterface />
            </div>
        </div>
    );
}
