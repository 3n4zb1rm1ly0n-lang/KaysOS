'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type PieSlice = {
    name: string;
    value: number;
    color: string;
};

const FALLBACK = [
    '#0891b2',
    '#1d4ed8',
    '#dc2626',
    '#f59e0b',
    '#16a34a',
    '#c2410c',
    '#0ea5e9',
    '#a3e635',
    '#c026d3'
];

export function FinancePie({
    data,
    emptyLabel = 'Veri yok',
    formatValue
}: {
    data: PieSlice[];
    emptyLabel?: string;
    formatValue?: (value: number) => string;
}) {
    const slices = data.filter((d) => d.value > 0.0001);
    if (slices.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                {emptyLabel}
            </div>
        );
    }

    const format =
        formatValue ??
        ((value: number) =>
            `₺${Number(value).toLocaleString('tr-TR', {
                maximumFractionDigits: 2
            })}`);

    return (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="transparent"
                    >
                        {slices.map((s, i) => (
                            <Cell key={`${s.name}-${i}`} fill={s.color || FALLBACK[i % FALLBACK.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value: number) => format(Number(value))}
                        contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

export const BUDGET_PIE_COLORS: Record<string, string> = {
    savings: '#16a34a',
    expense: '#f59e0b',
    debt: '#dc2626',
    free: '#64748b',
    unallocated: '#334155',
    withheld: '#c2410c',
    net: '#0891b2'
};
