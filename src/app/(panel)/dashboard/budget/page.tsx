'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Loader2, AlertTriangle, TrendingUp, CheckCircle, Pencil } from 'lucide-react';

interface CategoryBudget {
    id: string;
    name: string;
    type: string;
    monthly_limit: number;
    spent: number;
}

export default function BudgetPage() {
    const [categories, setCategories] = useState<CategoryBudget[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLimit, setEditLimit] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Get Categories (Expense)
            const { data: catData, error: catError } = await supabase
                .from('categories')
                .select('*')
                .eq('type', 'expense');

            if (catError) throw catError;

            // 2. Get Expenses for Current Month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { data: expData, error: expError } = await supabase
                .from('expenses')
                .select('amount, category')
                .gte('date', startOfMonth);

            if (expError) throw expError;

            // 3. Merge Data
            const merged = (catData || []).map(cat => {
                const spent = (expData || [])
                    .filter(e => e.category === cat.name)
                    .reduce((acc, curr) => acc + curr.amount, 0);

                return {
                    id: cat.id,
                    name: cat.name,
                    type: cat.type,
                    monthly_limit: cat.monthly_limit || 0,
                    spent
                };
            });

            // Sort: High spending % first
            merged.sort((a, b) => {
                const aRatio = a.monthly_limit > 0 ? a.spent / a.monthly_limit : (a.spent > 0 ? 100 : 0);
                const bRatio = b.monthly_limit > 0 ? b.spent / b.monthly_limit : (b.spent > 0 ? 100 : 0);
                return bRatio - aRatio;
            });

            setCategories(merged);

        } catch (error) {
            console.error('Bütçe verisi çekilemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLimit = async (id: string) => {
        try {
            const limit = parseFloat(editLimit) || 0;
            const { error } = await supabase
                .from('categories')
                .update({ monthly_limit: limit })
                .eq('id', id);

            if (error) throw error;

            setCategories(categories.map(c => c.id === id ? { ...c, monthly_limit: limit } : c));
            setEditingId(null);
        } catch (error) {
            console.error('Limit güncellenemedi:', error);
            alert('Limit kaydedilirken hata oluştu.');
        }
    };

    // Analysis Helpers
    const totalLimit = categories.reduce((acc, c) => acc + (c.monthly_limit || 0), 0);
    const totalSpent = categories.reduce((acc, c) => acc + c.spent, 0);
    const budgetHealth = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bütçe & Planlama</h2>
                    <p className="text-muted-foreground mt-1">
                        Harcama limitlerinizi belirleyin ve bütçe hedeflerinize sadık kalın.
                    </p>
                </div>
            </div>

            {/* Top Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Toplam Belirlenen Bütçe</h3>
                    <div className="mt-2 text-2xl font-bold">₺{totalLimit.toLocaleString('tr-TR')}</div>
                    <p className="text-xs text-muted-foreground mt-1">Tüm kategoriler için aylık limit</p>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Bu Ay Harcanan</h3>
                    <div className={`mt-2 text-2xl font-bold ${totalSpent > totalLimit && totalLimit > 0 ? 'text-red-500' : 'text-foreground'}`}>
                        ₺{totalSpent.toLocaleString('tr-TR')}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {totalLimit > 0
                            ? `%${Math.round(budgetHealth)} kullanıldı`
                            : 'Henüz limit belirlenmedi'}
                    </p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <TrendingUp className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="text-indigo-900 font-semibold text-sm">Finansal Öneri</h4>
                            <p className="text-indigo-700/80 text-xs mt-1">
                                {totalSpent > totalLimit && totalLimit > 0
                                    ? "Dikkat! Toplam bütçe limitinizi aştınız. Harcamalarınızı gözden geçirin."
                                    : budgetHealth > 80
                                        ? "Bütçe limitinize yaklaşıyorsunuz (%80+). Gereksiz harcamaları kısın."
                                        : "Tebrikler! Bütçe planınıza sadık kalıyorsunuz. Tasarruf için harika bir ay."
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Budget Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => {
                    const percentage = cat.monthly_limit > 0 ? (cat.spent / cat.monthly_limit) * 100 : 0;
                    const isOver = percentage > 100;
                    const isWarning = percentage > 80;

                    return (
                        <div key={cat.id} className="p-5 rounded-xl border bg-card shadow-sm flex flex-col gap-4 group hover:border-primary/20 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-semibold text-lg">{cat.name}</h4>
                                    <p className="text-xs text-muted-foreground">Aylık Limit</p>
                                </div>
                                {editingId === cat.id ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            autoFocus
                                            type="number"
                                            className="w-20 px-2 py-1 text-sm border rounded bg-background"
                                            value={editLimit}
                                            onChange={(e) => setEditLimit(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveLimit(cat.id);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <button onClick={() => handleSaveLimit(cat.id)} className="text-green-500 hover:bg-green-50 p-1 rounded">
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setEditingId(cat.id);
                                            setEditLimit(cat.monthly_limit.toString());
                                        }}
                                        className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Harcanan: ₺{cat.spent.toLocaleString()}</span>
                                    <span className="font-medium">
                                        {cat.monthly_limit > 0 ? `Limit: ₺${cat.monthly_limit.toLocaleString()}` : 'Limit Yok'}
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden relative">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>

                                <div className="text-xs text-right text-muted-foreground">
                                    {isOver ? (
                                        <span className="text-red-500 font-medium flex items-center justify-end gap-1">
                                            <AlertTriangle className="w-3 h-3" /> %{Math.round(percentage)} (Limit Aşıldı!)
                                        </span>
                                    ) : (
                                        <span>%{Math.round(percentage)} Doluluk</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {categories.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        Henüz gider kategorisi bulunmuyor. Giderler sayfasına giderek kategori oluşturabilirsiniz.
                    </div>
                )}
            </div>
        </div>
    );
}
