
'use client';

import { useState } from 'react';
import {
    Calculator,
    TrendingUp,
    TrendingDown,
    FileText,
    Plus,
    ArrowRightLeft,
    PieChart,
    Pencil,
    Trash2
} from 'lucide-react';

interface TaxRecord {
    id: string;
    date: string;
    type: 'Gelir' | 'Gider';
    description: string;
    totalAmount: number;
    taxRate: number;
    taxAmount: number;
    netAmount: number;
}

const MOCK_RECORDS: TaxRecord[] = [];

export default function AccountingPage() {
    const [records, setRecords] = useState<TaxRecord[]>(MOCK_RECORDS);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Quick Calculator State
    const [calcAmount, setCalcAmount] = useState('');
    const [calcRate, setCalcRate] = useState(20);
    const [calcType, setCalcType] = useState<'dahil' | 'haric'>('dahil');

    // Summary Calculations
    const totalIncomeTax = records.filter(r => r.type === 'Gelir').reduce((acc, curr) => acc + curr.taxAmount, 0);
    const totalExpenseTax = records.filter(r => r.type === 'Gider').reduce((acc, curr) => acc + curr.taxAmount, 0);
    const netTaxPosition = totalIncomeTax - totalExpenseTax;

    // New Record Form State
    const [newRecord, setNewRecord] = useState({
        description: '',
        type: 'Gelir' as 'Gelir' | 'Gider',
        totalAmount: '',
        taxRate: 20,
        date: new Date().toISOString().split('T')[0]
    });

    const handleAddRecord = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(newRecord.totalAmount);
        const taxAmount = (amount * newRecord.taxRate) / (100 + newRecord.taxRate);

        if (editingId) {
            // Update
            const updated: TaxRecord = {
                id: editingId,
                date: newRecord.date,
                type: newRecord.type,
                description: newRecord.description,
                totalAmount: amount,
                taxRate: newRecord.taxRate,
                taxAmount: taxAmount,
                netAmount: amount - taxAmount
            };
            setRecords(records.map(r => r.id === editingId ? updated : r));
        } else {
            // Create
            const record: TaxRecord = {
                id: Math.random().toString(36).substr(2, 9),
                date: newRecord.date,
                type: newRecord.type,
                description: newRecord.description,
                totalAmount: amount,
                taxRate: newRecord.taxRate,
                taxAmount: taxAmount,
                netAmount: amount - taxAmount
            };
            setRecords([record, ...records]);
        }

        setShowAddModal(false);
        setEditingId(null);
        setNewRecord({ description: '', type: 'Gelir', totalAmount: '', taxRate: 20, date: new Date().toISOString().split('T')[0] });
    };

    const handleDelete = (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        setRecords(records.filter(r => r.id !== id));
    };

    const handleEdit = (record: TaxRecord) => {
        setEditingId(record.id);
        setNewRecord({
            date: record.date,
            type: record.type,
            description: record.description,
            totalAmount: record.totalAmount.toString(),
            taxRate: record.taxRate
        });
        setShowAddModal(true);
    };

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Muhasebe & KDV Takibi</h2>
                    <p className="text-muted-foreground mt-1">
                        Vergi durumunuzu ve KDV dengenizi buradan yönetin.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setNewRecord({ description: '', type: 'Gelir', totalAmount: '', taxRate: 20, date: new Date().toISOString().split('T')[0] });
                        setShowAddModal(true);
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Vergi Kaydı Ekle
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
                    <p className="text-xs text-muted-foreground mt-1">Güncel vergi dengesi</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Quick Calculator */}
                <div className="lg:col-span-1 p-6 rounded-xl bg-secondary/30 border border-border h-fit">
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
                            Son Vergi Hareketleri
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
                                    <th className="px-4 py-3 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {records.map((record) => (
                                    <tr key={record.id} className="hover:bg-secondary/30">
                                        <td className="px-4 py-3 text-muted-foreground">{record.date}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${record.type === 'Gelir'
                                                ? 'bg-green-500/10 text-green-500'
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
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="p-2 hover:bg-secondary rounded-lg transition-colors text-blue-500 hover:text-blue-400"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id)}
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
            </div>

            {/* Add Tax Record Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4">{editingId ? 'Vergi Kaydı Düzenle' : 'Yeni Vergi Kaydı'}</h3>
                        <form onSubmit={handleAddRecord} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground mb-1 block">İşlem Türü</label>
                                    <div className="flex bg-secondary/50 rounded-lg p-1">
                                        <button
                                            type="button"
                                            onClick={() => setNewRecord({ ...newRecord, type: 'Gelir' })}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${newRecord.type === 'Gelir' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                        >
                                            Gelir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewRecord({ ...newRecord, type: 'Gider' })}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${newRecord.type === 'Gider' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                        >
                                            Gider
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Tarih</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={newRecord.date}
                                        onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Toplam Tutar (KDV Dahil)</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="0.00"
                                    value={newRecord.totalAmount}
                                    onChange={(e) => setNewRecord({ ...newRecord, totalAmount: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">KDV Oranı (%)</label>
                                <select
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={newRecord.taxRate}
                                    onChange={(e) => setNewRecord({ ...newRecord, taxRate: Number(e.target.value) })}
                                >
                                    <option value={1}>%1 (Gıda vb.)</option>
                                    <option value={8}>%8 (Eski KDV)</option>
                                    <option value={10}>%10 (Temel İhtiyaç)</option>
                                    <option value={18}>%18 (Eski Genel)</option>
                                    <option value={20}>%20 (Genel Hizmet)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Açıklama</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-secondary/50 rounded-lg border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Fiş/Fatura detayları..."
                                    value={newRecord.description}
                                    onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
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
                                    {editingId ? 'Güncelle' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
