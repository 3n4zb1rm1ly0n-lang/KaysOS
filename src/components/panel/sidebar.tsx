
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    LayoutDashboard,
    Settings,
    TrendingDown,
    TrendingUp,
    CreditCard,
    Calculator,
    LogOut,
    Calendar,
    Receipt,
    GripVertical,
    Wallet,
    FileText
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MenuItem {
    id: string;
    label: string;
    href: string;
    icon: any;
}

export const INITIAL_MENU_ITEMS: MenuItem[] = [
    { id: '1', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { id: '2', label: 'Gelirler', href: '/dashboard/incomes', icon: TrendingUp },
    { id: '3', label: 'Borçlar', href: '/dashboard/debts', icon: CreditCard },
    { id: '4', label: 'Faturalar', href: '/dashboard/invoices', icon: Receipt },
    { id: '5', label: 'Gider', href: '/dashboard/expenses', icon: TrendingDown },
    { id: '6', label: 'Muhasebe', href: '/dashboard/reports', icon: FileText },
    { id: '7', label: 'Takvim', href: '/dashboard/calendar', icon: Calendar },
    { id: '8', label: 'Birikim', href: '/dashboard/savings', icon: Wallet },
];

function SortableMenuItem({ item }: { item: MenuItem }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="mb-2">
            <div
                className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isDragging ? 'bg-secondary/80 shadow-lg' : 'hover:bg-secondary/50'}`}
            >
                <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-muted-foreground/50 hover:text-muted-foreground">
                    <GripVertical className="w-4 h-4" />
                </div>
                <Link href={item.href} className="flex-1 flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span>{item.label}</span>
                </Link>
            </div>
        </div>
    );
}

export function Sidebar() {
    const [items, setItems] = useState(INITIAL_MENU_ITEMS);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    return (
        <aside className="hidden md:flex w-64 border-r h-full bg-background flex-col fixed left-0 top-0 overflow-y-auto z-50">
            <div className="p-6 border-b">
                <h1 className="text-xl font-bold text-white">
                    KaysiOS
                </h1>
            </div>

            <nav className="flex-1 p-4">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={items}
                        strategy={verticalListSortingStrategy}
                    >
                        {items.map((item) => (
                            <SortableMenuItem key={item.id} item={item} />
                        ))}
                    </SortableContext>
                </DndContext>
            </nav>

            <div className="p-4 border-t mt-auto">
                <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-secondary/50 transition-colors mb-2"
                >
                    <Settings className="w-5 h-5 text-muted-foreground" />
                    <span>Ayarlar</span>
                </Link>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span>Çıkış Yap</span>
                </button>
            </div>
        </aside>
    );
}
