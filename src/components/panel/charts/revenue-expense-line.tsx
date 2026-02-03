

'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Loader2 } from 'lucide-react';

interface ChartData {
    name: string;
    revenue: number;
    expense: number;
}

interface RevenueExpenseLineProps {
    data: ChartData[];
    isLoading?: boolean;
}

export function RevenueExpenseLine({ data, isLoading }: RevenueExpenseLineProps) {
    if (isLoading) {
        return (
            <div className="w-full h-[350px] flex items-center justify-center bg-secondary/10 rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-[350px] flex items-center justify-center bg-secondary/10 rounded-lg text-muted-foreground">
                Veri bulunamadı
            </div>
        );
    }

    return (
        <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                        tickFormatter={(value) => `₺${value}`}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: any) => [`₺${Number(value).toLocaleString()}`, undefined]}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Gelir"
                        stroke="#22c55e" // green-500
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="expense"
                        name="Gider"
                        stroke="#ef4444" // red-500
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
