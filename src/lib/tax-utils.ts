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
    // If today is past 28th, next deadline is next month's 28th.
    let kdvMonth = currentMonth;
    let kdvYear = currentYear;

    if (now.getDate() > 28) {
        kdvMonth = currentMonth + 1;
        if (kdvMonth > 11) {
            kdvMonth = 0;
            kdvYear++;
        }
    }

    // Aslında bir sonraki ayın 28'i, bir önceki ayın beyanıdır.
    // Basitlik için "Sıradaki KDV Ödemesi" olarak set ediyoruz.
    const kdvDate = new Date(kdvYear, kdvMonth, 28);
    deadlines.push({
        title: `${new Intl.DateTimeFormat('tr-TR', { month: 'long' }).format(kdvDate)} KDV Beyanı`,
        date: kdvDate,
        type: 'KDV',
        description: 'Aylık KDV beyannamesi ve ödemesi',
        remainingDays: Math.ceil((kdvDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    });

    // --- 2. Geçici Vergi (17 Mayıs, 17 Ağustos, 17 Kasım) ---
    const provisionalDates = [
        new Date(currentYear, 4, 17), // 17 Mayıs (1. Dönem)
        new Date(currentYear, 7, 17), // 17 Ağustos (2. Dönem)
        new Date(currentYear, 10, 17), // 17 Kasım (3. Dönem)
        new Date(currentYear + 1, 1, 17) // 17 Şubat (4. Dönem - Bazen Mart)
    ];

    const nextProvisional = provisionalDates.find(d => d > now) || provisionalDates[0]; // Döngüsel basit mantık

    // Eğer yıl bittiyse ve şubat'ı kaçırdıysak sonraki yıla atar (basit tutuyoruz)
    if (nextProvisional < now) {
        nextProvisional.setFullYear(currentYear + 1);
    }

    deadlines.push({
        title: 'Geçici Vergi Dönemi',
        date: nextProvisional,
        type: 'Geçici',
        description: '3 aylık kazanç üzerinden peşin vergi',
        remainingDays: Math.ceil((nextProvisional.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    });

    // --- 3. Yıllık Gelir Vergisi (Mart Sonu) ---
    const annualDate = new Date(currentYear, 2, 31); // 31 Mart
    if (now > annualDate) {
        annualDate.setFullYear(currentYear + 1);
    }

    deadlines.push({
        title: 'Yıllık Gelir Vergisi (1. Taksit)',
        date: annualDate,
        type: 'Yıllık',
        description: 'Yıllık kazanç vergisi beyanı ve ilk taksit',
        remainingDays: Math.ceil((annualDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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
