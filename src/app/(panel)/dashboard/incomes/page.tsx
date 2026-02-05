
'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Income {
    id: string;
    amount: string;
    source: string;
    category: string;
    date: string;
    description: string;
    status: 'Gelir' | 'Bekleyen';
    isRecurring?: boolean;
    taxRate?: number;
    taxAmount?: number;
    invoiceDate?: string;
}

export default function IncomesPage() {
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [newIncome, setNewIncome] = useState({
        amount: '',
        source: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        invoiceDate: '', // New Field
        description: '',
        isRecurring: false,
        addTax: false,
        taxRate: 20
    });

    // Verileri çek
    useEffect(() => {
        fetchIncomes();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('*').eq('type', 'income');
        if (data && data.length > 0) {
            setCategories(data);
        } else {
            // Fallback default categories if DB is empty to avoid broken UI
            setCategories([
                { id: '1', name: 'Satış' },
                { id: '2', name: 'Hizmet' },
                { id: '3', name: 'Yatırım' },
                { id: '4', name: 'Diğer' }
            ]);
        }
    };

    const fetchIncomes = async () => {
        try {
            const { data, error } = await supabase
                .from('incomes')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedData: Income[] = data.map(item => ({
                    id: item.id,
                    amount: `₺${item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                    source: item.source,
                    category: item.category,
                    date: item.date,
                    description: item.description,
                    status: item.status as 'Gelir' | 'Bekleyen',
                    isRecurring: item.is_recurring,
                    taxRate: item.tax_rate,
                    taxAmount: item.tax_amount,
                    invoiceDate: item.invoice_date // Load from DB
                }));
                setIncomes(formattedData);
            }
        } catch (error) {
            console.error('Error fetching incomes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddIncome = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const numericAmount = parseFloat(newIncome.amount);
            let taxRate = 0;
            let taxAmount = 0;

            if (newIncome.addTax) {
                taxRate = Number(newIncome.taxRate);
                // Brüt'ten vergi hesaplama (KDV Dahil)
                taxAmount = (numericAmount * taxRate) / (100 + taxRate);
            }

            const invoiceDateToSave = newIncome.addTax && newIncome.invoiceDate ? newIncome.invoiceDate : newIncome.date;

            if (editingId) {
                // Update
                const { data, error } = await supabase
                    .from('incomes')
                    .update({
                        amount: numericAmount,
                        source: newIncome.source,
                        category: newIncome.category,
                        date: newIncome.date,
                        invoice_date: invoiceDateToSave,
                        description: newIncome.description,
                        is_recurring: newIncome.isRecurring,
                        tax_rate: taxRate,
                        tax_amount: taxAmount
                    })
                    .eq('id', editingId)
                    .select();

                if (error) throw error;
                // We'll refetch to update UI
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('incomes')
                    .insert([
                        {
                            amount: numericAmount,
                            source: newIncome.source,
                            category: newIncome.category,
                            date: newIncome.date,
                            invoice_date: invoiceDateToSave,
                            description: newIncome.description,
                            status: 'Gelir',
                            is_recurring: newIncome.isRecurring,
                            tax_rate: taxRate,
                            tax_amount: taxAmount
                        }
                    ])
                    .select();

                if (error) throw error;
            }

            fetchIncomes();
            setShowAddModal(false);
            setEditingId(null);
            setNewIncome({
                amount: '', source: '', category: '', date: new Date().toISOString().split('T')[0], invoiceDate: '',
                description: '', isRecurring: false, addTax: false, taxRate: 20
            });
        } catch (error) {
            console.error('Error saving income:', error);
            alert('İşlem sırasında bir hata oluştu');
        }
    };

    const parseAmount = (str: string) => {
        return parseFloat(str.replace(/[^0-9,-]+/g, "").replace(',', '.')) || 0;
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu geliri silmek istediğinize emin misiniz?')) return;

        try {
            const { error } = await supabase
                .from('incomes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setIncomes(incomes.filter(i => i.id !== id));
        } catch (error) {
            console.error('Error deleting income:', error);
            alert('Silme işlemi sırasında bir hata oluştu.');
        }
    };

    const handleEdit = (income: Income) => {
        setEditingId(income.id);
        setNewIncome({
            amount: parseAmount(income.amount).toString(),
            source: income.source,
            category: income.category,
            date: income.date,
            description: income.description,
            isRecurring: income.isRecurring || false,
            addTax: (income.taxRate || 0) > 0,
            taxRate: income.taxRate || 20,
            invoiceDate: income.invoiceDate || income.date // Load existing or fallback
        });
        setShowAddModal(true);
    };

    const totalIncome = incomes
        .filter(i => i.status === 'Gelir')
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

    const pendingIncome = incomes
        .filter(i => i.status === 'Bekleyen')
        .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

    const avgDailyIncome = incomes.length > 0 ? totalIncome / incomes.length : 0;

    // Format helper
    const fmt = (num: number) => `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
                    onClick={() => {
                        setEditingId(null);
                        setNewIncome({ amount: '', source: '', category: '', date: new Date().toISOString().split('T')[0], invoiceDate: '', description: '', isRecurring: false, addTax: false, taxRate: 20 });
                        setShowAddModal(true);
                    }}
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
                    <div className="mt-2 text-3xl font-bold text-green-500">{fmt(totalIncome)}</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Bekleyen Ödemeler</h3>
                    <div className="mt-2 text-3xl font-bold text-yellow-500">{fmt(pendingIncome)}</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Ortalama İşlem Başı</h3>
                    <div className="mt-2 text-3xl font-bold text-blue-500">{fmt(avgDailyIncome)}</div>
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
                                <th className="px-6 py-4 text-right">İşlemler</th>
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
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(income)}
                                                className="p-2 hover:bg-secondary rounded-lg transition-colors text-blue-500 hover:text-blue-400"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(income.id)}
                                                className="p-2 hover:bg-secondary rounded-lg transition-colors text-red-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Income Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                            <h3 className="text-xl font-bold mb-4">{editingId ? 'Gelir Düzenle' : 'Yeni Gelir Ekle'}</h3>
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
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-lg border border-border/50">
                                    <input
                                        type="checkbox"
                                        id="addTax"
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={newIncome.addTax}
                                        onChange={(e) => setNewIncome({ ...newIncome, addTax: e.target.checked })}
                                    />
                                    <label htmlFor="addTax" className="text-sm font-medium leading-none cursor-pointer select-none flex-1">
                                        KDV Dahil (Fatura/Fiş Kesildi)
                                    </label>
                                </div>

                                {newIncome.addTax && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 p-3 bg-secondary/20 rounded-lg">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">KDV Oranı</label>
                                                <select
                                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                                    value={newIncome.taxRate}
                                                    onChange={(e) => setNewIncome({ ...newIncome, taxRate: Number(e.target.value) })}
                                                >
                                                    <option value={1}>%1</option>
                                                    <option value={10}>%10</option>
                                                    <option value={20}>%20</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Fatura Tarihi</label>
                                                <input
                                                    type="date"
                                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none block"
                                                    value={newIncome.invoiceDate || newIncome.date} // Default to date if empty
                                                    onChange={(e) => setNewIncome({ ...newIncome, invoiceDate: e.target.value })}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Boş bırakılırsa tahsilat tarihi kullanılır.</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground text-right pt-2 border-t border-border/10">
                                            Tahmini Vergi: ₺{((parseFloat(newIncome.amount || '0') * newIncome.taxRate) / (100 + newIncome.taxRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                )}

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
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setEditingId(null);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                                    >
                                        {editingId ? 'Güncelle' : 'Kaydet'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
