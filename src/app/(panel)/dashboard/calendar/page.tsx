
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
    parseISO,
    setDate
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateEstimatedIncomeTax } from '@/lib/tax-utils';

interface CalendarEvent {
    id: string;
    date: string;
    title: string;
    amount: string;
    type: 'incomes' | 'expenses' | 'debts' | 'invoices' | 'tax';
}

const EventBadge = ({ type, title, amount }: { type: string, title: string, amount: string }) => {
    const getStyle = () => {
        switch (type) {
            case 'incomes': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'invoices': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'debts': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'expenses': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'tax': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            default: return 'bg-gray-500/10 text-gray-500';
        }
    };

    return (
        <div className={`text-[10px] px-1.5 py-0.5 rounded border mb-1 truncate ${getStyle()}`} title={`${title} - ${amount}`}>
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
    }, [currentDate]);

    const fetchAllEvents = async () => {
        setLoading(true);
        try {
            // Tarih aralığını geniş tutarak (önceki ve sonraki ay dahil) verileri çekelim
            const startDateStr = format(startOfWeek(firstDayOfMonth), 'yyyy-MM-dd');
            const endDateStr = format(endOfWeek(lastDayOfMonth), 'yyyy-MM-dd');

            const [incomesRes, expensesRes, debtsRes, invoicesRes] = await Promise.all([
                supabase.from('incomes').select('*').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('expenses').select('*').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('debts').select('*'), // Borçların hepsini alıp filtereleyeceğiz (vade tarihine göre)
                supabase.from('recurring_expenses').select('*') // Faturaları da gününe göre yerleştireceğiz
            ]);

            const newEvents: CalendarEvent[] = [];

            // 1. Gelirler
            incomesRes.data?.forEach((item: any) => {
                newEvents.push({
                    id: `inc-${item.id}`,
                    date: item.date,
                    title: item.source,
                    amount: `₺${item.amount}`,
                    type: 'incomes'
                });
            });

            // 2. Giderler
            expensesRes.data?.forEach((item: any) => {
                newEvents.push({
                    id: `exp-${item.id}`,
                    date: item.date,
                    title: item.recipient,
                    amount: `₺${item.amount}`,
                    type: 'expenses'
                });
            });

            // 3. Borçlar (Vade Tarihine Göre)
            debtsRes.data?.forEach((item: any) => {
                if (item.due_date) {
                    newEvents.push({
                        id: `debt-${item.id}`,
                        date: item.due_date,
                        title: `Borç Ödemesi: ${item.creditor}`,
                        amount: `₺${item.amount}`,
                        type: 'debts'
                    });
                }
            });

            // 4. Sabit Ödemeler (Faturalar) - Seçili takvim ayına göre oluştur
            invoicesRes.data?.forEach((item: any) => {
                // Her ayın X günü.
                try {
                    let paymentDate = setDate(currentDate, item.day_of_month);
                    if (item.day_of_month > 28) {
                        // date-fns handles overflow, but for simplicity we keep it standard
                    }

                    newEvents.push({
                        id: `inv-${item.id}-${format(currentDate, 'MM')}`,
                        date: format(paymentDate, 'yyyy-MM-dd'),
                        title: `${item.name} (${item.provider})`,
                        amount: `₺${item.amount}`,
                        type: 'invoices'
                    });
                } catch (e) {
                    console.error("Date calculation error", e);
                }
            });

            // 5. KDV Ödemesi (BİR ÖNCEKİ AYIN VERİSİNE GÖRE)
            // KDV Deadline is usually 28th of current month for previous month's activity.
            const kdvDeadline = setDate(currentDate, 28);

            // Fetch previous month's data for KDV calc
            const prevMonthStart = format(startOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd');
            const prevMonthEnd = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd');

            const [prevIncRes, prevExpRes] = await Promise.all([
                supabase.from('incomes').select('tax_amount').gte('date', prevMonthStart).lte('date', prevMonthEnd),
                supabase.from('expenses').select('tax_amount').gte('date', prevMonthStart).lte('date', prevMonthEnd)
            ]);

            const totalIncTax = prevIncRes.data?.reduce((acc, curr) => acc + (curr.tax_amount || 0), 0) || 0;
            const totalExpTax = prevExpRes.data?.reduce((acc, curr) => acc + (curr.tax_amount || 0), 0) || 0;
            const kdvPayable = totalIncTax - totalExpTax;

            if (kdvPayable > 0) {
                newEvents.push({
                    id: `kdv-${format(currentDate, 'yyyy-MM')}`,
                    date: format(kdvDeadline, 'yyyy-MM-dd'),
                    title: 'KDV Ödemesi',
                    amount: `₺${kdvPayable.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
                    type: 'tax'
                });
            }

            // 6. Geçici Vergi (17 Mayıs, 17 Ağustos, 17 Kasım, 17 Şubat)
            const month = currentDate.getMonth(); // 0-11
            const isProvisionalMonth = [1, 4, 7, 10].includes(month); // Feb, May, Aug, Nov

            if (isProvisionalMonth) {
                // ... (Previous logic for provisional tax remains) ...
                // Calculate simple estimate for the relevant quarter
                // If May (4), Q1 (Jan-Mar)
                // If Aug (7), Q2 (Apr-Jun)
                // If Nov (10), Q3 (Jul-Sep)
                // If Feb (1), Q4 (Oct-Dec)

                let qStartStr = '';
                let qEndStr = '';

                if (month === 4) { // May -> Jan-Mar
                    qStartStr = format(new Date(currentDate.getFullYear(), 0, 1), 'yyyy-MM-dd');
                    qEndStr = format(new Date(currentDate.getFullYear(), 2, 31), 'yyyy-MM-dd');
                } else if (month === 7) { // Aug -> Apr-Jun
                    qStartStr = format(new Date(currentDate.getFullYear(), 3, 1), 'yyyy-MM-dd');
                    qEndStr = format(new Date(currentDate.getFullYear(), 5, 30), 'yyyy-MM-dd');
                } else if (month === 10) { // Nov -> Jul-Sep
                    qStartStr = format(new Date(currentDate.getFullYear(), 6, 1), 'yyyy-MM-dd');
                    qEndStr = format(new Date(currentDate.getFullYear(), 8, 30), 'yyyy-MM-dd');
                } else if (month === 1) { // Feb -> Oct-Dec prev year
                    qStartStr = format(new Date(currentDate.getFullYear() - 1, 9, 1), 'yyyy-MM-dd');
                    qEndStr = format(new Date(currentDate.getFullYear() - 1, 11, 31), 'yyyy-MM-dd');
                }

                if (qStartStr) {
                    const [qInc, qExp] = await Promise.all([
                        supabase.from('incomes').select('amount, tax_amount').gte('date', qStartStr).lte('date', qEndStr),
                        supabase.from('expenses').select('amount, tax_amount').gte('date', qStartStr).lte('date', qEndStr)
                    ]);

                    // Net Profit for Estimate
                    const qIncomeTotal = qInc.data?.reduce((acc, curr) => acc + (curr.amount - (curr.tax_amount || 0)), 0) || 0;
                    const qExpenseTotal = qExp.data?.reduce((acc, curr) => acc + (curr.amount - (curr.tax_amount || 0)), 0) || 0;
                    const qProfit = qIncomeTotal - qExpenseTotal;

                    if (qProfit > 0) {
                        const taxEst = calculateEstimatedIncomeTax(qIncomeTotal, qExpenseTotal);

                        newEvents.push({
                            id: `prov-${format(currentDate, 'yyyy-MM')}`,
                            date: format(setDate(currentDate, 17), 'yyyy-MM-dd'),
                            title: 'Geçici Vergi (Tahmini)',
                            amount: `~₺${taxEst.tax.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
                            type: 'tax'
                        });
                    }
                }
            }

            // 7. Yıllık Gelir Vergisi (Mart ve Temmuz)
            // Mart: İlk Taksit
            // Temmuz: İkinci Taksit
            if (month === 2 || month === 6) { // 2=March, 6=July
                // Yıllık gelir vergisi genellikle bir önceki tam yılın kârı üzerinden hesaplanır.
                const prevYear = currentDate.getFullYear() - (month === 2 ? 1 : 0); // Warning: For July, it's same year payment for prev year tax usually? actually both installments are for prev year.
                // Correct logic: Both March 2026 and July 2026 payments are for 2025 earnings.
                const taxYear = currentDate.getFullYear() - 1;

                const startOfYearDate = format(new Date(taxYear, 0, 1), 'yyyy-MM-dd');
                const endOfYearDate = format(new Date(taxYear, 11, 31), 'yyyy-MM-dd');

                const [yInc, yExp] = await Promise.all([
                    supabase.from('incomes').select('amount, tax_amount').gte('date', startOfYearDate).lte('date', endOfYearDate),
                    supabase.from('expenses').select('amount, tax_amount').gte('date', startOfYearDate).lte('date', endOfYearDate)
                ]);

                const yIncomeTotal = yInc.data?.reduce((acc, curr) => acc + (curr.amount - (curr.tax_amount || 0)), 0) || 0;
                const yExpenseTotal = yExp.data?.reduce((acc, curr) => acc + (curr.amount - (curr.tax_amount || 0)), 0) || 0;
                // Ayrıca "Manual Deductions" (Vergi Takibi tablosu) da düşülmeli:
                // const [yDeduct] = await supabase.from('tax_entries').select('amount').gte('date', startOfYearDate).lte('date', endOfYearDate);
                // For now, keep simple.

                const annualProfit = yIncomeTotal - yExpenseTotal;
                if (annualProfit > 0) {
                    const annualTax = calculateEstimatedIncomeTax(yIncomeTotal, yExpenseTotal); // Total tax for the year
                    const installmentAmount = annualTax.tax / 2;

                    newEvents.push({
                        id: `annual-tax-${month}-${format(currentDate, 'yyyy')}`,
                        date: format(setDate(currentDate, 31), 'yyyy-MM-dd'), // Approximate end of month
                        title: `Yıllık Gelir Vergisi (${month === 2 ? '1. Taksit' : '2. Taksit'})`,
                        amount: `~₺${installmentAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
                        type: 'tax'
                    });
                }
            }

            setEvents(newEvents);
        } catch (error) {
            console.error("Error fetching calendar events", error);
        } finally {
            setLoading(false);
        }
    };

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
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Vergiler</div>
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
                        const dayEvents = events.filter(event => isSameDay(parseISO(event.date), day));
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
        </div >
    );
}
