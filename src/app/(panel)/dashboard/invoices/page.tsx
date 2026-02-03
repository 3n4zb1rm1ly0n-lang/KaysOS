
'use client';

import { useState } from 'react';
import {
    Plus,
    Zap,
    Droplets,
    Wifi,
    Home,
    FileText,
    CheckCircle2,
    AlertCircle,
    Clock,
    MoreVertical
} from 'lucide-react';

interface RecurringExpense {
    id: string;
    name: string;
    provider: string;
    amount: number; // Tahmini veya sabit tutar
    dayOfMonth: number; // Ayın kaçıncı günü
    category: 'Enerji' | 'Su' | 'İletişim' | 'Kira' | 'Vergi' | 'Diğer';
    status: 'Ödendi' | 'Yaklaşıyor' | 'Gecikti' | 'Bekliyor';
    autoPay: boolean;
    lastPaidDate?: string;
}

const MOCK_EXPENSES: RecurringExpense[] = [
    { id: '1', name: 'Dükkan Kirası', provider: 'Mülk Sahibi', amount: 12000, dayOfMonth: 1, category: 'Kira', status: 'Ödendi', autoPay: true, lastPaidDate: '2024-02-01' },
    { id: '2', name: 'Elektrik Faturası', provider: 'Enerjisa', amount: 1500, dayOfMonth: 15, category: 'Enerji', status: 'Yaklaşıyor', autoPay: false },
    { id: '3', name: 'İnternet', provider: 'Türk Telekom', amount: 450, dayOfMonth: 20, category: 'İletişim', status: 'Bekliyor', autoPay: true },
    { id: '4', name: 'Su Faturası', provider: 'İSKİ', amount: 300, dayOfMonth: 12, category: 'Su', status: 'Bekliyor', autoPay: false },
    { id: '5', name: 'KDV Ödemesi', provider: 'Vergi Dairesi', amount: 5000, dayOfMonth: 26, category: 'Vergi', status: 'Bekliyor', autoPay: false },
];

const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
        case 'Enerji': return <Zap className="w-5 h-5 text-yellow-500" />;
        case 'Su': return <Droplets className="w-5 h-5 text-blue-500" />;
        case 'İletişim': return <Wifi className="w-5 h-5 text-purple-500" />;
        case 'Kira': return <Home className="w-5 h-5 text-orange-500" />;
        default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
};

export default function InvoicesPage() {
    const [expenses, setExpenses] = useState<RecurringExpense[]>(MOCK_EXPENSES);
    const [showAddModal, setShowAddModal] = useState(false);

    // Bu ayın toplam tahmini gideri
    const totalEstimated = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    // Bu ay ödenenler
    const totalPaid = expenses.filter(e => e.status === 'Ödendi').reduce((acc, curr) => acc + curr.amount, 0);

    const getStatusColor = (status: RecurringExpense['status']) => {
        switch (status) {
            case 'Ödendi': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'Gecikti': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'Yaklaşıyor': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-secondary text-muted-foreground border-transparent';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Faturalar & Sabit Giderler</h2>
                    <p className="text-muted-foreground mt-1">
                        Her ay tekrarlanan düzenli ödemelerinizi buradan yönetin.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Yeni Sabit Gider
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Aylık Tahmini Toplam</p>
                            <h3 className="text-2xl font-bold mt-2">₺{totalEstimated.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <div className="mt-4 w-full bg-secondary rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Bu Ay Ödenen</p>
                            <h3 className="text-2xl font-bold mt-2 text-green-500">₺{totalPaid.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                    </div>
                    <div className="mt-4 w-full bg-secondary rounded-full h-2">
                        <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${(totalPaid / totalEstimated) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Kalan Ödeme</p>
                            <h3 className="text-2xl font-bold mt-2 text-yellow-500">₺{(totalEstimated - totalPaid).toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground">
                        3 fatura ödeme bekliyor
                    </div>
                </div>
            </div>

            {/* Grid of Custom Subscription Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {expenses.map((expense) => (
                    <div
                        key={expense.id}
                        className="group relative bg-card border border-border rounded-xl p-6 hover:shadow-md transition-all hover:border-primary/50"
                    >
                        <div className="absolute top-4 right-4 cursor-pointer text-muted-foreground hover:text-primary">
                            <MoreVertical className="w-4 h-4" />
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CategoryIcon category={expense.category} />
                            </div>
                            <div>
                                <h4 className="font-semibold">{expense.name}</h4>
                                <p className="text-sm text-muted-foreground">{expense.provider}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Son Ödeme Günü</span>
                                <span className="font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Her ayın {expense.dayOfMonth}'i
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Tutar (Tahmini)</span>
                                <span className="font-bold text-lg">₺{expense.amount.toLocaleString()}</span>
                            </div>

                            <div className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-between ${getStatusColor(expense.status)}`}>
                                <span className="font-medium">{expense.status}</span>
                                {expense.status === 'Ödendi' && <CheckCircle2 className="w-4 h-4" />}
                                {expense.status === 'Yaklaşıyor' && <span className="text-xs opacity-75">3 gün kaldı</span>}
                            </div>

                            {expense.status !== 'Ödendi' ? (
                                <button className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                                    Ödendi Olarak İşaretle
                                </button>
                            ) : (
                                <button className="w-full py-2 bg-secondary text-muted-foreground rounded-lg font-medium cursor-not-allowed opacity-50">
                                    Bu Ay Ödendi
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {/* Add New Card (Empty State) */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary hover:text-primary hover:bg-secondary/10 transition-colors min-h-[250px]"
                >
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-medium">Yeni Düzenli Gider Ekle</span>
                </button>
            </div>

        </div>
    );
}
