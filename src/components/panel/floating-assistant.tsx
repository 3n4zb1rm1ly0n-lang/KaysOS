"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, X, MessageSquare } from 'lucide-react';
import { ActiveChatInterface } from '../active-chat-interface';
import { cn } from '@/lib/utils'; // Adjust path if needed

export function FloatingAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });

    // Initial position on mount (bottom-right)
    useEffect(() => {
        setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });

        const handleResize = () => {
            // Optional: ensure it stays in bounds on resize
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
            setPosition({
                x: initialPos.current.x + dx,
                y: initialPos.current.y + dy
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isDragging) {
                // Determine if it was a click or drag
                const dist = Math.sqrt(
                    Math.pow(e.clientX - dragStart.current.x, 2) +
                    Math.pow(e.clientY - dragStart.current.y, 2)
                );

                if (dist < 5) {
                    // It was a click (mostly)
                    // We handle click in OnClick, but if dragging took place we suppress click.
                    // Actually let's handle click separate.
                }
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

    const toggleOpen = () => {
        if (!isDragging) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <>
            {/* Chat Window */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        left: position.x - 300, // Show to left of icon
                        top: position.y - 450, // Show above icon
                        zIndex: 50
                    }}
                    className="w-[350px] h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900 flex flex-col animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 cursor-move" onMouseDown={handleMouseDown}>
                        <div className="flex items-center gap-2">
                            <Bot className="text-blue-500" size={20} />
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
                        // Simple check to prevent drag-click conflict could be done here too
                        // But for now relying on logic is fine
                        if (!isDragging) setIsOpen(true);
                    }}
                >
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200 border-2 border-white/10 group-active:scale-95">
                        <Bot className="text-white" size={28} />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse" />
                    </div>
                </div>
            )}
        </>
    );
}
