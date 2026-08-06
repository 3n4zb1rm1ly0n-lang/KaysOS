/** Benzin dolum — odometre bazlı tüketim hesabı */

export type FuelLog = {
    id?: string;
    fill_date: string; // YYYY-MM-DD
    amount_tl: number;
    price_per_liter: number;
    odometer_km: number;
    note: string;
};

export type FuelLogComputed = FuelLog & {
    liters: number;
    delta_km: number | null;
    l_per_100km: number | null;
    tl_per_km: number | null;
    odometer_warning: boolean;
};

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(n: number): number {
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function litersFrom(amountTl: number, pricePerLiter: number): number {
    if (!pricePerLiter || pricePerLiter <= 0) return 0;
    return amountTl / pricePerLiter;
}

/** Tarih artan, aynı günde km artan sıralama */
export function sortFuelLogs(logs: FuelLog[]): FuelLog[] {
    return [...logs].sort((a, b) => {
        if (a.fill_date !== b.fill_date) return a.fill_date < b.fill_date ? -1 : 1;
        return a.odometer_km - b.odometer_km;
    });
}

/** Önceki doluma göre Δ km ve L/100km */
export function enrichFuelLogs(logs: FuelLog[]): FuelLogComputed[] {
    const sorted = sortFuelLogs(logs);
    return sorted.map((log, i) => {
        const liters = litersFrom(log.amount_tl, log.price_per_liter);
        const prev = i > 0 ? sorted[i - 1] : null;
        let delta_km: number | null = null;
        let odometer_warning = false;
        if (prev) {
            const d = log.odometer_km - prev.odometer_km;
            if (d > 0) delta_km = round2(d);
            else odometer_warning = true;
        }
        const l_per_100km =
            delta_km && delta_km > 0 ? round3((liters / delta_km) * 100) : null;
        const tl_per_km =
            delta_km && delta_km > 0 ? round3(log.amount_tl / delta_km) : null;

        return {
            ...log,
            liters: round3(liters),
            delta_km,
            l_per_100km,
            tl_per_km,
            odometer_warning
        };
    });
}

export type FuelMonthSummary = {
    count: number;
    totalAmount: number;
    totalLiters: number;
    avgPricePerLiter: number;
    totalDeltaKm: number;
    avgLPer100km: number | null;
    tlPerKm: number | null;
};

export function summarizeFuelMonth(rows: FuelLogComputed[]): FuelMonthSummary {
    const count = rows.length;
    let totalAmount = 0;
    let totalLiters = 0;
    let priceWeighted = 0;
    let totalDeltaKm = 0;
    let consLiters = 0;
    let consKm = 0;

    for (const r of rows) {
        totalAmount += r.amount_tl;
        totalLiters += r.liters;
        priceWeighted += r.price_per_liter * r.liters;
        if (r.delta_km && r.delta_km > 0) {
            totalDeltaKm += r.delta_km;
            consLiters += r.liters;
            consKm += r.delta_km;
        }
    }

    return {
        count,
        totalAmount: round2(totalAmount),
        totalLiters: round3(totalLiters),
        avgPricePerLiter: totalLiters > 0 ? round3(priceWeighted / totalLiters) : 0,
        totalDeltaKm: round2(totalDeltaKm),
        avgLPer100km: consKm > 0 ? round3((consLiters / consKm) * 100) : null,
        tlPerKm: totalDeltaKm > 0 ? round3(totalAmount / totalDeltaKm) : null
    };
}

export function fmtMoney(n: number): string {
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNum(n: number, digits = 2): string {
    return n.toLocaleString('tr-TR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

export function monthBounds(year: number, monthIndex: number): { from: string; to: string } {
    const from = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const last = new Date(year, monthIndex + 1, 0).getDate();
    const to = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from, to };
}

/** Aylık kazanç gider satırı — KDV yok, netten düşer */
export const FUEL_EXPENSE_SOURCE = 'fuel';
export const FUEL_EXPENSE_NAME = 'Benzin';
export const FUEL_EXPENSE_KDV_RATE = 0;

