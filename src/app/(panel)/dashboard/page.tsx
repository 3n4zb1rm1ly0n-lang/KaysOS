
'use client';

import { useState, useEffect } from 'react';
import { ControlCenter } from "@/components/panel/control-center";
import { KpiCard } from "@/components/panel/kpi-card";
import { RevenueExpenseLine } from "@/components/panel/charts/revenue-expense-line";
import { supabase } from '@/lib/supabase';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, format,
    addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
    isSameDay, isSameMonth
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DashboardPage() {
    const [incomes, setIncomes] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [weeklyDate, setWeeklyDate] = useState(new Date());
    const [monthlyDate, setMonthlyDate] = useState(new Date());
    const [yearlyDate, setYearlyDate] = useState(new Date());

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [incomesRes, expensesRes] = await Promise.all([
                supabase.from('incomes').select('*'),
                supabase.from('expenses').select('*')
            ]);

            setIncomes(incomesRes.data || []);
            setExpenses(expensesRes.data || []);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Aggregation Logic ---

    const getWeeklyData = () => {
        const start = startOfWeek(weeklyDate, { weekStartsOn: 1 });
        const end = endOfWeek(weeklyDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dayIncomes = incomes.filter(i => isSameDay(new Date(i.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                name: format(day, 'EEEE', { locale: tr }),
                revenue: dayIncomes,
                expense: dayExpenses
            };
        });
    };

    const getMonthlyData = () => {
        const start = startOfMonth(monthlyDate);
        const end = endOfMonth(monthlyDate);
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dayIncomes = incomes.filter(i => isSameDay(new Date(i.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date), day)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                name: format(day, 'd'),
                revenue: dayIncomes,
                expense: dayExpenses
            };
        });
    };

    const getYearlyData = () => {
        const start = startOfYear(yearlyDate);
        const end = endOfYear(yearlyDate);
        const months = eachMonthOfInterval({ start, end });

        return months.map(month => {
            const monthIncomes = incomes.filter(i => isSameMonth(new Date(i.date), month)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            const monthExpenses = expenses.filter(e => isSameMonth(new Date(e.date), month)).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return {
                name: format(month, 'MMM', { locale: tr }),
                revenue: monthIncomes,
                expense: monthExpenses
            };
        });
    };

    // --- Mock KPIs for now, or Calculate them if wanted ---
    const totalIncome = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalExpense = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // Simple dynamic KPI
    const kpiCards = [
        { title: 'Toplam Gelir', value: `₺${totalIncome.toLocaleString()}`, change: '0%', trend: 'neutral' },
        { title: 'Toplam Gider', value: `₺${totalExpense.toLocaleString()}`, change: '0%', trend: 'neutral' },
        { title: 'Net Durum', value: `₺${(totalIncome - totalExpense).toLocaleString()}`, change: '0%', trend: 'neutral' },
        { title: 'Ortalama İşlem', value: '₺0', change: '0%', trend: 'neutral' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Genel Bakış</h2>
                    <p className="text-muted-foreground mt-1">
                        İşletmenizin anlık durumunu buradan takip edebilirsiniz.
                    </p>
                </div>
                <ControlCenter />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {kpiCards.map((card, index) => (
                    <KpiCard
                        key={index}
                        title={card.title}
                        value={card.value}
                        change={card.change}
                        trend={card.trend as any}
                    />
                ))}
            </div>

            <div className="space-y-8">
                {/* Haftalık Grafik */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex items-center justify-between border-b">
                        <h3 className="font-semibold">Haftalık Analiz</h3>
                        <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-1">
                            <button onClick={() => setWeeklyDate(subWeeks(weeklyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="min-w-[140px] text-center font-medium">
                                {format(startOfWeek(weeklyDate, { weekStartsOn: 1 }), 'd MMM', { locale: tr })} - {format(endOfWeek(weeklyDate, { weekStartsOn: 1 }), 'd MMM', { locale: tr })}
                            </span>
                            <button onClick={() => setWeeklyDate(addWeeks(weeklyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <RevenueExpenseLine data={getWeeklyData()} isLoading={loading} />
                    </div>
                </div>

                {/* Aylık Grafik */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex items-center justify-between border-b">
                        <h3 className="font-semibold">Aylık Analiz (Günlük)</h3>
                        <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-1">
                            <button onClick={() => setMonthlyDate(subMonths(monthlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="min-w-[140px] text-center font-medium">
                                {format(monthlyDate, 'MMMM yyyy', { locale: tr })}
                            </span>
                            <button onClick={() => setMonthlyDate(addMonths(monthlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <RevenueExpenseLine data={getMonthlyData()} isLoading={loading} />
                    </div>
                </div>

                {/* Yıllık Grafik */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex items-center justify-between border-b">
                        <h3 className="font-semibold">Yıllık Analiz (Aylık)</h3>
                        <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-1">
                            <button onClick={() => setYearlyDate(subYears(yearlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="min-w-[140px] text-center font-medium">
                                {format(yearlyDate, 'yyyy', { locale: tr })}
                            </span>
                            <button onClick={() => setYearlyDate(addYears(yearlyDate, 1))} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="p-6">
                        <RevenueExpenseLine data={getYearlyData()} isLoading={loading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
