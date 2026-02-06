"use client";

import { ActiveChatInterface } from '@/components/active-chat-interface';

// This page can now just wrap the component in a full-screen or card layout
// Or we can leave it as an alternative full view.

export default function AssistantPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-gray-800">
            <ActiveChatInterface className="h-full" />
        </div>
    );
}
