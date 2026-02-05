
'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Calculator, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TaxEntry {
    id: string;
    description: string;
    amount: number;
    tax_rate: number;
    tax_amount: number;
    date: string;
    category: string;
}

export default function TaxesPage() {
    const [entries, setEntries] = useState<TaxEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEntry, setNewEntry] = useState({
        description: '',
        amount: '',
        taxRate: 20,
        date: new Date().toISOString().split('T')[0],
        category: 'Diğer'
    });

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = async () => {
        try {
            const { data, error } = await supabase
                .from('tax_entries')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error('Error fetching tax entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const numericAmount = parseFloat(newEntry.amount);
            const rate = Number(newEntry.taxRate);
            // Calculate tax part from the gross amount
            // Formula: Tax Amount = (Amount * Rate) / (100 + Rate)
            const taxAmount = (numericAmount * rate) / (100 + rate);

            const { error } = await supabase.from('tax_entries').insert([{
                description: newEntry.description,
                amount: numericAmount,
                tax_rate: rate,
                tax_amount: taxAmount,
                date: newEntry.date,
                category: newEntry.category
            }]);

            if (error) throw error;

            fetchEntries();
            setShowAddModal(false);
            setNewEntry({
                description: '',
                amount: '',
                taxRate: 20,
                date: new Date().toISOString().split('T')[0],
                category: 'Diğer'
            });
        } catch (error) {
            console.error('Error adding tax entry:', error);
            alert('Hata oluştu.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('tax_entries').delete().eq('id', id);
            if (error) throw error;
            setEntries(entries.filter(e => e.id !== id));
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Silme sırasında hata oluştu.');
        }
    };

    const totalPotentialDeduction = entries.reduce((acc, curr) => acc + curr.tax_amount, 0);
    const totalReceiptAmount = entries.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Manuel Vergi/KDV Takibi</h2>
                    <p className="text-muted-foreground mt-1">
                        Kasadan çıkmayan ama vergi indiriminde kullanabileceğiniz fişlerinizi buradan takip edin.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Manuel Fiş Ekle
                </button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Toplam Potansiyel Vergi İndirimi</h3>
                    <div className="mt-2 text-3xl font-bold text-green-500">
                        ₺{totalPotentialDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Bu ay ödeyeceğiniz vergiden düşülebilecek tutar.</p>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">İşlenen Toplam Fiş Tutarı</h3>
                    <div className="mt-2 text-3xl font-bold text-foreground">
                        ₺{totalReceiptAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/50 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Açıklama</th>
                                <th className="px-6 py-4">Kategori</th>
                                <th className="px-6 py-4">Fiş Tutarı</th>
                                <th className="px-6 py-4">KDV Oranı</th>
                                <th className="px-6 py-4">KDV Tutarı</th>
                                <th className="px-6 py-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-6 py-4 text-muted-foreground">{entry.date}</td>
                                    <td className="px-6 py-4 font-medium">{entry.description}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{entry.category}</td>
                                    <td className="px-6 py-4">₺{entry.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-blue-500">%{entry.tax_rate}</td>
                                    <td className="px-6 py-4 font-bold text-green-500">
                                        ₺{entry.tax_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(entry.id)}
                                            className="p-2 hover:bg-secondary rounded-lg transition-colors text-red-500 hover:text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        Henüz manuel işlenmiş fiş yok.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">Manuel Fiş Ekle</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Açıklama</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Örn: Yemek Fişi"
                                    value={newEntry.description}
                                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Fiş Tutarı (KDV Dahil)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newEntry.amount}
                                        onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">KDV Oranı</label>
                                    <select
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newEntry.taxRate}
                                        onChange={(e) => setNewEntry({ ...newEntry, taxRate: Number(e.target.value) })}
                                    >
                                        <option value={1}>%1</option>
                                        <option value={10}>%10</option>
                                        <option value={20}>%20</option>
                                    </select>
                                </div>
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
                                    Ekle
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
