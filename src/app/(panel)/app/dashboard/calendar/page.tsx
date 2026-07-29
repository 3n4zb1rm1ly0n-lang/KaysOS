'use client';

import { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/supabase';

interface CalendarEvent {
    id: string;
    date: string;
    title: string;
    amount: string;
    type: 'domains' | 'projects';
}

const EventBadge = ({ type, title, amount }: { type: string; title: string; amount: string }) => {
    const getStyle = () => {
        switch (type) {
            case 'domains':
                return 'bg-teal-500/10 text-teal-400 border-teal-500/25';
            case 'projects':
                return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';
            default:
                return 'bg-gray-500/10 text-gray-500';
        }
    };

    return (
        <div
            className={`text-[10px] px-1.5 py-0.5 rounded border mb-1 truncate ${getStyle()}`}
            title={`${title} - ${amount}`}
        >
            <span className="font-semibold">{amount}</span> - {title}
        </div>
    );
};

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);

    useEffect(() => {
        fetchAllEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    const fetchAllEvents = async () => {
        setLoading(true);
        try {
            const startDateStr = format(startOfWeek(firstDayOfMonth), 'yyyy-MM-dd');
            const endDateStr = format(endOfWeek(lastDayOfMonth), 'yyyy-MM-dd');

            const [domainsExpiryRes, domainsPurchasedRes, projectsCalRes] = await Promise.all([
                supabase
                    .from('domains')
                    .select('id, hostname, expires_at, annual_cost')
                    .gte('expires_at', startDateStr)
                    .lte('expires_at', endDateStr),
                supabase
                    .from('domains')
                    .select('id, hostname, purchased_at')
                    .gte('purchased_at', startDateStr)
                    .lte('purchased_at', endDateStr),
                supabase
                    .from('projects')
                    .select('id, title, target_end_date')
                    .gte('target_end_date', startDateStr)
                    .lte('target_end_date', endDateStr)
            ]);

            const newEvents: CalendarEvent[] = [];

            if (!domainsExpiryRes.error && domainsExpiryRes.data) {
                domainsExpiryRes.data.forEach((d: {
                    id: string;
                    hostname: string;
                    expires_at: string | null;
                    annual_cost: number | null;
                }) => {
                    if (!d.expires_at) return;
                    const cost =
                        d.annual_cost != null
                            ? `₺${Number(d.annual_cost).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
                            : 'Yenileme';
                    newEvents.push({
                        id: `dom-exp-${d.id}`,
                        date: d.expires_at,
                        title: d.hostname,
                        amount: cost,
                        type: 'domains'
                    });
                });
            }

            if (!domainsPurchasedRes.error && domainsPurchasedRes.data) {
                domainsPurchasedRes.data.forEach((d: {
                    id: string;
                    hostname: string;
                    purchased_at: string | null;
                }) => {
                    if (!d.purchased_at) return;
                    newEvents.push({
                        id: `dom-buy-${d.id}`,
                        date: d.purchased_at,
                        title: d.hostname,
                        amount: 'Satın alma',
                        type: 'domains'
                    });
                });
            }

            if (!projectsCalRes.error && projectsCalRes.data) {
                projectsCalRes.data.forEach((p: {
                    id: string;
                    title: string | null;
                    target_end_date: string | null;
                }) => {
                    if (!p.target_end_date) return;
                    newEvents.push({
                        id: `proj-${p.id}`,
                        date: p.target_end_date,
                        title: p.title || 'Proje',
                        amount: 'Hedef bitiş',
                        type: 'projects'
                    });
                });
            }

            setEvents(newEvents);
        } catch (error) {
            console.error('Error fetching calendar events', error);
        } finally {
            setLoading(false);
        }
    };

    const startDate = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const endDate = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Takvim</h2>
                    <p className="text-muted-foreground">
                        Domain yenilemeleri ve proje hedef tarihleri.
                        {loading ? ' Yükleniyor…' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToToday}
                        className="px-3 py-1.5 text-sm font-medium bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                    >
                        Bugün
                    </button>
                    <div className="flex items-center bg-secondary rounded-md">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-l-md">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-4 font-medium min-w-[140px] text-center capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: tr })}
                        </span>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-r-md">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-teal-500" /> Domainler
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-500" /> Projeler
                </div>
            </div>

            <div className="flex-1 bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-7 border-b bg-secondary/30">
                    {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(
                        (day) => (
                            <div
                                key={day}
                                className="py-2 text-center text-sm font-semibold text-muted-foreground"
                            >
                                {day}
                            </div>
                        )
                    )}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {days.map((day) => {
                        const dayEvents = events.filter((event) =>
                            isSameDay(parseISO(event.date), day)
                        );
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
                                    <span
                                        className={`
                      text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-primary text-primary-foreground' : ''}
                    `}
                                    >
                                        {format(day, 'd')}
                                    </span>
                                </div>

                                <div className="space-y-1 overflow-y-auto max-h-[90px] scrollbar-hide">
                                    {dayEvents.map((event) => (
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
