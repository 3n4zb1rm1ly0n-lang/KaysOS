
'use client';

import { useState, useEffect } from 'react';
import {
    Calculator,
    TrendingUp,
    TrendingDown,
    FileText,
    ArrowRightLeft,
    PieChart,
    Loader2,
    Calendar,
    AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getNextTaxDeadlines, calculateEstimatedIncomeTax } from '@/lib/tax-utils';

interface TaxRecord {
    id: string;
    date: string;
    type: 'Gelir' | 'Gider' | 'Manuel İndirim';
    description: string;
    totalAmount: number;
    taxRate: number;
    taxAmount: number;
    netAmount: number;
}

export default function AccountingPage() {
    const [records, setRecords] = useState<TaxRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [taxDeadlines, setTaxDeadlines] = useState<any[]>([]);

    // Quick Calculator State
    const [calcAmount, setCalcAmount] = useState('');
    const [calcRate, setCalcRate] = useState(20);
    const [calcType, setCalcType] = useState<'dahil' | 'haric'>('dahil');

    useEffect(() => {
        fetchTaxRecords();
        setTaxDeadlines(getNextTaxDeadlines());
    }, []);

    const fetchTaxRecords = async () => {
        try {
            setLoading(true);

            // Fetch Incomes with Tax
            const { data: incomeData } = await supabase
                .from('incomes')
                .select('*')
                .gt('tax_amount', 0)
                .order('date', { ascending: false });

            // Fetch Expenses with Tax
            const { data: expenseData } = await supabase
                .from('expenses')
                .select('*')
                .gt('tax_amount', 0)
                .order('date', { ascending: false });

            // Fetch Manual Tax Deductions
            const { data: manualData } = await supabase
                .from('tax_entries')
                .select('*')
                .order('date', { ascending: false });

            let allRecords: TaxRecord[] = [];

            if (incomeData) {
                const incomes: TaxRecord[] = incomeData.map(item => ({
                    id: item.id,
                    date: item.date,
                    type: 'Gelir',
                    description: item.description || item.source,
                    totalAmount: item.amount,
                    taxRate: item.tax_rate || 20,
                    taxAmount: item.tax_amount,
                    netAmount: item.amount - item.tax_amount
                }));
                allRecords = [...allRecords, ...incomes];
            }

            if (expenseData) {
                const expenses: TaxRecord[] = expenseData.map(item => ({
                    id: item.id,
                    date: item.date,
                    type: 'Gider',
                    description: item.description || item.recipient,
                    totalAmount: item.amount,
                    taxRate: item.tax_rate || 20,
                    taxAmount: item.tax_amount,
                    netAmount: item.amount - item.tax_amount
                }));
                allRecords = [...allRecords, ...expenses];
            }

            if (manualData) {
                const manuals: TaxRecord[] = manualData.map(item => ({
                    id: item.id,
                    date: item.date,
                    type: 'Manuel İndirim' as const, // Type casting trick if needed, or just string
                    description: `${item.description} (Manuel Fiş)`,
                    totalAmount: 0, // 0 For cash flow, but we track it conceptually
                    taxRate: item.tax_rate,
                    taxAmount: item.tax_amount, // This is the important part
                    netAmount: 0
                }));
                // We treat manual deductions as "Expenses" for tax purposes, so they reduce tax liability.
                // However, they are not "real" expenses for profit calculation (user instruction).
                allRecords = [...allRecords, ...manuals];
            }

            // Sort by Date Descending
            allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setRecords(allRecords);

        } catch (error) {
            console.error('Vergi kayıtları çekilemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    // Summary Calculations
    const totalIncomeTax = records.filter(r => r.type === 'Gelir').reduce((acc, curr) => acc + curr.taxAmount, 0);
    // Include both real Expenses and Manual Deductions in the "Deductible Tax" total
    const totalExpenseTax = records.filter(r => r.type === 'Gider' || r.type === 'Manuel İndirim').reduce((acc, curr) => acc + curr.taxAmount, 0);

    const netTaxPosition = totalIncomeTax - totalExpenseTax;

    // Profit & Income Tax Estimation (Simple)
    // EXCLUDE 'Manuel İndirim' from these totals as per user request (no effect on money flow)
    const totalIncome = records.filter(r => r.type === 'Gelir').reduce((acc, curr) => acc + (curr.netAmount || (curr.totalAmount - curr.taxAmount)), 0);
    const totalExpense = records.filter(r => r.type === 'Gider').reduce((acc, curr) => acc + (curr.netAmount || (curr.totalAmount - curr.taxAmount)), 0);

    const estimatedIncomeTax = calculateEstimatedIncomeTax(totalIncome, totalExpense);

    const calculateQuickTax = () => {
        const amount = parseFloat(calcAmount) || 0;
        if (calcType === 'dahil') {
            const tax = (amount * calcRate) / (100 + calcRate);
            return { tax, net: amount - tax, total: amount };
        } else {
            const tax = (amount * calcRate) / 100;
            return { tax, net: amount, total: amount + tax };
        }
    };

    const quickResult = calculateQuickTax();

    // Manual Entry State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEntry, setNewEntry] = useState({
        description: '',
        amount: '',
        taxRate: 20,
        date: new Date().toISOString().split('T')[0],
        category: 'Diğer'
    });

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const numericAmount = parseFloat(newEntry.amount);
            const rate = Number(newEntry.taxRate);
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

            fetchTaxRecords();
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
                    <h2 className="text-3xl font-bold tracking-tight">Muhasebe & KDV Takibi</h2>
                    <p className="text-muted-foreground mt-1">
                        Otomatik hesaplanan KDV raporlarınız. (Veriler Gelir ve Giderlerden çekilir)
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <FileText className="w-5 h-5" />
                    Manuel Fiş Ekle
                </button>
            </div>

            {/* Tax Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp className="w-24 h-24 text-green-500" />
                    </div>
                    <h3 className="text-sm font-medium text-muted-foreground">Hesaplanan KDV (Gelir)</h3>
                    <div className="mt-2 text-3xl font-bold text-green-500">₺{totalIncomeTax.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground mt-1">Müşterilerden tahsil edilen</p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingDown className="w-24 h-24 text-red-500" />
                    </div>
                    <h3 className="text-sm font-medium text-muted-foreground">İndirilecek KDV (Gider)</h3>
                    <div className="mt-2 text-3xl font-bold text-red-500">₺{totalExpenseTax.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground mt-1">Fiş/Faturalardan düşülen</p>
                </div>

                <div className={`p-6 rounded-xl border shadow-sm relative overflow-hidden ${netTaxPosition > 0 ? 'bg-orange-500/10 border-orange-200' : 'bg-green-500/10 border-green-200'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ArrowRightLeft className={`w-24 h-24 ${netTaxPosition > 0 ? 'text-orange-500' : 'text-green-500'}`} />
                    </div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {netTaxPosition > 0 ? 'Ödenecek KDV' : 'Sonraki Aya Devreden'}
                    </h3>
                    <div className={`mt-2 text-3xl font-bold ${netTaxPosition > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₺{Math.abs(netTaxPosition).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Güncel kümülatif denge</p>
                </div>
            </div>

            {/* Annual Summary */}
            <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    {new Date().getFullYear()} Yılı Özeti
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                        <h3 className="text-xs font-medium text-muted-foreground">Yıllık Hesaplanan KDV</h3>
                        <div className="mt-1 text-2xl font-bold text-foreground">
                            ₺{records
                                .filter(r => new Date(r.date).getFullYear() === new Date().getFullYear() && r.type === 'Gelir')
                                .reduce((acc, curr) => acc + curr.taxAmount, 0)
                                .toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                        <h3 className="text-xs font-medium text-muted-foreground">Yıllık İndirilecek KDV</h3>
                        <div className="mt-1 text-2xl font-bold text-foreground">
                            ₺{records
                                .filter(r => new Date(r.date).getFullYear() === new Date().getFullYear() && (r.type === 'Gider' || r.type === 'Manuel İndirim'))
                                .reduce((acc, curr) => acc + curr.taxAmount, 0)
                                .toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                        <h3 className="text-xs font-medium text-muted-foreground">Yıllık Net KDV Dengesi</h3>
                        <div className={`mt-1 text-2xl font-bold ${(records
                            .filter(r => new Date(r.date).getFullYear() === new Date().getFullYear() && r.type === 'Gelir')
                            .reduce((acc, curr) => acc + curr.taxAmount, 0) -
                            records
                                .filter(r => new Date(r.date).getFullYear() === new Date().getFullYear() && (r.type === 'Gider' || r.type === 'Manuel İndirim'))
                                .reduce((acc, curr) => acc + curr.taxAmount, 0)) > 0 ? 'text-orange-600' : 'text-green-600'
                            }`}>
                            ₺{Math.abs(records
                                .filter(r => new Date(r.date).getFullYear() === new Date().getFullYear() && r.type === 'Gelir')
                                .reduce((acc, curr) => acc + curr.taxAmount, 0) -
                                records
                                    .filter(r => new Date(r.date).getFullYear() === new Date().getFullYear() && (r.type === 'Gider' || r.type === 'Manuel İndirim'))
                                    .reduce((acc, curr) => acc + curr.taxAmount, 0)
                            ).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tax Calendar & Alerts */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Upcoming Deadlines */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        Vergi Takvimi & Hatırlatmalar
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {taxDeadlines.map((deadline, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between ${deadline.remainingDays <= 7 ? 'bg-red-500/5 border-red-200' : 'bg-card'}`}>
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${deadline.type === 'KDV' ? 'bg-purple-100 text-purple-600' :
                                            deadline.type === 'Geçici' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                            }`}>
                                            {deadline.type}
                                        </span>
                                        <span className={`text-xs font-semibold ${deadline.remainingDays <= 7 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                            {deadline.remainingDays} gün kaldı
                                        </span>
                                    </div>
                                    <h4 className="font-medium text-sm">{deadline.title}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">{deadline.description}</p>
                                </div>
                                <div className="mt-3 text-sm font-semibold opacity-80">
                                    {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(deadline.date)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Estimated Income Tax Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 mt-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-lg shadow-sm">
                                <AlertCircle className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-blue-900 font-semibold font-base">Tahmini Gelir/Geçici Vergi Matrahı</h4>
                                <p className="text-blue-700/80 text-sm mt-1">
                                    Bu dönemki kârınız üzerinden <strong>artan oranlı (dilimli)</strong> tarife ile hesaplanan tahmini vergidir.
                                    <br />
                                    <span className="text-xs opacity-75">*2025 şahıs şirketi gelir vergisi dilimleri baz alınmıştır.</span>
                                </p>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-blue-800">₺{estimatedIncomeTax.tax.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                        Ortalama Yük: %{estimatedIncomeTax.effectiveRate?.toFixed(1) || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Calculator (Right Side) */}
                <div className="lg:col-span-1 rounded-xl bg-secondary/30 border border-border h-fit p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Hızlı KDV Hesapla</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tutar</label>
                            <input
                                type="number"
                                className="w-full bg-background border rounded-lg px-3 py-2 text-sm"
                                placeholder="0.00"
                                value={calcAmount}
                                onChange={(e) => setCalcAmount(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">KDV Oranı (%)</label>
                                <select
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm"
                                    value={calcRate}
                                    onChange={(e) => setCalcRate(Number(e.target.value))}
                                >
                                    <option value={1}>%1</option>
                                    <option value={10}>%10</option>
                                    <option value={20}>%20</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hesaplama</label>
                                <select
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-sm"
                                    value={calcType}
                                    onChange={(e) => setCalcType(e.target.value as 'dahil' | 'haric')}
                                >
                                    <option value="dahil">KDV Dahil</option>
                                    <option value="haric">KDV Hariç</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 border-t space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Matrah (Net):</span>
                                <span className="font-mono">₺{quickResult.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-medium text-primary">
                                <span>KDV Tutarı:</span>
                                <span className="font-mono">₺{quickResult.tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-bold pt-2 border-t">
                                <span>Toplam:</span>
                                <span className="font-mono">₺{quickResult.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
                    <div className="p-4 border-b bg-secondary/10 flex justify-between items-center">
                        <h3 className="font-semibold flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Son Vergi Hareketleri (Otomatik)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50 text-muted-foreground font-medium">
                                <tr>
                                    <th className="px-4 py-3">Tarih</th>
                                    <th className="px-4 py-3">Tür</th>
                                    <th className="px-4 py-3">Açıklama</th>
                                    <th className="px-4 py-3 text-right">Tutar</th>
                                    <th className="px-4 py-3 text-right">Oran</th>
                                    <th className="px-4 py-3 text-right">KDV</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Henüz KDV içeren bir gelir veya gider kaydı bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="hover:bg-secondary/30">
                                            <td className="px-4 py-3 text-muted-foreground">{record.date}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${record.type === 'Gelir'
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : record.type === 'Manuel İndirim'
                                                        ? 'bg-blue-500/10 text-blue-500'
                                                        : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    {record.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium">{record.description}</td>
                                            <td className="px-4 py-3 text-right font-mono">₺{record.totalAmount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">% {record.taxRate}</td>
                                            <td className="px-4 py-3 text-right font-mono font-medium">
                                                ₺{record.taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Manual Entry Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">Manuel Fiş Ekle</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Bu alandan eklediğiniz fişler kasanızdan para çıkışı olarak görünmez, sadece vergi hesaplamasında 'İndirilecek KDV' olarak kullanılır.
                        </p>
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
