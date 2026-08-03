/** Paket Taxi hızlı kurye – günlük / aylık prim hesap motoru */

export type BonusTip = 'hemen' | 'sanal';

export type DayStatus = 'work' | 'leave' | 'empty';

export type PackageDayEntry = {
    date: string; // YYYY-MM-DD
    status: DayStatus;
    packages: number;
    tip: BonusTip | null;
};

export type PrimBracket = {
    min: number;
    max: number | null; // null = üst sınır yok
    amount: number;
};

export const HOURLY_RATE = 177;
export const HOURS_PER_DAY = 12;
export const DAILY_FIXED = HOURLY_RATE * HOURS_PER_DAY; // 2.124 TL
export const FULL_MONTH_WORK_DAYS = 26;
/** Şirket rakamı (1 TL yuvarlama); hesapta günlük sabit kullanılır */
export const COMPANY_FIXED_MONTHLY = 55_223;

/** Sanal market günlük prim (2–3. bölge) */
export const SANAL_DAILY_BRACKETS: PrimBracket[] = [
    { min: 20, max: 23, amount: 255 },
    { min: 24, max: 27, amount: 505 },
    { min: 28, max: 33, amount: 770 },
    { min: 34, max: 37, amount: 1180 },
    { min: 38, max: 42, amount: 1595 },
    { min: 43, max: 48, amount: 2040 },
    { min: 49, max: 54, amount: 2550 },
    { min: 55, max: 58, amount: 3055 },
    { min: 59, max: 63, amount: 3390 },
    { min: 64, max: 69, amount: 3815 },
    { min: 70, max: 75, amount: 4320 },
    { min: 76, max: null, amount: 4830 }
];

/** Migros Hemen günlük prim */
export const HEMEN_DAILY_BRACKETS: PrimBracket[] = [
    { min: 16, max: 19, amount: 200 },
    { min: 20, max: 23, amount: 510 },
    { min: 24, max: 27, amount: 760 },
    { min: 28, max: 33, amount: 1005 },
    { min: 34, max: 37, amount: 1440 },
    { min: 38, max: 42, amount: 1855 },
    { min: 43, max: 48, amount: 2305 },
    { min: 49, max: 54, amount: 2810 },
    { min: 55, max: 58, amount: 3320 },
    { min: 59, max: 63, amount: 3655 },
    { min: 64, max: 69, amount: 4080 },
    { min: 70, max: 75, amount: 4585 },
    { min: 76, max: null, amount: 5090 }
];

export const MONTHLY_BONUS_BRACKETS: PrimBracket[] = [
    { min: 700, max: 799, amount: 12_800 },
    { min: 800, max: 899, amount: 20_224 },
    { min: 900, max: 999, amount: 27_520 },
    { min: 1000, max: 1199, amount: 33_408 },
    { min: 1200, max: 1399, amount: 40_300 },
    { min: 1400, max: 1599, amount: 47_970 },
    { min: 1600, max: 1799, amount: 55_698 },
    { min: 1800, max: null, amount: 68_575 }
];

const DAY_NAMES = [
    'Pazar',
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi'
] as const;

export function formatDayLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const yy = String(y).slice(-2);
    return `${dd}.${mm}.${yy} ${DAY_NAMES[dt.getDay()]}`;
}

export function monthKey(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** Ayın tüm günleri YYYY-MM-DD */
export function daysInMonth(year: number, monthIndex: number): string[] {
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
        const d = i + 1;
        return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    });
}

/** ISO hafta anahtarı (Yıl-Wxx) — izin kotası için */
export function isoWeekKey(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function bracketFor(packages: number, brackets: PrimBracket[]): PrimBracket | null {
    if (packages <= 0) return null;
    for (const b of brackets) {
        if (packages >= b.min && (b.max === null || packages <= b.max)) return b;
    }
    return null;
}

export function dailyPrim(packages: number, tip: BonusTip | null): number {
    if (!tip || packages <= 0) return 0;
    const brackets = tip === 'hemen' ? HEMEN_DAILY_BRACKETS : SANAL_DAILY_BRACKETS;
    return bracketFor(packages, brackets)?.amount ?? 0;
}

export function nextDailyThreshold(
    packages: number,
    tip: BonusTip | null
): { remaining: number; nextAmount: number; nextMin: number } | null {
    if (!tip) return null;
    const brackets = tip === 'hemen' ? HEMEN_DAILY_BRACKETS : SANAL_DAILY_BRACKETS;
    const current = bracketFor(packages, brackets);
    if (!current) {
        const first = brackets[0];
        if (packages < first.min) {
            return { remaining: first.min - packages, nextAmount: first.amount, nextMin: first.min };
        }
        return null;
    }
    const next = brackets[brackets.indexOf(current) + 1];
    if (!next) return null;
    return { remaining: next.min - packages, nextAmount: next.amount, nextMin: next.min };
}

export function monthlyBonus(totalPackages: number): number {
    return bracketFor(totalPackages, MONTHLY_BONUS_BRACKETS)?.amount ?? 0;
}

export function nextMonthlyThreshold(
    totalPackages: number
): { remaining: number; nextAmount: number; nextMin: number } | null {
    const current = bracketFor(totalPackages, MONTHLY_BONUS_BRACKETS);
    if (!current) {
        const first = MONTHLY_BONUS_BRACKETS[0];
        if (totalPackages < first.min) {
            return { remaining: first.min - totalPackages, nextAmount: first.amount, nextMin: first.min };
        }
        return null;
    }
    const idx = MONTHLY_BONUS_BRACKETS.indexOf(current);
    const next = MONTHLY_BONUS_BRACKETS[idx + 1];
    if (!next) return null;
    return { remaining: next.min - totalPackages, nextAmount: next.amount, nextMin: next.min };
}

export type MonthSummary = {
    workDays: number;
    leaveDays: number;
    totalPackages: number;
    fixedPay: number;
    dailyPrimTotal: number;
    monthlyBonusAmount: number;
    grandTotal: number;
    nextDailyHint: { remaining: number; nextAmount: number; nextMin: number } | null;
    nextMonthly: { remaining: number; nextAmount: number; nextMin: number } | null;
    avgPackagesPerWorkDay: number;
};

export function summarizeMonth(entries: PackageDayEntry[]): MonthSummary {
    let workDays = 0;
    let leaveDays = 0;
    let totalPackages = 0;
    let dailyPrimTotal = 0;
    let lastWork: PackageDayEntry | null = null;

    for (const e of entries) {
        if (e.status === 'leave') {
            leaveDays += 1;
            continue;
        }
        if (e.status !== 'work') continue;
        workDays += 1;
        totalPackages += e.packages;
        dailyPrimTotal += dailyPrim(e.packages, e.tip);
        lastWork = e;
    }

    const fixedPay = workDays * DAILY_FIXED;
    const monthlyBonusAmount = monthlyBonus(totalPackages);
    const nextDailyHint = lastWork
        ? nextDailyThreshold(lastWork.packages, lastWork.tip)
        : null;

    return {
        workDays,
        leaveDays,
        totalPackages,
        fixedPay,
        dailyPrimTotal,
        monthlyBonusAmount,
        grandTotal: fixedPay + dailyPrimTotal + monthlyBonusAmount,
        nextDailyHint,
        nextMonthly: nextMonthlyThreshold(totalPackages),
        avgPackagesPerWorkDay: workDays > 0 ? totalPackages / workDays : 0
    };
}

/** Hedef senaryo: her iş günü aynı paket + tip ile */
export function projectScenario(
    workDayCount: number,
    packagesPerDay: number,
    tip: BonusTip
): { fixedPay: number; dailyPrimTotal: number; monthlyBonusAmount: number; grandTotal: number; totalPackages: number } {
    const fixedPay = workDayCount * DAILY_FIXED;
    const dayPrim = dailyPrim(packagesPerDay, tip);
    const dailyPrimTotal = dayPrim * workDayCount;
    const totalPackages = packagesPerDay * workDayCount;
    const monthlyBonusAmount = monthlyBonus(totalPackages);
    return {
        fixedPay,
        dailyPrimTotal,
        monthlyBonusAmount,
        grandTotal: fixedPay + dailyPrimTotal + monthlyBonusAmount,
        totalPackages
    };
}

/** Kalan iş günü: bugün ve sonrası, izin değil, henüz iş girilmemiş; Pazar boşsa varsayılan izin */
export function remainingWorkDaySlots(
    entries: PackageDayEntry[],
    today = new Date().toISOString().slice(0, 10)
): number {
    let n = 0;
    for (const e of entries) {
        if (e.date < today) continue;
        if (e.status === 'leave' || e.status === 'work') continue;
        const [y, m, d] = e.date.split('-').map(Number);
        if (new Date(y, m - 1, d).getDay() === 0) continue; // Pazar
        n += 1;
    }
    return n;
}

export type MonthlyTargetRow = {
    min: number;
    max: number | null;
    bonus: number;
    remaining: number;
    /** Kalan iş gününe bölünmüş, yukarı yuvarlanmış günlük hedef */
    perDay: number | null;
    reached: boolean;
};

/** Aylık bonus eşikleri + kalan güne göre günlük paket ihtiyacı */
export function monthlyTargetRows(
    totalPackages: number,
    remainingDays: number
): MonthlyTargetRow[] {
    return MONTHLY_BONUS_BRACKETS.map((b) => {
        const remaining = Math.max(0, b.min - totalPackages);
        const reached = totalPackages >= b.min;
        let perDay: number | null = null;
        if (!reached && remainingDays > 0) {
            perDay = Math.ceil(remaining / remainingDays);
        } else if (!reached && remainingDays <= 0) {
            perDay = null;
        } else {
            perDay = 0;
        }
        return {
            min: b.min,
            max: b.max,
            bonus: b.amount,
            remaining,
            perDay,
            reached
        };
    });
}

export type PaceProjection = {
    remainingDays: number;
    projectedTotal: number;
    projectedBonus: number;
    next: { remaining: number; nextAmount: number; nextMin: number } | null;
};

/** Mevcut ortalamayla ay sonu tahmini */
export function paceProjection(
    totalPackages: number,
    avgPerDay: number,
    remainingDays: number
): PaceProjection {
    const projectedTotal =
        remainingDays > 0 && avgPerDay > 0
            ? Math.round(totalPackages + avgPerDay * remainingDays)
            : totalPackages;
    return {
        remainingDays,
        projectedTotal,
        projectedBonus: monthlyBonus(projectedTotal),
        next: nextMonthlyThreshold(projectedTotal)
    };
}

export function emptyMonthEntries(year: number, monthIndex: number): PackageDayEntry[] {
    return daysInMonth(year, monthIndex).map((date) => ({
        date,
        status: 'empty',
        packages: 0,
        tip: null
    }));
}

export function canSetLeave(
    entries: PackageDayEntry[],
    dateStr: string
): boolean {
    const week = isoWeekKey(dateStr);
    const otherLeave = entries.some(
        (e) => e.date !== dateStr && e.status === 'leave' && isoWeekKey(e.date) === week
    );
    return !otherLeave;
}

export type PaketPrimDbRow = {
    work_date: string;
    status: 'work' | 'leave';
    packages: number;
    tip: BonusTip | null;
    note?: string;
};

/** DB satırlarını ay takvimine birleştir */
export function mergeMonthFromRows(
    year: number,
    monthIndex: number,
    rows: PaketPrimDbRow[]
): PackageDayEntry[] {
    const byDate = new Map(
        rows.map((r) => [
            r.work_date,
            {
                date: r.work_date,
                status: r.status as DayStatus,
                packages: Number(r.packages) || 0,
                tip: r.tip === 'hemen' || r.tip === 'sanal' ? r.tip : null
            } satisfies PackageDayEntry
        ])
    );
    return daysInMonth(year, monthIndex).map((date) => {
        const existing = byDate.get(date);
        if (!existing) return { date, status: 'empty' as const, packages: 0, tip: null };
        return existing;
    });
}

export function monthDateRange(year: number, monthIndex: number): { from: string; to: string } {
    const days = daysInMonth(year, monthIndex);
    return { from: days[0], to: days[days.length - 1] };
}

export function toDbPayload(entry: PackageDayEntry): PaketPrimDbRow | null {
    if (entry.status === 'empty') return null;
    if (entry.status === 'leave') {
        return { work_date: entry.date, status: 'leave', packages: 0, tip: null };
    }
    if (!entry.tip) return null;
    return {
        work_date: entry.date,
        status: 'work',
        packages: Math.max(0, Math.floor(entry.packages)),
        tip: entry.tip
    };
}

export const STORAGE_PREFIX = 'kaysia-paket-prim-v1:';

/** Yerel deneme verisini bir kez DB'ye aktarmak için */
export function readLocalMonthEntries(year: number, monthIndex: number): PackageDayEntry[] {
    if (typeof window === 'undefined') return emptyMonthEntries(year, monthIndex);
    const key = STORAGE_PREFIX + monthKey(year, monthIndex);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return emptyMonthEntries(year, monthIndex);
        const parsed = JSON.parse(raw) as PackageDayEntry[];
        return mergeMonthFromRows(
            year,
            monthIndex,
            parsed
                .filter((e) => e.status === 'work' || e.status === 'leave')
                .map((e) => ({
                    work_date: e.date,
                    status: e.status as 'work' | 'leave',
                    packages: Number(e.packages) || 0,
                    tip: e.tip === 'hemen' || e.tip === 'sanal' ? e.tip : null
                }))
        );
    } catch {
        return emptyMonthEntries(year, monthIndex);
    }
}
