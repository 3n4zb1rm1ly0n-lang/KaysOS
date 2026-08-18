'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type FinanceDonutSlice = {
    name: string;
    value: number;
    color?: string;
};

const COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185'];

function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinanceDonut({
    data,
    centerLabel,
    centerValue,
    height = 176
}: {
    data: FinanceDonutSlice[];
    centerLabel?: string;
    centerValue?: string;
    height?: number;
}) {
    const slices = data.filter((d) => d.value > 0.005);
    const total = slices.reduce((a, d) => a + d.value, 0);

    if (slices.length === 0 || total <= 0) {
        return (
            <p className="py-8 text-center text-xs text-muted-foreground">Bu ay dilim yok.</p>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative w-full" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="58%"
                            outerRadius="82%"
                            paddingAngle={slices.length > 1 ? 2 : 0}
                            stroke="none"
                        >
                            {slices.map((s, i) => (
                                <Cell
                                    key={`${s.name}-${i}`}
                                    fill={s.color ?? COLORS[i % COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) =>
                                fmtMoney(typeof value === 'number' ? value : Number(value) || 0)
                            }
                            contentStyle={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 8,
                                fontSize: 12
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {(centerLabel || centerValue) && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                        {centerLabel && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {centerLabel}
                            </span>
                        )}
                        {centerValue && (
                            <span className="text-sm font-semibold tabular-nums">{centerValue}</span>
                        )}
                    </div>
                )}
            </div>
            <ul className="space-y-1">
                {slices.map((s, i) => (
                    <li
                        key={`${s.name}-leg-${i}`}
                        className="flex items-center justify-between gap-2 text-xs"
                    >
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: s.color ?? COLORS[i % COLORS.length] }}
                            />
                            <span className="truncate text-muted-foreground">{s.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{fmtMoney(s.value)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
