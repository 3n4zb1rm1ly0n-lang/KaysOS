'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Loader2, Database, Tag, Plus, Trash2, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense' | 'debt' | 'invoice' | 'saving';
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);

    // Category Management State
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'debt' | 'invoice' | 'saving'>('income');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [loadingCategories, setLoadingCategories] = useState(false);

    // Initial Fetch (You might want to put this in a useEffect)
    // For now, we'll fetch on mount if needed, or when the section is opened.

    const fetchCategories = async () => {
        setLoadingCategories(true);
        const { data, error } = await supabase.from('categories').select('*');
        if (data) setCategories(data as any);
        setLoadingCategories(false);
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;

        try {
            const { data, error } = await supabase.from('categories').insert([{
                name: newCategoryName,
                type: activeTab
            }]).select();

            if (error) throw error;
            if (data) {
                setCategories([...categories, data[0] as any]);
                setNewCategoryName('');
            }
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Kategori eklenirken hata oluştu.');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    // Load categories on mount
    useState(() => {
        fetchCategories();
    });

    const fetchAllData = async () => {
        const [incomesRes, expensesRes, debtsRes] = await Promise.all([
            supabase.from('incomes').select('*'),
            supabase.from('expenses').select('*'),
            supabase.from('debts').select('*')
        ]);

        return {
            incomes: incomesRes.data || [],
            expenses: expensesRes.data || [],
            debts: debtsRes.data || []
        };
    };

    const exportToExcel = async () => {
        setLoading(true);
        try {
            const { incomes, expenses, debts } = await fetchAllData();

            const wb = XLSX.utils.book_new();

            // Gelirler Sayfası
            const wsIncomes = XLSX.utils.json_to_sheet(incomes);
            XLSX.utils.book_append_sheet(wb, wsIncomes, "Gelirler");

            // Giderler Sayfası
            const wsExpenses = XLSX.utils.json_to_sheet(expenses);
            XLSX.utils.book_append_sheet(wb, wsExpenses, "Giderler");

            // Borçlar Sayfası
            const wsDebts = XLSX.utils.json_to_sheet(debts);
            XLSX.utils.book_append_sheet(wb, wsDebts, "Borçlar");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `KaysOS_Finans_Raporu_${dateStr}.xlsx`);
        } catch (error) {
            console.error(error);
            alert('Rapor oluşturulurken hata çıktı.');
        } finally {
            setLoading(false);
        }
    };

    // PDF Export function simplification for demo - robust implementation usually requires custom fonts for Turkish characters
    // Standard fonts don't support special Turkish chars perfectly, but it works for basic needs.
    const exportToPDF = async () => {
        setLoading(true);
        try {
            const { incomes, expenses } = await fetchAllData();
            const doc = new jsPDF();

            doc.setFontSize(18);
            doc.text("Kaysia OS - Finansal Rapor", 14, 22);
            doc.setFontSize(11);
            doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

            // Gelirler Tablosu
            doc.text("Gelirler", 14, 40);
            autoTable(doc, {
                startY: 45,
                head: [['Tarih', 'Kaynak', 'Kategori', 'Tutar', 'Durum']],
                body: incomes.map(i => [i.date, i.source, i.category, `₺${i.amount}`, i.status]),
                theme: 'striped',
                headStyles: { fillColor: [22, 163, 74] } // Green-600
            });

            // Giderler Tablosu
            const finalY = (doc as any).lastAutoTable.finalY || 45;
            doc.text("Giderler", 14, finalY + 15);
            autoTable(doc, {
                startY: finalY + 20,
                head: [['Tarih', 'Yer', 'Kategori', 'Tutar', 'Odeme']],
                body: expenses.map(e => [e.date, e.recipient, e.category, `₺${e.amount}`, e.payment_method]),
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38] } // Red-600
            });

            doc.save(`KaysOS_Rapor_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error(error);
            alert('PDF oluşturulurken hata çıktı.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Ayarlar & Veri Yönetimi</h2>
                <p className="text-muted-foreground mt-1">
                    Sistem tercihlerinizi yapılandırın, kategorileri düzenleyin ve finansal raporlarınızı dışa aktarın.
                </p>
            </div>

            {/* AI Settings Section */}
            <div className="border rounded-xl bg-card overflow-hidden ring-1 ring-blue-500/20">
                <div className="p-6 border-b bg-secondary/10 flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-blue-500">Yapay Zeka (Asistan) Ayarları</h3>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-8">



                </div>
            </div>

            {/* Category Management Section */}
            <div className="border rounded-xl bg-card overflow-hidden">
                <div className="p-6 border-b bg-secondary/10 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Kategori ve İçerik Yönetimi</h3>
                </div>
                {/* ... existing category content ... */}
                <div className="p-6">
                    <p className="text-sm text-muted-foreground mb-6">
                        Gelir, gider ve diğer işlemler eklerken çıkan açılır menülerdeki seçenekleri buradan özelleştirebilirsiniz.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
                        <button
                            onClick={() => setActiveTab('income')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'income' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                        >
                            Gelirler
                        </button>
                        <button
                            onClick={() => setActiveTab('expense')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'expense' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                        >
                            Giderler
                        </button>
                        <button
                            onClick={() => setActiveTab('debt')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'debt' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                        >
                            Borçlar
                        </button>
                        <button
                            onClick={() => setActiveTab('invoice')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'invoice' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                        >
                            Faturalar
                        </button>
                        <button
                            onClick={() => setActiveTab('saving')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'saving' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                        >
                            Birikimler
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Yeni kategori adı..."
                                className="flex-1 px-4 py-2 bg-secondary/50 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary/20"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button
                                onClick={handleAddCategory}
                                disabled={!newCategoryName.trim()}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" />
                                Ekle
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 min-h-[100px] p-4 bg-secondary/20 rounded-xl border border-dashed border-border">
                            {categories.filter(c => c.type === activeTab).length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground py-4">
                                    <Tag className="w-8 h-8 mb-2 opacity-20" />
                                    <p>Henüz kategori eklenmemiş.</p>
                                </div>
                            ) : (
                                categories.filter(c => c.type === activeTab).map(category => (
                                    <div key={category.id} className="group flex items-center gap-2 px-3 py-1.5 bg-card border rounded-lg shadow-sm animate-in fade-in zoom-in duration-200">
                                        <span className="text-sm font-medium">{category.name}</span>
                                        <button
                                            onClick={() => handleDeleteCategory(category.id)}
                                            className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Export Section */}
            <div className="border rounded-xl bg-card overflow-hidden">
                <div className="p-6 border-b bg-secondary/10 flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Veri Dışa Aktarımı (Raporlama)</h3>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <FileSpreadsheet className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-foreground">Excel Raporu (.xlsx)</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Tüm gelir, gider ve borç verilerini ayrı sayfalar halinde ham veri olarak indirir. Detaylı analiz için uygundur.
                                </p>
                                <button
                                    onClick={exportToExcel}
                                    disabled={loading}
                                    className="mt-4 flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Excel Olarak İndir
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                                <FileText className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h4 className="font-medium text-foreground">PDF Raporu (.pdf)</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Resmi bir formatta gelir ve gider listesini sunar. Çıktı almak veya paylaşmak için idealdir.
                                </p>
                                <button
                                    onClick={exportToPDF}
                                    disabled={loading}
                                    className="mt-4 flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    PDF Olarak İndir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Other Settings Placeholder */}
            <div className="border rounded-xl bg-card">
                <div className="p-6 border-b">
                    <h3 className="font-semibold">Genel Tercihler</h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between opacity-50 pointer-events-none">
                        <div>
                            <p className="font-medium">Karanlık Mod</p>
                            <p className="text-sm text-muted-foreground">Uygulama temasını değiştirin</p>
                        </div>
                        <div className="w-10 h-6 bg-primary/20 rounded-full relative">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-primary rounded-full"></div>
                        </div>
                    </div>
                </div>
                <div className="bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
                    Diğer ayarlar yakında eklenecek.
                </div>
            </div>
        </div>
    );
}
