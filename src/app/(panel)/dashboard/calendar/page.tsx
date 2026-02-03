
'use client';

import { useState } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    getDay,
    startOfWeek,
    endOfWeek,
    parseISO
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Mock Data - In a real app, this would come from your global state or API
const EVENTS = [
    { id: '1', date: '2024-02-03', title: 'Günlük Kasa', amount: '₺12,450', type: 'incomes' },
    { id: '2', date: '2024-02-01', title: 'Kira Ödemesi', amount: '₺12,000', type: 'invoices' },
    { id: '3', date: '2024-02-15', title: 'Elektrik Faturası', amount: '₺1,500', type: 'invoices' },
    { id: '4', date: '2024-02-15', title: 'Tedarikçi A.Ş.', amount: '₺5,000', type: 'debts' },
    { id: '5', date: '2024-02-03', title: 'Metro Market', amount: '₺1,250', type: 'expenses' },
];

const EventBadge = ({ type, title, amount }: { type: string, title: string, amount: string }) => {
    const getStyle = () => {
        switch (type) {
            case 'incomes': return 'bg-green-500/10 text-green-500 border-green-500/20'; // Gelirler
            case 'invoices': return 'bg-orange-500/10 text-orange-500 border-orange-500/20'; // Faturalar
            case 'debts': return 'bg-red-500/10 text-red-500 border-red-500/20'; // Borçlar
            case 'expenses': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'; // Giderler
            default: return 'bg-gray-500/10 text-gray-500';
        }
    };

    return (
        <div className={`text-[10px] px-1.5 py-0.5 rounded border mb-1 truncate ${getStyle()}`}>
            <span className="font-semibold">{amount}</span> - {title}
        </div>
    );
};

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());

    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);

    // Takvim grid'i için haftanın başından ve sonundan günleri al
    const startDate = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }); // Pazartesi başlar
    const endDate = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Finansal Takvim</h2>
                    <p className="text-muted-foreground">Tüm ödemelerinizi ve tahsilatlarınızı gün gün görün.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium bg-secondary rounded-md hover:bg-secondary/80 transition-colors">Bugün</button>
                    <div className="flex items-center bg-secondary rounded-md">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-l-md"><ChevronLeft className="w-5 h-5" /></button>
                        <span className="px-4 font-medium min-w-[140px] text-center capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: tr })}
                        </span>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-r-md"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> Gelirler</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span> Faturalar</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Borçlar</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Giderler</div>
            </div>

            <div className="flex-1 bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b bg-secondary/30">
                    {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day) => (
                        <div key={day} className="py-2 text-center text-sm font-semibold text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {days.map((day, dayIdx) => {
                        // O güne ait eventleri bul
                        const dayEvents = EVENTS.filter(event => isSameDay(parseISO(event.date), day));
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isToday = isSameDay(day, new Date());

                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                        return (
                            <div
                                key={day.toString()}
                                className={`
                  min-h-[120px] p-2 border-b border-r last:border-r-0 relative group transition-colors
                  ${!isCurrentMonth ? 'bg-black/40 text-muted-foreground/30' : isWeekend ? 'bg-white/5' : 'bg-background'}
                  ${isToday ? 'ring-2 ring-red-500 bg-blue-500/10 z-10' : ''}
                  hover:bg-secondary/20
                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`
                      text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-primary text-primary-foreground' : ''}
                    `}>
                                        {format(day, 'd')}
                                    </span>
                                </div>

                                <div className="space-y-1 overflow-y-auto max-h-[90px] scrollbar-hide">
                                    {dayEvents.map(event => (
                                        <EventBadge
                                            key={event.id}
                                            type={event.type}
                                            title={event.title}
                                            amount={event.amount}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
