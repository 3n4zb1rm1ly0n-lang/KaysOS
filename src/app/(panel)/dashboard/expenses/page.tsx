
'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, FileText, ShoppingBag, Truck, Receipt, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Expense {
    id: string;
    amount: string;
    recipient: string;
    category: string;
    date: string;
    description: string;
    paymentMethod: 'Nakit' | 'Kredi Kartı' | 'Havale';
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newExpense, setNewExpense] = useState({
        amount: '',
        recipient: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        paymentMethod: 'Nakit' as 'Nakit' | 'Kredi Kartı' | 'Havale'
    });

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedData: Expense[] = data.map(item => ({
                    id: item.id,
                    amount: `₺${item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                    recipient: item.recipient,
                    category: item.category,
                    date: item.date,
                    description: item.description,
                    paymentMethod: item.payment_method
                }));
                setExpenses(formattedData);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const parseAmount = (str: string) => {
        return parseFloat(str.replace(/[^0-9,-]+/g, "").replace(',', '.')) || 0;
    };

    const totalExpense = expenses.reduce((acc, curr) => acc + parseAmount(curr.amount), 0);
    const transportExpense = expenses
        .filter(e => e.category === 'Ulaşım')
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);
    const officeExpense = expenses
        .filter(e => e.category === 'Ofis')
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

    const fmt = (num: number) => `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const numericAmount = parseFloat(newExpense.amount);

            const { data, error } = await supabase
                .from('expenses')
                .insert([
                    {
                        amount: numericAmount,
                        recipient: newExpense.recipient,
                        category: newExpense.category,
                        date: newExpense.date,
                        description: newExpense.description,
                        payment_method: newExpense.paymentMethod
                    }
                ])
                .select();

            if (error) throw error;

            if (data) {
                const addedExpense: Expense = {
                    id: data[0].id,
                    amount: `₺${numericAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                    recipient: data[0].recipient,
                    category: data[0].category,
                    date: data[0].date,
                    description: data[0].description,
                    paymentMethod: data[0].payment_method
                };
                setExpenses([addedExpense, ...expenses]);
                setShowAddModal(false);
                setNewExpense({
                    amount: '',
                    recipient: '',
                    category: '',
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    paymentMethod: 'Nakit'
                });
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Gider eklenirken bir hata oluştu.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Giderler</h2>
                    <p className="text-muted-foreground mt-1">
                        İşletmenizin günlük harcamalarını buradan takip edebilirsiniz.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Gider Ekle
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">Toplam Gider (Ay)</h3>
                            <div className="mt-1 text-2xl font-bold text-red-500">{fmt(totalExpense)}</div>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Truck className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">Ulaşım Giderleri</h3>
                            <div className="mt-1 text-2xl font-bold text-foreground">{fmt(transportExpense)}</div>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <Receipt className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">Ofis Giderleri</h3>
                            <div className="mt-1 text-2xl font-bold text-foreground">{fmt(officeExpense)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Giderlerde ara..."
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
                                <th className="px-6 py-4">Harcama Yeri</th>
                                <th className="px-6 py-4">Kategori</th>
                                <th className="px-6 py-4">Açıklama</th>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Ödeme Yöntemi</th>
                                <th className="px-6 py-4">Tutar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {expenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-foreground">{expense.recipient}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{expense.category}</td>
                                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{expense.description}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{expense.date}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                            {expense.paymentMethod}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-red-500">-{expense.amount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Expense Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">Yeni Gider Ekle</h3>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Tutar (TL)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newExpense.amount}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Tarih</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none block"
                                        value={newExpense.date}
                                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Harcama Yeri / Kişi</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Örn: Market A.Ş."
                                    value={newExpense.recipient}
                                    onChange={(e) => setNewExpense({ ...newExpense, recipient: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Kategori</label>
                                    <select
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newExpense.category}
                                        onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                    >
                                        <option value="">Seçiniz...</option>
                                        <option value="Malzeme Alımı">Malzeme Alımı</option>
                                        <option value="Ulaşım">Ulaşım</option>
                                        <option value="Ofis">Ofis</option>
                                        <option value="Personel">Personel</option>
                                        <option value="Yemek">Yemek</option>
                                        <option value="Diğer">Diğer</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Ödeme Yöntemi</label>
                                    <select
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newExpense.paymentMethod}
                                        onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value as any })}
                                    >
                                        <option value="Nakit">Nakit</option>
                                        <option value="Kredi Kartı">Kredi Kartı</option>
                                        <option value="Havale">Havale</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Açıklama</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none h-24 resize-none"
                                    placeholder="Harcama detayları..."
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
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
