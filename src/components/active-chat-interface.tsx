"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, if not I'll standard clsx

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ActiveChatInterfaceProps {
    className?: string;
    onClose?: () => void;
}

export function ActiveChatInterface({ className, onClose }: ActiveChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('/api/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            // Parse content for Agent Prefix e.g. [MUDUR] ...
            let content = data.content || "Üzgünüm, bu isteği işleyemedim.";

            // Clean up the content but keep the prefix for internal logic if needed, 
            // or we'll just store the raw content and parse it during render.
            // Actually, let's keep it raw so we can style it in the render loop.

            const botMessage: Message = {
                role: 'assistant',
                content: content
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "[SISTEM] Üzgünüm, bir hata oluştu. Bağlantınızı kontrol edin." }]);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Parse Agent from content
    const getAgentStyle = (content: string) => {
        if (content.startsWith('[ASISTAN]')) return { name: 'Asistan', color: 'bg-zinc-950 border-amber-500/50 text-amber-500', icon: '🤖' };
        if (content.startsWith('[FINANS]')) return { name: 'Finansman', color: 'bg-emerald-900/50 border-emerald-500/50 text-emerald-400', icon: '💰' };
        if (content.startsWith('[MUHASEBE]')) return { name: 'Muhasebe', color: 'bg-blue-900/50 border-blue-500/50 text-blue-400', icon: 'calculator' };
        if (content.startsWith('[ANALIST]')) return { name: 'Analist', color: 'bg-purple-900/50 border-purple-500/50 text-purple-400', icon: 'chart' };
        if (content.startsWith('[OPERASYON]')) return { name: 'Operasyon', color: 'bg-orange-900/50 border-orange-500/50 text-orange-400', icon: '⚡' };
        if (content.startsWith('[SISTEM]')) return { name: 'Sistem', color: 'bg-red-900/50 border-red-500/50 text-red-400', icon: '⚠️' };
        return { name: 'Asistan', color: 'bg-gray-800', icon: '🤖' };
    };

    const cleanContent = (content: string) => {
        return content.replace(/^\[.*?\]\s*/, '');
    };

    const suggestions = [
        "Şirketin genel nakit durumu nasıl?",
        "Geçen ay ne kadar harcama yaptık?",
        "Vadesi geçen borçları listele.",
        "Kira için 10.000 TL bütçe ayarla."
    ];

    return (
        <div className={cn("flex flex-col h-full bg-black/40 text-gray-100 backdrop-blur-sm", className)}>
            {/* Header indicating the team */}
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                    <span className="flex items-center gap-1 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Asistan</span>
                    <span className="flex items-center gap-1 text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Finans</span>
                    <span className="flex items-center gap-1 text-blue-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Muhasebe</span>
                    <span className="flex items-center gap-1 text-purple-500"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />Analiz</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
                        <span className="sr-only">Kapat</span>
                        <div className="hover:bg-white/10 rounded-md p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </div>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 p-6 scrollbar-thin scrollbar-thumb-gray-800">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-6 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-25"></div>
                            <Bot size={64} className="relative text-white opacity-80" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-semibold text-white">Yönetim Kurulu Hazır</h3>
                            <p className="text-sm text-gray-400 max-w-xs mx-auto">
                                Finans, Muhasebe, Analiz ve Operasyon ekipleri talimatlarınızı bekliyor.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(s)}
                                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition text-left text-xs text-gray-300"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const agentStyle = msg.role === 'assistant' ? getAgentStyle(msg.content) : null;
                    const finalContent = msg.role === 'assistant' ? cleanContent(msg.content) : msg.content;

                    return (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <span className="text-[10px] uppercase tracking-wider font-bold mb-1 ml-1 opacity-50 flex items-center gap-1">
                                        {agentStyle?.icon === 'calculator' ? <span className="text-lg">🧮</span> :
                                            agentStyle?.icon === 'chart' ? <span className="text-lg">📊</span> :
                                                <span className="text-lg">{agentStyle?.icon}</span>}
                                        {agentStyle?.name}
                                    </span>
                                )}

                                <div
                                    className={`p-4 rounded-2xl whitespace-pre-wrap text-sm shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : `${agentStyle?.color || 'bg-zinc-800'} text-gray-100 rounded-tl-none border border-white/5`
                                        }`}
                                >
                                    {finalContent}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {loading && (
                    <div className="flex justify-start">
                        <div className="flex items-center space-x-3 bg-zinc-900/50 p-4 rounded-2xl rounded-tl-none border border-white/5">
                            <Loader2 size={16} className="animate-spin text-amber-500" />
                            <span className="text-xs text-amber-500 font-medium">Müdür ekipleri koordine ediyor...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3 p-4 bg-black/40 border-t border-white/5 backdrop-blur-xl">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Talimat verin..."
                    className="flex-1 bg-white/5 text-white px-5 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder-gray-500 border border-white/5 transition-all"
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
}
