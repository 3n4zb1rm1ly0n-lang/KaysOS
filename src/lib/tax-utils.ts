export const TAX_CONSTANTS = {
    // 2024-2025 Standards
    INCOME_TAX_RATE: 0.20, // Basit usul / Kurumlar tahmini (Configurable later)
    PROVISIONAL_TAX_RATE: 0.20, // Geçici Vergi Oranı
};

interface TaxDeadline {
    title: string;
    date: Date;
    type: 'KDV' | 'Geçici' | 'Yıllık';
    description: string;
    remainingDays: number;
}

export const getNextTaxDeadlines = (): TaxDeadline[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    const deadlines: TaxDeadline[] = [];

    // --- 1. KDV (Her ayın 28'i) ---
    // Sadece önümüzdeki 2 ayı gösterelim ki liste dolmasın
    for (let i = 0; i < 2; i++) {
        let kdvMonth = currentMonth + i;
        let kdvYear = currentYear;

        // Eğer ay 28'ini geçtiyse bir sonraki aydan başla (i=0 için)
        if (i === 0 && now.getDate() > 28) {
            kdvMonth++;
        }

        if (kdvMonth > 11) {
            kdvMonth -= 12;
            kdvYear++;
        }

        const kdvDate = new Date(kdvYear, kdvMonth, 28);
        deadlines.push({
            title: `${new Intl.DateTimeFormat('tr-TR', { month: 'long' }).format(kdvDate)} KDV Beyanı`,
            date: kdvDate,
            type: 'KDV',
            description: 'Aylık KDV beyannamesi ve ödemesi',
            remainingDays: Math.ceil((kdvDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        });
    }


    // --- 2. Geçici Vergi (17 Mayıs, 17 Ağustos, 17 Kasım, 17 Şubat) ---
    // Tüm yılın kalanlarını ekle
    const provisionalDates = [
        { date: new Date(currentYear, 4, 17), term: '1. Dönem' }, // 17 Mayıs
        { date: new Date(currentYear, 7, 17), term: '2. Dönem' }, // 17 Ağustos
        { date: new Date(currentYear, 10, 17), term: '3. Dönem' }, // 17 Kasım
        { date: new Date(currentYear + 1, 1, 17), term: '4. Dönem' } // 17 Şubat (Sonraki Yıl)
    ];

    provisionalDates.forEach(p => {
        if (p.date > now) {
            deadlines.push({
                title: `Geçici Vergi (${p.term})`,
                date: p.date,
                type: 'Geçici',
                description: '3 aylık kazanç üzerinden peşin vergi',
                remainingDays: Math.ceil((p.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            });
        }
    });

    // --- 3. Yıllık Gelir Vergisi (Mart ve Temmuz) ---
    const annualInstallments = [
        { date: new Date(currentYear, 2, 31), title: 'Yıllık Gelir Vergisi (1. Taksit)' },
        { date: new Date(currentYear, 6, 31), title: 'Yıllık Gelir Vergisi (2. Taksit)' }
    ];

    annualInstallments.forEach(inst => {
        if (inst.date > now) {
            deadlines.push({
                title: inst.title,
                date: inst.date,
                type: 'Yıllık',
                description: 'Yıllık kazanç vergisi taksiti',
                remainingDays: Math.ceil((inst.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            });
        } else {
            // Eğer bu yılın tarihi geçtiyse, seneye ekle (Opsiyonel, şimdilik sadece bu yılı gösterelim kafa karışmasın)
            // Yıllık döngüde Mart'ı kaçırdıysak seneye Mart'ı gösteriyoruz genelde ama burada "Bu Yılki Ödemeler" odağı var.
            // Kullanıcı "Seneye Mart"ı şimdi görmek istemeyebilir, ama Temmuz'u görmek ister.
            // Eğer ikisi de geçtiyse (örneğin Aralık ayındayız), seneye Mart'ı gösterelim.
            if (currentMonth > 6) { // Temmuz bittiyse
                const nextYearDate = new Date(inst.date);
                nextYearDate.setFullYear(currentYear + 1);
                deadlines.push({
                    title: inst.title,
                    date: nextYearDate,
                    type: 'Yıllık',
                    description: 'Yıllık kazanç vergisi taksiti',
                    remainingDays: Math.ceil((nextYearDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                });
            }
        }
    });

    // Sort by nearest
    return deadlines.sort((a, b) => a.remainingDays - b.remainingDays);
};

export const calculateEstimatedIncomeTax = (
    totalIncome: number,
    totalExpense: number
) => {
    const profit = totalIncome - totalExpense;
    if (profit <= 0) return { tax: 0, effectiveRate: 0, bracket: 0 };

    // 2025 Gelir Vergisi Dilimleri (Ücret Dışı Gelirler İçin)
    const brackets = [
        { limit: 158000, rate: 0.15 },
        { limit: 330000, rate: 0.20 },
        { limit: 800000, rate: 0.27 }, // Güncellendi
        { limit: 4300000, rate: 0.35 }, // Güncellendi
        { limit: Infinity, rate: 0.40 }
    ];

    let remainingProfit = profit;
    let totalTax = 0;
    let previousLimit = 0;
    let currentBracketRate = 0;

    for (const bracket of brackets) {
        const taxableInThisBracket = Math.min(remainingProfit, bracket.limit - previousLimit);

        if (taxableInThisBracket <= 0) break;

        totalTax += taxableInThisBracket * bracket.rate;
        remainingProfit -= taxableInThisBracket;
        previousLimit = bracket.limit;
        currentBracketRate = bracket.rate;

        if (remainingProfit <= 0) break;
    }

    return {
        tax: totalTax,
        effectiveRate: (totalTax / profit) * 100,
        bracket: currentBracketRate * 100
    };
};
