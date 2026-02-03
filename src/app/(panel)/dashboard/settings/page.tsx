'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Loader2, Database } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);

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
                    Sistem tercihlerinizi yapılandırın ve finansal raporlarınızı dışa aktarın.
                </p>
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
                <div className="p-6 space-y-4 opacity-50 pointer-events-none">
                    <div className="flex items-center justify-between">
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
