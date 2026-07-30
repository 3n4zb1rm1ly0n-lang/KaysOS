export type CalcOp = 'percent' | 'add' | 'subtract' | 'multiply' | 'divide';

export type CalcStep = {
    op: CalcOp;
    value: number;
};

export type CalcSourceType = 'gross' | 'line';

export const CALC_OP_LABELS: Record<CalcOp, string> = {
    percent: 'Yüzde',
    add: 'Artı',
    subtract: 'Eksi',
    multiply: 'Çarpma',
    divide: 'Bölme'
};

export const CALC_OPS: CalcOp[] = ['percent', 'add', 'subtract', 'multiply', 'divide'];

export function parseCalcSteps(raw: unknown): CalcStep[] {
    if (!Array.isArray(raw)) return [];
    const out: CalcStep[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const op = (item as { op?: unknown }).op;
        const value = Number((item as { value?: unknown }).value);
        if (
            op === 'percent' ||
            op === 'add' ||
            op === 'subtract' ||
            op === 'multiply' ||
            op === 'divide'
        ) {
            out.push({
                op,
                value: Number.isFinite(value) ? value : 0
            });
        }
    }
    return out;
}

/** Eski percentage kolonundan tek adımlık zincir */
export function stepsFromPercentage(percentage: number): CalcStep[] {
    const p = Number.isFinite(percentage) ? percentage : 0;
    return [{ op: 'percent', value: p }];
}

export function applySteps(base: number, steps: CalcStep[]): number {
    let acc = Number.isFinite(base) ? base : 0;
    for (const step of steps) {
        const v = Number.isFinite(step.value) ? step.value : 0;
        switch (step.op) {
            case 'percent':
                acc = (acc * v) / 100;
                break;
            case 'add':
                acc = acc + v;
                break;
            case 'subtract':
                acc = acc - v;
                break;
            case 'multiply':
                acc = acc * v;
                break;
            case 'divide':
                acc = v === 0 ? 0 : acc / v;
                break;
            default:
                break;
        }
    }
    return acc;
}

export function describeStep(step: CalcStep): string {
    const v = Number.isFinite(step.value) ? step.value : 0;
    switch (step.op) {
        case 'percent':
            return `%${v}`;
        case 'add':
            return `+${v}`;
        case 'subtract':
            return `−${v}`;
        case 'multiply':
            return `×${v}`;
        case 'divide':
            return `÷${v}`;
        default:
            return String(v);
    }
}

/** sort_order sırasıyla çöz; kaynak yalnızca brüt veya önceki satır olabilir */
export function resolveLineAmounts(
    lines: {
        id: string;
        sort_order: number;
        source_type: CalcSourceType;
        source_line_id: string | null;
        steps: CalcStep[];
        is_deduction: boolean;
    }[],
    gross: number
): Map<string, number> {
    const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
    const amounts = new Map<string, number>();

    for (const line of sorted) {
        let base = gross;
        if (line.source_type === 'line' && line.source_line_id) {
            base = amounts.has(line.source_line_id)
                ? (amounts.get(line.source_line_id) as number)
                : 0;
        }
        amounts.set(line.id, applySteps(base, line.steps));
    }

    return amounts;
}
