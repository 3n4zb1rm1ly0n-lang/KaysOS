import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface KpiCardProps {
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down' | 'neutral';
}

export function KpiCard({ title, value, change, trend }: KpiCardProps) {
    const getTrendColor = () => {
        switch (trend) {
            case 'up': return 'text-green-500';
            case 'down': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getTrendIcon = () => {
        switch (trend) {
            case 'up': return <ArrowUp className="w-4 h-4 mr-1" />;
            case 'down': return <ArrowDown className="w-4 h-4 mr-1" />;
            default: return <Minus className="w-4 h-4 mr-1" />;
        }
    };

    return (
        <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{value}</span>
                <span className={`flex items-center text-sm font-medium ${getTrendColor()}`}>
                    {getTrendIcon()}
                    {change}
                </span>
            </div>
        </div>
    );
}
