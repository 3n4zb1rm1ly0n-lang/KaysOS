
import { ArrowDown, ArrowUp } from 'lucide-react';

interface KpiCardProps {
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down';
}

export function KpiCard({ title, value, change, trend }: KpiCardProps) {
    return (
        <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{value}</span>
                <span className={`flex items-center text-sm font-medium ${trend === 'up' ? 'text-green-500' : 'text-red-500'
                    }`}>
                    {trend === 'up' ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                    {change}
                </span>
            </div>
        </div>
    );
}
