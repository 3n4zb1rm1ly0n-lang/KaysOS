
'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Debt {
    id: string;
    amount: string;
    creditor: string;
    category: string;
    createdDate: string;
    dueDate: string;
    description: string;
    status: 'Ödendi' | 'Bekliyor' | 'Gecikmiş';
}

export default function DebtsPage() {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newDebt, setNewDebt] = useState({
        amount: '',
        creditor: '',
        category: '',
        createdDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        description: ''
    });

    useEffect(() => {
        fetchDebts();
    }, []);

    const fetchDebts = async () => {
        try {
            const { data, error } = await supabase
                .from('debts')
                .select('*')
                .order('due_date', { ascending: true });

            if (error) throw error;

            if (data) {
                const formattedData: Debt[] = data.map(item => ({
                    id: item.id,
                    amount: `₺${item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                    creditor: item.creditor,
                    category: item.category,
                    createdDate: item.created_date,
                    dueDate: item.due_date,
                    description: item.description,
                    status: item.status as 'Ödendi' | 'Bekliyor' | 'Gecikmiş'
                }));
                setDebts(formattedData);
            }
        } catch (error) {
            console.error('Error fetching debts:', error);
        } finally {
            setLoading(false);
        }
    };

    const parseAmount = (str: string) => {
        return parseFloat(str.replace(/[^0-9,-]+/g, "").replace(',', '.')) || 0;
    };

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const totalDebt = debts
        .filter(d => d.status !== 'Ödendi')
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

    const overdueDebt = debts
        .filter(d => d.status === 'Gecikmiş')
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

    const dueThisMonth = debts
        .filter(d => d.status !== 'Ödendi' && d.dueDate.startsWith(currentMonth))
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

    const fmt = (num: number) => `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleAddDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const numericAmount = parseFloat(newDebt.amount);

            const { data, error } = await supabase
                .from('debts')
                .insert([
                    {
                        amount: numericAmount,
                        creditor: newDebt.creditor,
                        category: newDebt.category,
                        created_date: newDebt.createdDate,
                        due_date: newDebt.dueDate,
                        description: newDebt.description,
                        status: 'Bekliyor'
                    }
                ])
                .select();

            if (error) throw error;

            if (data) {
                const addedDebt: Debt = {
                    id: data[0].id,
                    amount: `₺${numericAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                    creditor: data[0].creditor,
                    category: data[0].category,
                    createdDate: data[0].created_date,
                    dueDate: data[0].due_date,
                    description: data[0].description,
                    status: data[0].status
                };
                setDebts([addedDebt, ...debts]);
                setShowAddModal(false);
                setNewDebt({
                    amount: '',
                    creditor: '',
                    category: '',
                    createdDate: new Date().toISOString().split('T')[0],
                    dueDate: '',
                    description: ''
                });
            }
        } catch (error) {
            console.error('Error adding debt:', error);
            alert('Borç eklenirken bir hata oluştu.');
        }
    };

    const handleMarkAsPaid = async (debt: Debt) => {
        if (!confirm('Bu borcu ödendi olarak işaretlemek ve giderlere eklemek istiyor musunuz?')) return;

        try {
            // 1. Update Debt Status
            const { error: updateError } = await supabase
                .from('debts')
                .update({ status: 'Ödendi' })
                .eq('id', debt.id);

            if (updateError) throw updateError;

            // 2. Create Expense Record
            const numericAmount = parseFloat(debt.amount.replace(/[^0-9,-]+/g, "").replace(',', '.'));

            const { error: insertError } = await supabase
                .from('expenses')
                .insert([{
                    amount: numericAmount,
                    recipient: debt.creditor,
                    category: debt.category,
                    date: new Date().toISOString().split('T')[0],
                    description: `${debt.description} (Borç Ödemesi)`,
                    payment_method: 'Nakit' // Default to Cash or ask user contextually (kept simple for now)
                }]);

            if (insertError) throw insertError;

            // 3. Update Local State
            setDebts(debts.map(d => d.id === debt.id ? { ...d, status: 'Ödendi' } : d));

        } catch (error) {
            console.error('Error marking debt as paid:', error);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const getStatusColor = (status: Debt['status']) => {
        switch (status) {
            case 'Ödendi': return 'bg-green-500/10 text-green-500';
            case 'Bekliyor': return 'bg-yellow-500/10 text-yellow-500';
            case 'Gecikmiş': return 'bg-red-500/10 text-red-500';
            default: return 'bg-gray-500/10 text-gray-500';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Borçlar</h2>
                    <p className="text-muted-foreground mt-1">
                        Ödemeniz gereken borçları ve vadelerini buradan takip edebilirsiniz.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Borç Ekle
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Toplam Borç</h3>
                    <div className="mt-2 text-3xl font-bold text-foreground">{fmt(totalDebt)}</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Geciken Ödemeler</h3>
                    <div className="mt-2 text-3xl font-bold text-red-500">{fmt(overdueDebt)}</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Bu Ay Ödenecekler</h3>
                    <div className="mt-2 text-3xl font-bold text-yellow-500">{fmt(dueThisMonth)}</div>
                </div>
            </div>

            {/* Table Section */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Borçlarda ara..."
                            className="pl-9 pr-4 py-2 w-full bg-secondary/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/50 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Alacaklı</th>
                                <th className="px-6 py-4">Kategori</th>
                                <th className="px-6 py-4">Açıklama</th>
                                <th className="px-6 py-4">Son Ödeme</th>
                                <th className="px-6 py-4">Tutar</th>
                                <th className="px-6 py-4">Durum</th>
                                <th className="px-6 py-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {debts.map((debt) => (
                                <tr key={debt.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-foreground">{debt.creditor}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{debt.category}</td>
                                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{debt.description}</td>
                                    <td className="px-6 py-4 font-medium text-foreground">{debt.dueDate}</td>
                                    <td className="px-6 py-4 font-bold text-red-500">{debt.amount}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(debt.status)}`}>
                                            {debt.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {debt.status !== 'Ödendi' && (
                                            <button
                                                onClick={() => handleMarkAsPaid(debt)}
                                                className="text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20 px-3 py-1.5 rounded-md font-medium transition-colors"
                                            >
                                                Ödendi İşaretle
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Debt Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Yeni Borç Ekle</h3>
                        </div>

                        <form onSubmit={handleAddDebt} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Tutar (TL)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newDebt.amount}
                                        onChange={(e) => setNewDebt({ ...newDebt, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Alacaklı</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Örn: Tedarikçi A.Ş."
                                        value={newDebt.creditor}
                                        onChange={(e) => setNewDebt({ ...newDebt, creditor: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Borç Tarihi</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none block"
                                        value={newDebt.createdDate}
                                        onChange={(e) => setNewDebt({ ...newDebt, createdDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Son Ödeme Tarihi</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none block"
                                        value={newDebt.dueDate}
                                        onChange={(e) => setNewDebt({ ...newDebt, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Kategori</label>
                                <select
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={newDebt.category}
                                    onChange={(e) => setNewDebt({ ...newDebt, category: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    <option value="Tedarik">Tedarik</option>
                                    <option value="Vergi">Vergi</option>
                                    <option value="Fatura">Fatura</option>
                                    <option value="Kira">Kira</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Açıklama</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none h-24 resize-none"
                                    placeholder="Borç hakkında detaylı açıklama..."
                                    value={newDebt.description}
                                    onChange={(e) => setNewDebt({ ...newDebt, description: e.target.value })}
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
