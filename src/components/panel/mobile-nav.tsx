
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Settings, LogOut } from 'lucide-react';
import { INITIAL_MENU_ITEMS } from './sidebar';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="md:hidden sticky top-0 z-40 bg-background border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg">KaysiOS</span>
            </div>

            {/* Mobile Drawer Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="relative w-[300px] h-full bg-background border-r p-6 flex flex-col animate-in slide-in-from-left duration-200">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white">KaysiOS</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <nav className="flex-1 space-y-2">
                            {INITIAL_MENU_ITEMS.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-secondary/50 transition-colors"
                                >
                                    <item.icon className="w-5 h-5 text-muted-foreground" />
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </nav>

                        <div className="pt-6 border-t mt-auto space-y-2">
                            <Link
                                href="/dashboard/settings"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-secondary/50 transition-colors"
                            >
                                <Settings className="w-5 h-5 text-muted-foreground" />
                                <span>Ayarlar</span>
                            </Link>
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                <LogOut className="w-5 h-5" />
                                <span>Çıkış Yap</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
