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
}

export function ActiveChatInterface({ className }: ActiveChatInterfaceProps) {
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

            const botMessage: Message = {
                role: 'assistant',
                content: data.content || "Üzgünüm, bu isteği işleyemedim."
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Üzgünüm, bir hata oluştu. Lütfen bağlantınızı veya API anahtarınızı kontrol edin." }]);
        } finally {
            setLoading(false);
        }
    };

    // Helper for suggestions (Turkish)
    const suggestions = [
        "Bu ayki nakit akışım nasıl?",
        "Vadesi yaklaşan borçlarım neler?",
        "Market için 5000 TL bütçe ayarla."
    ];

    return (
        <div className={cn("flex flex-col h-full bg-gray-900 text-gray-100", className)}>
            <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-gray-700">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                        <Bot size={48} className="text-blue-500 opacity-50" />
                        <p className="text-lg text-center">Kaysia Finans Asistanı</p>
                        <div className="flex flex-col gap-2 text-sm w-full">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(s)}
                                    className="p-2 bg-gray-800 rounded hover:bg-gray-700 transition text-left"
                                >
                                    "{s}"
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`flex items-start max-w-[85%] space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                                }`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-green-600'
                                    }`}
                            >
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div
                                className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex items-center space-x-2 bg-gray-800 p-3 rounded-lg rounded-tl-none border border-gray-700">
                            <Loader2 size={16} className="animate-spin text-gray-400" />
                            <span className="text-xs text-gray-400">Analiz ediliyor...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 p-3 bg-gray-900 border-t border-gray-800">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Bir şey sorun..."
                    className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 border border-gray-700"
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
}
