'use client';

import { useState, useEffect } from 'react';
import { Plus, Wallet, Target, TrendingUp, PiggyBank, Loader2, MoreVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SavingGoal {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline?: string;
    category: 'Acil Durum' | 'Yatırım' | 'Tatil' | 'Teknoloji' | 'Araç' | 'Diğer';
    icon_color?: string;
}

export default function SavingsPage() {
    const [goals, setGoals] = useState<SavingGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // New Goal Form State
    const [newGoal, setNewGoal] = useState({
        name: '',
        target_amount: '',
        current_amount: '',
        deadline: '',
        category: 'Diğer'
    });

    useEffect(() => {
        fetchGoals();
    }, []);

    const fetchGoals = async () => {
        try {
            // First run migration if table doesn't exist (simulated for now, assumes you run SQL)
            // Ideally migration is handled separately. We'll proceed assuming table exists or created.
            const { data, error } = await supabase
                .from('savings')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // If table not found error, we might handle it gracefully or log it.
                // dealing with it by showing empty state
                console.error("Error fetching savings:", error);
            } else if (data) {
                setGoals(data as any);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const totalSaved = goals.reduce((acc, curr) => acc + curr.current_amount, 0);
    const totalTarget = goals.reduce((acc, curr) => acc + curr.target_amount, 0);
    const totalProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const handleAddGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const numTarget = parseFloat(newGoal.target_amount);
            const numCurrent = parseFloat(newGoal.current_amount) || 0;

            const { data, error } = await supabase
                .from('savings')
                .insert([{
                    name: newGoal.name,
                    target_amount: numTarget,
                    current_amount: numCurrent,
                    deadline: newGoal.deadline || null,
                    category: newGoal.category,
                    icon_color: 'blue' // Default for now
                }])
                .select();

            if (error) throw error;

            if (data) {
                setGoals([data[0] as any, ...goals]);
                setShowAddModal(false);
                setNewGoal({ name: '', target_amount: '', current_amount: '', deadline: '', category: 'Diğer' });
            }
        } catch (error) {
            console.error(error);
            alert('Hedef eklenirken hata oluştu. Lütfen veritabanı tablosunun oluşturulduğundan emin olun.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu birikim hedefini silmek istediğinize emin misiniz?')) return;

        try {
            const { error } = await supabase.from('savings').delete().eq('id', id);
            if (error) throw error;
            setGoals(goals.filter(g => g.id !== id));
        } catch (error) {
            console.error(error);
            alert('Silinirken hata oluştu.');
        }
    };

    const updateAmount = async (id: string, newAmount: number) => {
        // Quick update logic could go here
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Birikim Hedefleri</h2>
                    <p className="text-muted-foreground mt-1">
                        Gelecek planlarınız için finansal hedeflerinizi yönetin ve takip edin.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Yeni Hedef
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Toplam Birikim</p>
                            <h3 className="text-3xl font-bold mt-2 text-green-600">₺{totalSaved.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <PiggyBank className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Genel Hedef</p>
                            <h3 className="text-3xl font-bold mt-2 text-primary">₺{totalTarget.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Target className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>
                {/* Overall Progress */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Genel İlerleme</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-bold">%{totalProgress.toFixed(1)}</h3>
                        </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 mt-4">
                        <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(totalProgress, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Goals Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {goals.map((goal) => {
                    const progress = (goal.current_amount / goal.target_amount) * 100;
                    return (
                        <div key={goal.id} className="group relative bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all hover:-translate-y-1">
                            <button
                                onClick={() => handleDelete(goal.id)}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-secondary rounded-xl">
                                    <Wallet className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">{goal.name}</h4>
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                        {goal.category}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Biriken</span>
                                    <span className="font-bold">₺{goal.current_amount.toLocaleString()}</span>
                                </div>

                                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-primary h-full rounded-full transition-all duration-500 relative"
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Hedef: ₺{goal.target_amount.toLocaleString()}</span>
                                    <span className="font-medium text-primary">%{progress.toFixed(0)}</span>
                                </div>

                                {goal.deadline && (
                                    <div className="pt-4 border-t text-xs text-muted-foreground flex items-center gap-2">
                                        <Target className="w-3 h-3" />
                                        Hedef Tarih: {new Date(goal.deadline).toLocaleDateString('tr-TR')}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Empty State / Add New Card */}
                {goals.length === 0 && !loading && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-muted-foreground hover:border-primary hover:text-primary hover:bg-secondary/10 transition-colors min-h-[250px]"
                    >
                        <div className="p-4 bg-secondary rounded-full">
                            <Plus className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                            <h4 className="font-medium">Henüz birikim hedefin yok</h4>
                            <p className="text-sm mt-1">İlk hedefini oluşturmak için tıkla</p>
                        </div>
                    </button>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">Yeni Birikim Hedefi</h3>
                        <form onSubmit={handleAddGoal} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Hedef Adı</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Örn: Yeni Araba"
                                    value={newGoal.name}
                                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Hedef Tutar</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newGoal.target_amount}
                                        onChange={(e) => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Şu Anki Tutar</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="0.00"
                                        value={newGoal.current_amount}
                                        onChange={(e) => setNewGoal({ ...newGoal, current_amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Kategori</label>
                                    <select
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newGoal.category}
                                        onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value as any })}
                                    >
                                        <option value="Diğer">Diğer</option>
                                        <option value="Acil Durum">Acil Durum</option>
                                        <option value="Yatırım">Yatırım</option>
                                        <option value="Tatil">Tatil</option>
                                        <option value="Teknoloji">Teknoloji</option>
                                        <option value="Araç">Araç</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Hedef Tarih (Opsiyonel)</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none block"
                                        value={newGoal.deadline}
                                        onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                                    />
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
                                    Hedefi Oluştur
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
