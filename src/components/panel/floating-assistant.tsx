"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, X, MessageSquare } from 'lucide-react';
import { ActiveChatInterface } from '../active-chat-interface';
import { cn } from '@/lib/utils';

export function FloatingAssistant() {
    const [isOpen, setIsOpen] = useState(false);

    // Position mainly for desktop. On mobile we override with CSS.
    // Default to bottom right for initial render
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);

    // For calculating drag deltas
    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setMounted(true);
        // Initial position for desktop (bottom-rightish)
        // We check window existence to be safe
        if (typeof window !== 'undefined') {
            setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
        }
    }, []);

    // Drag Logic (Only active on Desktop via hidden MD classes)
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow dragging on desktop (md and up) logic if needed, 
        // but easier to just let it work and override via CSS for mobile fixed.
        if (window.innerWidth < 768) return; // Prevent drag on mobile

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

        const handleMouseUp = () => {
            setIsDragging(false);
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

    // Mobile Fixed Styles vs Desktop Absolute/Fixed dynamic styles
    const desktopStyle = {
        left: position.x,
        top: position.y,
    };

    return (
        <>
            {/* 
                CHAT WINDOW 
                Mobile: Fixed full screen or large bottom sheet
                Desktop: Fixed at dragged position
            */}
            <div
                className={cn(
                    "fixed z-[100] transition-all duration-300",
                    isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none",
                    // Mobile: Inset 4 (full screenish with margin) or bottom-0
                    "max-md:inset-0 max-md:p-0 max-md:bg-black/50 max-md:flex max-md:items-end max-md:justify-center",
                    // Desktop: Dynamic positioning handled by style
                )}
            >
                {/* Overlay for mobile to close on click outside */}
                <div
                    className="md:hidden absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />

                <div
                    style={typeof window !== 'undefined' && window.innerWidth >= 768 ? {
                        left: position.x - 320, // Offset to show to the left of cursor/trigger
                        top: position.y - 500,  // Offset to show above
                        position: 'fixed'
                    } : {}}
                    className={cn(
                        "bg-gray-900 border border-white/10 overflow-hidden shadow-2xl flex flex-col",
                        // Mobile specific dimensions
                        "max-md:relative max-md:w-full max-md:h-[85vh] max-md:rounded-t-2xl max-md:rounded-b-none",
                        // Desktop specific dimensions
                        "md:w-[380px] md:h-[600px] md:rounded-2xl"
                    )}
                >
                    {/* Header is now inside ActiveChatInterface but we add a drag handler strip for desktop */}
                    <div
                        className="hidden md:block h-2 w-full bg-transparent cursor-move absolute top-0 z-50 hover:bg-white/5"
                        onMouseDown={handleMouseDown}
                    />

                    <ActiveChatInterface
                        onClose={() => setIsOpen(false)}
                        className="h-full"
                    />
                </div>
            </div>

            {/* 
                TRIGGER BUTTON
                Mobile: Fixed Bottom Right
                Desktop: Dragged Position
            */}
            <div
                style={typeof window !== 'undefined' && window.innerWidth >= 768 ? desktopStyle : {}}
                className={cn(
                    "fixed z-[90] cursor-pointer group",
                    // Mobile Position defaults
                    "max-md:bottom-6 max-md:right-6 max-md:left-auto max-md:top-auto",
                    isOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
                )}
                onMouseDown={handleMouseDown}
                onClick={() => {
                    if (!isDragging) setIsOpen(true);
                }}
            >
                <div className={cn(
                    "w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-200 border border-white/20 group-active:scale-95 shadow-blue-900/20",
                    "bg-gradient-to-br from-zinc-800 to-black ring-1 ring-white/10"
                )}>
                    {/* Glowing effect */}
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />

                    <Bot className="text-white relative z-10" size={26} />

                    {/* Notification Dot */}
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                    </span>
                </div>
            </div>
        </>
    );
}
