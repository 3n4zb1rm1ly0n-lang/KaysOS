
import { ControlCenter } from "@/components/panel/control-center";
import { KpiCard } from "@/components/panel/kpi-card";
import { RevenueExpenseLine } from "@/components/panel/charts/revenue-expense-line";
import { kpiCards } from "@/lib/mock/dashboard";

export default function DashboardPage() {
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
                        trend={card.trend as 'up' | 'down'}
                    />
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Gelir ve Gider Analizi</h3>
                    </div>
                    <div className="p-6 pt-0 pl-2">
                        <RevenueExpenseLine />
                    </div>
                </div>

                {/* Placeholder for future implementations like Recent Sales */}
                <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-medium mb-4">Son İşlemler</h3>
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm">
                        Henüz işlem bulunmuyor
                    </div>
                </div>
            </div>
        </div>
    );
}
