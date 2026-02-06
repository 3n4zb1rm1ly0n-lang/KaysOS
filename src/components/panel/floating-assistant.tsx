"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, X } from 'lucide-react';
import { ActiveChatInterface } from '../active-chat-interface';
import { cn } from '@/lib/utils';

type ColorTheme = 'blue' | 'purple' | 'green' | 'orange' | 'red';

const colorMap: Record<ColorTheme, string> = {
    blue: 'from-blue-600 to-indigo-700',
    purple: 'from-purple-600 to-pink-700',
    green: 'from-emerald-500 to-green-700',
    orange: 'from-orange-500 to-red-600',
    red: 'from-red-600 to-rose-700',
};

const iconColorMap: Record<ColorTheme, string> = {
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    green: 'text-emerald-500',
    orange: 'text-orange-500',
    red: 'text-red-500',
};

export function FloatingAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    // Initialize with 0 to avoid SSR mismatch, update in effect
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState<ColorTheme>('blue');

    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });

    // Handle Mount & Theme
    useEffect(() => {
        setMounted(true);
        // Set initial position based on window
        setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });

        // Load saved theme
        const saved = localStorage.getItem('assistant_color') as ColorTheme;
        if (saved && colorMap[saved]) {
            setTheme(saved);
        }

        const handleResize = () => {
            // Optional: ensure it stays in bounds on resize
        };

        const handleThemeChange = () => {
            const newTheme = localStorage.getItem('assistant_color') as ColorTheme;
            if (newTheme && colorMap[newTheme]) {
                setTheme(newTheme);
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('assistant-color-change', handleThemeChange);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('assistant-color-change', handleThemeChange);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target instanceof Element && e.target.closest('.close-btn')) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        initialPos.current = { ...position };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;

            // Simple boundary check could be added here
            setPosition({
                x: initialPos.current.x + dx,
                y: initialPos.current.y + dy
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isDragging) {
                setIsDragging(false);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!mounted) return null;

    return (
        <>
            {/* Chat Window */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        left: position.x - 300,
                        top: position.y - 450,
                        zIndex: 50
                    }}
                    className="w-[350px] h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900 flex flex-col animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 cursor-move" onMouseDown={handleMouseDown}>
                        <div className="flex items-center gap-2">
                            <Bot className={cn("transition-colors", iconColorMap[theme])} size={20} />
                            <span className="font-medium text-sm">Finans Asistanı</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white close-btn"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <ActiveChatInterface className="flex-1" />
                </div>
            )}

            {/* Floating Trigger Button */}
            {!isOpen && (
                <div
                    style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 50 }}
                    className="cursor-pointer group"
                    onMouseDown={handleMouseDown}
                    onClick={(e) => {
                        if (!isDragging) setIsOpen(true);
                    }}
                >
                    <div className={cn(
                        "w-14 h-14 bg-gradient-to-br rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-200 border-2 border-white/10 group-active:scale-95",
                        colorMap[theme]
                    )}>
                        <Bot className="text-white" size={28} />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse" />
                    </div>
                </div>
            )}
        </>
    );
}
