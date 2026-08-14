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
import { DEFAULT_DUE_DAY, dueDateISO } from '@/lib/tax-installments';

type EventType =
    | 'domains'
    | 'projects'
    | 'debts'
    | 'expenses'
    | 'incomes'
    | 'tax'
    | 'bagkur'
    | 'fuel'
    | 'subscriptions';

interface CalendarEvent {
    id: string;
    date: string;
    title: string;
    amount: string;
    type: EventType;
}

function fmtMoney(n: number | null | undefined, fallback = ''): string {
    if (n == null || Number.isNaN(Number(n))) return fallback;
    return `₺${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
}

function dateOnly(value: string | null | undefined): string | null {
    if (!value) return null;
    return String(value).slice(0, 10);
}

function inRange(date: string | null, start: string, end: string): date is string {
    return !!date && date >= start && date <= end;
}

/** Her kategori net, doygun ve birbirinden ayırt edilebilir */
const EVENT_STYLES: Record<EventType, string> = {
    domains: 'bg-cyan-600 text-white border-cyan-400/80 shadow-sm shadow-cyan-900/40',
    projects: 'bg-blue-700 text-white border-blue-400/80 shadow-sm shadow-blue-900/40',
    debts: 'bg-red-600 text-white border-red-400/80 shadow-sm shadow-red-900/40',
    expenses: 'bg-amber-500 text-black border-amber-300 shadow-sm shadow-amber-900/30',
    incomes: 'bg-green-600 text-white border-green-400/80 shadow-sm shadow-green-900/40',
    tax: 'bg-orange-700 text-white border-orange-400/80 shadow-sm shadow-orange-900/40',
    bagkur: 'bg-sky-500 text-black border-sky-200 shadow-sm shadow-sky-900/30',
    fuel: 'bg-lime-400 text-black border-lime-200 shadow-sm shadow-lime-900/30',
    subscriptions: 'bg-fuchsia-600 text-white border-fuchsia-300/80 shadow-sm shadow-fuchsia-900/40'
};

const LEGEND: { type: EventType; label: string; color: string }[] = [
    { type: 'domains', label: 'Domainler', color: 'bg-cyan-600' },
    { type: 'projects', label: 'Projeler', color: 'bg-blue-700' },
    { type: 'debts', label: 'Borçlar', color: 'bg-red-600' },
    { type: 'expenses', label: 'Giderler', color: 'bg-amber-500' },
    { type: 'incomes', label: 'Gelirler', color: 'bg-green-600' },
    { type: 'tax', label: 'Vergi taksit', color: 'bg-orange-700' },
    { type: 'bagkur', label: 'Bağkur', color: 'bg-sky-500' },
    { type: 'fuel', label: 'Benzin', color: 'bg-lime-400' },
    { type: 'subscriptions', label: 'Abonelik', color: 'bg-fuchsia-600' }
];

const EventBadge = ({ type, title, amount }: { type: EventType; title: string; amount: string }) => (
    <div
        className={`text-[10px] px-1.5 py-0.5 rounded-md border mb-1 truncate font-medium ${EVENT_STYLES[type]}`}
        title={`${title} — ${amount}`}
    >
        <span className="font-bold">{amount}</span> — {title}
    </div>
);

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);

    useEffect(() => {
        void fetchAllEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    const fetchAllEvents = async () => {
        setLoading(true);
        try {
            const startDateStr = format(startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const endDateStr = format(endOfWeek(lastDayOfMonth, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const rangeStartY = Number(startDateStr.slice(0, 4));
            const rangeEndY = Number(endDateStr.slice(0, 4));

            const [
                domainsExpiryRes,
                domainsPurchasedRes,
                projectsCalRes,
                debtsRes,
                expensesRes,
                incomesRes,
                taxDebtsRes,
                taxRowsRes,
                taxLumpRes,
                bagkurRes,
                fuelRes,
                subsRes
            ] = await Promise.all([
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
                    .lte('target_end_date', endDateStr),
                supabase
                    .from('personal_finance_debts')
                    .select('id, name, amount, paid_amount, due_date, is_paid, creditor')
                    .gte('due_date', startDateStr)
                    .lte('due_date', endDateStr),
                supabase
                    .from('personal_finance_expenses')
                    .select('id, name, amount, paid_amount, due_date, is_paid')
                    .gte('due_date', startDateStr)
                    .lte('due_date', endDateStr),
                supabase
                    .from('personal_finance_incomes')
                    .select('id, name, amount, due_date, is_received')
                    .gte('due_date', startDateStr)
                    .lte('due_date', endDateStr),
                supabase
                    .from('company_finance_tax_installment_debts')
                    .select('id, name, due_day'),
                supabase
                    .from('company_finance_tax_installment_rows')
                    .select('id, debt_id, seq, year, month, amount, is_paid, paid_at')
                    .gte('year', rangeStartY - 1)
                    .lte('year', rangeEndY + 1),
                supabase
                    .from('company_finance_tax_lump_debts')
                    .select('id, name, amount, is_paid, paid_at')
                    .gte('paid_at', startDateStr)
                    .lte('paid_at', endDateStr),
                supabase
                    .from('company_finance_bagkur_months')
                    .select('id, year, month, prim_amount, is_paid, paid_at')
                    .gte('paid_at', startDateStr)
                    .lte('paid_at', endDateStr),
                supabase
                    .from('company_finance_fuel_logs')
                    .select('id, fill_date, amount_tl, note')
                    .gte('fill_date', startDateStr)
                    .lte('fill_date', endDateStr),
                supabase
                    .from('ai_subscriptions')
                    .select('id, provider_name, plan, started_at, renews_at, monthly_cost')
            ]);

            const newEvents: CalendarEvent[] = [];

            if (!domainsExpiryRes.error && domainsExpiryRes.data) {
                for (const d of domainsExpiryRes.data as {
                    id: string;
                    hostname: string;
                    expires_at: string | null;
                    annual_cost: number | null;
                }[]) {
                    const date = dateOnly(d.expires_at);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `dom-exp-${d.id}`,
                        date,
                        title: d.hostname,
                        amount: fmtMoney(d.annual_cost, 'Yenileme'),
                        type: 'domains'
                    });
                }
            }

            if (!domainsPurchasedRes.error && domainsPurchasedRes.data) {
                for (const d of domainsPurchasedRes.data as {
                    id: string;
                    hostname: string;
                    purchased_at: string | null;
                }[]) {
                    const date = dateOnly(d.purchased_at);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `dom-buy-${d.id}`,
                        date,
                        title: d.hostname,
                        amount: 'Satın alma',
                        type: 'domains'
                    });
                }
            }

            if (!projectsCalRes.error && projectsCalRes.data) {
                for (const p of projectsCalRes.data as {
                    id: string;
                    title: string | null;
                    target_end_date: string | null;
                }[]) {
                    const date = dateOnly(p.target_end_date);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `proj-${p.id}`,
                        date,
                        title: p.title || 'Proje',
                        amount: 'Hedef bitiş',
                        type: 'projects'
                    });
                }
            }

            if (!debtsRes.error && debtsRes.data) {
                for (const r of debtsRes.data as {
                    id: string;
                    name: string;
                    amount: number;
                    paid_amount: number;
                    due_date: string | null;
                    is_paid: boolean;
                    creditor: string | null;
                }[]) {
                    const date = dateOnly(r.due_date);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    const remaining = Math.max(0, Number(r.amount) - Number(r.paid_amount || 0));
                    const who = r.creditor ? ` (${r.creditor})` : '';
                    newEvents.push({
                        id: `debt-${r.id}`,
                        date,
                        title: `${r.name}${who}`,
                        amount: r.is_paid ? `Ödendi ${fmtMoney(r.amount)}` : `Vade ${fmtMoney(remaining)}`,
                        type: 'debts'
                    });
                }
            }

            if (!expensesRes.error && expensesRes.data) {
                for (const r of expensesRes.data as {
                    id: string;
                    name: string;
                    amount: number;
                    paid_amount: number;
                    due_date: string | null;
                    is_paid: boolean;
                }[]) {
                    const date = dateOnly(r.due_date);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    const remaining = Math.max(0, Number(r.amount) - Number(r.paid_amount || 0));
                    newEvents.push({
                        id: `exp-${r.id}`,
                        date,
                        title: r.name,
                        amount: r.is_paid
                            ? `Ödendi ${fmtMoney(r.amount)}`
                            : `Son ödeme ${fmtMoney(remaining || r.amount)}`,
                        type: 'expenses'
                    });
                }
            }

            if (!incomesRes.error && incomesRes.data) {
                for (const r of incomesRes.data as {
                    id: string;
                    name: string;
                    amount: number;
                    due_date: string | null;
                    is_received: boolean;
                }[]) {
                    const date = dateOnly(r.due_date);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `inc-${r.id}`,
                        date,
                        title: r.name,
                        amount: r.is_received
                            ? `Alındı ${fmtMoney(r.amount)}`
                            : `Beklenen ${fmtMoney(r.amount)}`,
                        type: 'incomes'
                    });
                }
            }

            const debtNameById = new Map<string, { name: string; due_day: number }>();
            if (!taxDebtsRes.error && taxDebtsRes.data) {
                for (const d of taxDebtsRes.data as {
                    id: string;
                    name: string;
                    due_day: number | null;
                }[]) {
                    debtNameById.set(d.id, {
                        name: d.name || 'Vergi borcu',
                        due_day: Number(d.due_day) || DEFAULT_DUE_DAY
                    });
                }
            }

            if (!taxRowsRes.error && taxRowsRes.data) {
                for (const row of taxRowsRes.data as {
                    id: string;
                    debt_id: string;
                    seq: number;
                    year: number;
                    month: number;
                    amount: number;
                    is_paid: boolean;
                    paid_at: string | null;
                }[]) {
                    const meta = debtNameById.get(row.debt_id);
                    const dueDay = meta?.due_day ?? DEFAULT_DUE_DAY;
                    const due = dueDateISO(row.year, row.month, dueDay);
                    const title = `${meta?.name || 'Vergi'} #${row.seq}`;

                    if (inRange(due, startDateStr, endDateStr)) {
                        newEvents.push({
                            id: `tax-due-${row.id}`,
                            date: due,
                            title,
                            amount: row.is_paid
                                ? `Ödendi ${fmtMoney(row.amount)}`
                                : `Taksit ${fmtMoney(row.amount)}`,
                            type: 'tax'
                        });
                    }

                    const paidAt = dateOnly(row.paid_at);
                    if (inRange(paidAt, startDateStr, endDateStr) && paidAt !== due) {
                        newEvents.push({
                            id: `tax-paid-${row.id}`,
                            date: paidAt,
                            title,
                            amount: `Ödeme ${fmtMoney(row.amount)}`,
                            type: 'tax'
                        });
                    }
                }
            }

            if (!taxLumpRes.error && taxLumpRes.data) {
                for (const r of taxLumpRes.data as {
                    id: string;
                    name: string;
                    amount: number;
                    is_paid: boolean;
                    paid_at: string | null;
                }[]) {
                    const date = dateOnly(r.paid_at);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `tax-lump-${r.id}`,
                        date,
                        title: r.name || 'Vergi (toptan)',
                        amount: `Ödeme ${fmtMoney(r.amount)}`,
                        type: 'tax'
                    });
                }
            }

            if (!bagkurRes.error && bagkurRes.data) {
                for (const r of bagkurRes.data as {
                    id: string;
                    year: number;
                    month: number;
                    prim_amount: number;
                    is_paid: boolean;
                    paid_at: string | null;
                }[]) {
                    const date = dateOnly(r.paid_at);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `bagkur-${r.id}`,
                        date,
                        title: `Bağkur ${r.month}/${r.year}`,
                        amount: `Ödeme ${fmtMoney(r.prim_amount)}`,
                        type: 'bagkur'
                    });
                }
            }

            if (!fuelRes.error && fuelRes.data) {
                for (const r of fuelRes.data as {
                    id: string;
                    fill_date: string | null;
                    amount_tl: number;
                    note: string | null;
                }[]) {
                    const date = dateOnly(r.fill_date);
                    if (!inRange(date, startDateStr, endDateStr)) continue;
                    newEvents.push({
                        id: `fuel-${r.id}`,
                        date,
                        title: r.note?.trim() || 'Benzin dolum',
                        amount: fmtMoney(r.amount_tl, 'Dolum'),
                        type: 'fuel'
                    });
                }
            }

            if (!subsRes.error && subsRes.data) {
                for (const r of subsRes.data as {
                    id: string;
                    provider_name: string | null;
                    plan: string | null;
                    started_at: string | null;
                    renews_at: string | null;
                    monthly_cost: number | null;
                }[]) {
                    const label = [r.provider_name, r.plan].filter(Boolean).join(' · ') || 'Abonelik';
                    const started = dateOnly(r.started_at);
                    if (inRange(started, startDateStr, endDateStr)) {
                        newEvents.push({
                            id: `sub-start-${r.id}`,
                            date: started,
                            title: label,
                            amount: 'Başlangıç',
                            type: 'subscriptions'
                        });
                    }
                    const renews = dateOnly(r.renews_at);
                    if (inRange(renews, startDateStr, endDateStr)) {
                        newEvents.push({
                            id: `sub-renew-${r.id}`,
                            date: renews,
                            title: label,
                            amount: fmtMoney(r.monthly_cost, 'Yenileme'),
                            type: 'subscriptions'
                        });
                    }
                }
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Takvim</h2>
                    <p className="text-muted-foreground">
                        Tarih girilen tüm kalemler: borçlar, son ödemeler, domain, vergi, bağkur…
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

            <div className="flex gap-2 text-sm flex-wrap">
                {LEGEND.map((item) => (
                    <div
                        key={item.type}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold ${EVENT_STYLES[item.type]}`}
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ring-1 ring-white/40 ${item.color}`} />
                        {item.label}
                    </div>
                ))}
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
                                    {dayEvents.length > 3 ? (
                                        <span className="text-[10px] text-muted-foreground">
                                            {dayEvents.length}
                                        </span>
                                    ) : null}
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
