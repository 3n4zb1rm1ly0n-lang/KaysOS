
'use client';

import { useState } from 'react';
import { Plus, Search, Calendar as CalendarIcon, FileText } from 'lucide-react';

interface Income {
    id: string;
    amount: string;
    source: string;
    category: string;
    date: string;
    description: string;
    status: 'Gelir' | 'Bekleyen';
    isRecurring?: boolean;
}

const MOCK_INCOMES: Income[] = [
    { id: '1', amount: '₺12,450.00', source: 'Kredi Kartı Satışları', category: 'Satış', date: '2024-02-03', description: 'Günlük toplam POS geliri', status: 'Gelir', isRecurring: true },
    { id: '2', amount: '₺4,200.00', source: 'Nakit Satışlar', category: 'Satış', date: '2024-02-03', description: 'Kasa nakit girişi', status: 'Gelir', isRecurring: true },
    { id: '3', amount: '₺8,500.00', source: 'Yemeksepeti', category: 'Online', date: '2024-02-02', description: 'Haftalık hakediş ödemesi', status: 'Gelir' },
];

export default function IncomesPage() {
    const [incomes, setIncomes] = useState<Income[]>(MOCK_INCOMES);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newIncome, setNewIncome] = useState({
        amount: '',
        source: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        isRecurring: false
    });

    const handleAddIncome = (e: React.FormEvent) => {
        e.preventDefault();
        const income: Income = {
            id: Math.random().toString(36).substr(2, 9),
            amount: `₺${parseFloat(newIncome.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
            source: newIncome.source,
            category: newIncome.category,
            date: newIncome.date,
            description: newIncome.description,
            status: 'Gelir',
            isRecurring: newIncome.isRecurring
        };
        setIncomes([income, ...incomes]);
        setShowAddModal(false);
        setNewIncome({ amount: '', source: '', category: '', date: new Date().toISOString().split('T')[0], description: '', isRecurring: false });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Gelirler</h2>
                    <p className="text-muted-foreground mt-1">
                        Tüm gelir kalemlerinizi buradan takip edebilirsiniz.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Gelir Ekle
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Toplam Gelir (Ay)</h3>
                    <div className="mt-2 text-3xl font-bold text-green-500">₺25,150.00</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Bekleyen Ödemeler</h3>
                    <div className="mt-2 text-3xl font-bold text-yellow-500">₺4,250.00</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Ortalama Günlük Gelir</h3>
                    <div className="mt-2 text-3xl font-bold text-blue-500">₺3,850.00</div>
                </div>
            </div>

            {/* Table Section */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Gelirlerde ara..."
                            className="pl-9 pr-4 py-2 w-full bg-secondary/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground">
                            <CalendarIcon className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground">
                            <FileText className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/50 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Kaynak</th>
                                <th className="px-6 py-4">Kategori</th>
                                <th className="px-6 py-4">Açıklama</th>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Tutar</th>
                                <th className="px-6 py-4">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {incomes.map((income) => (
                                <tr key={income.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-foreground">{income.source}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{income.category}</td>
                                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{income.description}</td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        <div className="flex flex-col">
                                            <span>{income.date}</span>
                                            {income.isRecurring && (
                                                <span className="text-[10px] text-blue-400 font-medium mt-0.5">Her Ay Tekrarla</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-green-500">{income.amount}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                            {income.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Income Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4">Yeni Gelir Ekle</h3>
                        <form onSubmit={handleAddIncome} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Tutar (TL)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newIncome.amount}
                                        onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Tarih</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none block"
                                        value={newIncome.date}
                                        onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Kaynak / Başlık</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Örn: Günlük Nakit Satış"
                                    value={newIncome.source}
                                    onChange={(e) => setNewIncome({ ...newIncome, source: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Kategori</label>
                                <select
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={newIncome.category}
                                    onChange={(e) => setNewIncome({ ...newIncome, category: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    <option value="Satış">Satış</option>
                                    <option value="Hizmet">Hizmet</option>
                                    <option value="Online">Online Platform</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>

                            <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-lg border border-border/50">
                                <input
                                    type="checkbox"
                                    id="isRecurring"
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={newIncome.isRecurring}
                                    onChange={(e) => setNewIncome({ ...newIncome, isRecurring: e.target.checked })}
                                />
                                <label htmlFor="isRecurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none">
                                    Her ayın bu günü tekrarla
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Açıklama</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none h-24 resize-none"
                                    placeholder="İşlem hakkında detaylı açıklama..."
                                    value={newIncome.description}
                                    onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
