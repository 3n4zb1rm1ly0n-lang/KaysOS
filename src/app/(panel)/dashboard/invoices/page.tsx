
'use client';

// Migration to add tax_rate to recurring_expenses if not exists
// You should run this in SQL editor:
// ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS tax_rate numeric default 0;


import { useState, useEffect } from 'react';
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
    MoreVertical,
    Loader2,
    Pencil,
    Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ... (Imports stay same)

interface RecurringExpense {
    id: string;
    name: string;
    provider: string;
    amount: number;
    dayOfMonth: number;
    category: 'Enerji' | 'Su' | 'İletişim' | 'Kira' | 'Vergi' | 'Diğer';
    status: 'Ödendi' | 'Yaklaşıyor' | 'Gecikti' | 'Bekliyor';
    taxRate: number; // Replaces autoPay
    lastPaidDate?: string;
}

const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
        case 'Enerji': return <Zap className="w-5 h-5 text-yellow-500" />;
        case 'Su': return <Droplets className="w-5 h-5 text-blue-500" />;
        case 'İletişim': return <Wifi className="w-5 h-5 text-purple-500" />;
        case 'Kira': return <Home className="w-5 h-5 text-orange-500" />;
        case 'Vergi': return <FileText className="w-5 h-5 text-red-500" />;
        default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
};

export default function InvoicesPage() {
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newExpense, setNewExpense] = useState({
        name: '',
        provider: '',
        amount: '',
        dayOfMonth: '',
        category: 'Diğer',
        addTax: false,
        taxRate: 20
    });

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            const { data, error } = await supabase
                .from('recurring_expenses')
                .select('*')
                .order('day_of_month', { ascending: true });

            if (error) throw error;

            if (data) {
                const formattedData: RecurringExpense[] = data.map(item => ({
                    id: item.id,
                    name: item.name,
                    provider: item.provider,
                    amount: Number(item.amount),
                    dayOfMonth: item.day_of_month,
                    category: item.category as any,
                    status: item.status as any,
                    taxRate: item.tax_rate || 0,
                    lastPaidDate: item.last_paid_date
                }));
                setExpenses(formattedData);
            }
        } catch (error) {
            console.error('Error fetching recurring expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalEstimated = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = expenses.filter(e => e.status === 'Ödendi').reduce((acc, curr) => acc + curr.amount, 0);

    const getStatusColor = (status: RecurringExpense['status']) => {
        switch (status) {
            case 'Ödendi': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'Gecikti': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'Yaklaşıyor': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-secondary text-muted-foreground border-transparent';
        }
    };

    const handleMarkAsPaid = async (expense: RecurringExpense) => {
        if (!confirm('Bu faturayı bu ay için ödendi olarak işaretlemek ve gidere işlemek istiyor musunuz?')) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const taxAmount = (expense.amount * (expense.taxRate || 0)) / (100 + (expense.taxRate || 0));

            // 1. Update Invoice Status
            const { error: updateError } = await supabase
                .from('recurring_expenses')
                .update({
                    status: 'Ödendi',
                    last_paid_date: today
                })
                .eq('id', expense.id);

            if (updateError) throw updateError;

            // 2. Create Expense Record (With Tax!)
            const { error: insertError } = await supabase
                .from('expenses')
                .insert([{
                    amount: expense.amount,
                    recipient: expense.provider,
                    category: expense.category,
                    date: today,
                    description: `${expense.name} (Fatura Ödemesi)`,
                    payment_method: 'Nakit',
                    tax_rate: expense.taxRate || 0,
                    tax_amount: taxAmount
                }]);

            if (insertError) throw insertError;

            // 3. Update Local State
            setExpenses(expenses.map(e => e.id === expense.id ? { ...e, status: 'Ödendi', lastPaidDate: today } : e));

        } catch (error) {
            console.error('Error marking invoice as paid:', error);
            alert('İşlem sırasında bir hata oluştu.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu sabit gideri silmek istediğinize emin misiniz?')) return;

        try {
            const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
            if (error) throw error;
            setExpenses(expenses.filter(e => e.id !== id));
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Silme sırasında hata oluştu.');
        }
    };

    const handleEdit = (expense: RecurringExpense) => {
        setEditingId(expense.id);
        setNewExpense({
            name: expense.name,
            provider: expense.provider,
            amount: expense.amount.toString(),
            dayOfMonth: expense.dayOfMonth.toString(),
            category: expense.category,
            addTax: (expense.taxRate || 0) > 0,
            taxRate: expense.taxRate || 20
        });
        setShowAddModal(true);
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const numericAmount = parseFloat(newExpense.amount);
            const numericDay = parseInt(newExpense.dayOfMonth);
            const taxRate = newExpense.addTax ? Number(newExpense.taxRate) : 0;

            if (editingId) {
                // Update
                const { data, error } = await supabase
                    .from('recurring_expenses')
                    .update({
                        name: newExpense.name,
                        provider: newExpense.provider,
                        amount: numericAmount,
                        day_of_month: numericDay,
                        category: newExpense.category,
                        tax_rate: taxRate // New
                    })
                    .eq('id', editingId)
                    .select();

                if (error) throw error;

                if (data) {
                    const updated: RecurringExpense = {
                        id: data[0].id,
                        name: data[0].name,
                        provider: data[0].provider,
                        amount: Number(data[0].amount),
                        dayOfMonth: data[0].day_of_month,
                        category: data[0].category as any,
                        status: data[0].status as any,
                        taxRate: data[0].tax_rate || 0,
                        lastPaidDate: data[0].last_paid_date
                    };
                    setExpenses(expenses.map(e => e.id === editingId ? updated : e));
                }
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('recurring_expenses')
                    .insert([
                        {
                            name: newExpense.name,
                            provider: newExpense.provider,
                            amount: numericAmount,
                            day_of_month: numericDay,
                            category: newExpense.category,
                            tax_rate: taxRate,
                            status: 'Bekliyor'
                        }
                    ])
                    .select();

                if (error) throw error;

                if (data) {
                    const added: RecurringExpense = {
                        id: data[0].id,
                        name: data[0].name,
                        provider: data[0].provider,
                        amount: Number(data[0].amount),
                        dayOfMonth: data[0].day_of_month,
                        category: data[0].category as any,
                        status: data[0].status as any,
                        taxRate: data[0].tax_rate || 0,
                        lastPaidDate: data[0].last_paid_date
                    };
                    setExpenses([...expenses, added]);
                }
            }

            setShowAddModal(false);
            setEditingId(null);
            setNewExpense({
                name: '',
                provider: '',
                amount: '',
                dayOfMonth: '',
                category: 'Diğer',
                addTax: false,
                taxRate: 20
            });
        } catch (error) {
            console.error('Error saving recurring expense:', error);
            alert('İşlem sırasında hata oluştu.');
        }
    };

    const updateNewExpense = (field: string, value: any) => {
        setNewExpense(prev => ({ ...prev, [field]: value }));
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
                    onClick={() => {
                        setEditingId(null);
                        setNewExpense({
                            name: '',
                            provider: '',
                            amount: '',
                            dayOfMonth: '',
                            category: 'Diğer',
                            addTax: false,
                            taxRate: 20
                        });
                        setShowAddModal(true);
                    }}
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
                            style={{ width: `${totalEstimated > 0 ? (totalPaid / totalEstimated) * 100 : 0}%` }}
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
                        {expenses.filter(e => e.status !== 'Ödendi').length} fatura ödeme bekliyor
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
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <button
                                onClick={() => handleEdit(expense)}
                                className="text-muted-foreground hover:text-blue-500 transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(expense.id)}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
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
                                <span className="text-muted-foreground">Tutar (KDV Dahil)</span>
                                <div className="text-right">
                                    <span className="font-bold text-lg block">₺{expense.amount.toLocaleString()}</span>
                                    {(expense.taxRate || 0) > 0 && (
                                        <span className="text-[10px] text-green-600 font-medium">
                                            KDV %{expense.taxRate} Dahil
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-between ${getStatusColor(expense.status)}`}>
                                <span className="font-medium">{expense.status}</span>
                                {expense.status === 'Ödendi' && <CheckCircle2 className="w-4 h-4" />}
                                {expense.status === 'Yaklaşıyor' && <span className="text-xs opacity-75">Yaklaşıyor</span>}
                            </div>

                            {expense.status !== 'Ödendi' ? (
                                <button
                                    onClick={() => handleMarkAsPaid(expense)}
                                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
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


            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">{editingId ? 'Sabit Gider Düzenle' : 'Yeni Sabit Gider Ekle'}</h3>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">İsim</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Örn: Kira"
                                        value={newExpense.name}
                                        onChange={(e) => updateNewExpense('name', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Sağlayıcı / Kişi</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Örn: Ahmet Yılmaz"
                                        value={newExpense.provider}
                                        onChange={(e) => updateNewExpense('provider', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Tutar (Tahmini)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newExpense.amount}
                                        onChange={(e) => updateNewExpense('amount', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Ödeme Günü (1-31)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max="31"
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newExpense.dayOfMonth}
                                        onChange={(e) => updateNewExpense('dayOfMonth', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Kategori</label>
                                <select
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={newExpense.category}
                                    onChange={(e) => updateNewExpense('category', e.target.value)}
                                >
                                    <option value="Diğer">Diğer</option>
                                    <option value="Enerji">Enerji (Elektrik/Gaz)</option>
                                    <option value="Su">Su</option>
                                    <option value="İletişim">İletişim (İnternet/Tel)</option>
                                    <option value="Kira">Kira</option>
                                    <option value="Vergi">Vergi</option>
                                </select>
                            </div>

                            {/* Tax Toggle */}
                            <div className="space-y-3 pt-2 border-t border-border/10">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="addTaxInvoice"
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={newExpense.addTax}
                                        onChange={(e) => updateNewExpense('addTax', e.target.checked)}
                                    />
                                    <label htmlFor="addTaxInvoice" className="text-sm font-medium leading-none cursor-pointer select-none">
                                        KDV Dahil / Vergi İndirimi
                                    </label>
                                </div>

                                {/* Tax Rate (Conditional) */}
                                {newExpense.addTax && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 p-3 bg-secondary/20 rounded-lg">
                                        <label className="text-xs font-medium text-muted-foreground">KDV Oranı Seçiniz</label>
                                        <div className="flex items-center gap-4">
                                            {[1, 10, 20].map((rate) => (
                                                <label key={rate} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="taxRateInvoice"
                                                        className="w-4 h-4 text-primary"
                                                        checked={newExpense.taxRate === rate}
                                                        onChange={() => updateNewExpense('taxRate', rate)}
                                                    />
                                                    <span className="text-sm">%{rate}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
            )}
        </div>
    );
}
