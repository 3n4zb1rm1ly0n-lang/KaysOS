
'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const data = [
    { name: 'Pzt', revenue: 0, expense: 0 },
    { name: 'Sal', revenue: 0, expense: 0 },
    { name: 'Çar', revenue: 0, expense: 0 },
    { name: 'Per', revenue: 0, expense: 0 },
    { name: 'Cum', revenue: 0, expense: 0 },
    { name: 'Cmt', revenue: 0, expense: 0 },
    { name: 'Paz', revenue: 0, expense: 0 },
];

export function RevenueExpenseLine() {
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
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="expense"
                        stroke="#EF4444"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
