export type CalcOp = 'percent' | 'add' | 'subtract' | 'multiply' | 'divide';

export type OperandKind = 'number' | 'gross' | 'line';

export type CalcStep = {
    op: CalcOp;
    value: number;
    operand_kind: OperandKind;
    operand_line_id: string | null;
};

export type CalcSourceType = 'gross' | 'line';

/** Net / özet üzerinde kalemin etkisi */
export type ResultEffect = 'deduction' | 'addition' | 'exclude';

export type StepResolveCtx = {
    gross: number;
    amounts: Map<string, number>;
};

export const CALC_OP_LABELS: Record<CalcOp, string> = {
    percent: 'Yüzde',
    add: 'Artı',
    subtract: 'Eksi',
    multiply: 'Çarpma',
    divide: 'Bölme'
};

export const CALC_OPS: CalcOp[] = ['percent', 'add', 'subtract', 'multiply', 'divide'];

export const RESULT_EFFECT_LABELS: Record<ResultEffect, string> = {
    deduction: 'Kesinti (netten düş)',
    addition: 'Ek (nete ekle)',
    exclude: 'Sonuca dahil etme'
};

export function parseResultEffect(
    raw: unknown,
    isDeductionFallback?: boolean
): ResultEffect {
    if (raw === 'deduction' || raw === 'addition' || raw === 'exclude') return raw;
    if (isDeductionFallback === false) return 'addition';
    return 'deduction';
}

export function parseCalcSteps(raw: unknown): CalcStep[] {
    if (!Array.isArray(raw)) return [];
    const out: CalcStep[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const op = (item as { op?: unknown }).op;
        const value = Number((item as { value?: unknown }).value);
        const kindRaw = (item as { operand_kind?: unknown }).operand_kind;
        const operand_kind: OperandKind =
            kindRaw === 'gross' || kindRaw === 'line' || kindRaw === 'number'
                ? kindRaw
                : 'number';
        const lineRaw = (item as { operand_line_id?: unknown }).operand_line_id;
        if (
            op === 'percent' ||
            op === 'add' ||
            op === 'subtract' ||
            op === 'multiply' ||
            op === 'divide'
        ) {
            out.push({
                op,
                value: Number.isFinite(value) ? value : 0,
                operand_kind,
                operand_line_id:
                    operand_kind === 'line' && lineRaw ? String(lineRaw) : null
            });
        }
    }
    return out;
}

export function stepsFromPercentage(percentage: number): CalcStep[] {
    const p = Number.isFinite(percentage) ? percentage : 0;
    return [{ op: 'percent', value: p, operand_kind: 'number', operand_line_id: null }];
}

export function resolveStepOperand(step: CalcStep, ctx: StepResolveCtx): number {
    if (step.operand_kind === 'gross') return ctx.gross;
    if (step.operand_kind === 'line' && step.operand_line_id) {
        return ctx.amounts.get(step.operand_line_id) ?? 0;
    }
    return Number.isFinite(step.value) ? step.value : 0;
}

export function applySteps(
    base: number,
    steps: CalcStep[],
    ctx: StepResolveCtx = { gross: 0, amounts: new Map() }
): number {
    let acc = Number.isFinite(base) ? base : 0;
    for (const step of steps) {
        const v = resolveStepOperand(step, ctx);
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

function compactNum(n: number): string {
    return String(Math.round(n * 1000) / 1000);
}

export function describeStep(step: CalcStep, ctx?: StepResolveCtx): string {
    const v = ctx ? resolveStepOperand(step, ctx) : step.value;
    switch (step.op) {
        case 'percent':
            return `%${compactNum(v)}`;
        case 'add':
            return `+${compactNum(v)}`;
        case 'subtract':
            return `−${compactNum(v)}`;
        case 'multiply':
            return `×${compactNum(v)}`;
        case 'divide':
            return `÷${compactNum(v)}`;
        default:
            return compactNum(v);
    }
}

/** Kısa özet notu: 1000 % 10 - 5 (operand kaynakları çözülmüş sayı) */
export function formatCompactMathNote(
    base: number,
    steps: CalcStep[],
    ctx: StepResolveCtx = { gross: 0, amounts: new Map() }
): string {
    const baseStr = Number.isFinite(base) ? compactNum(base) : '0';
    if (steps.length === 0) return baseStr;

    const parts = steps.map((step) => {
        const v = resolveStepOperand(step, ctx);
        switch (step.op) {
            case 'percent':
                return `% ${compactNum(v)}`;
            case 'add':
                return `+ ${compactNum(v)}`;
            case 'subtract':
                return `- ${compactNum(v)}`;
            case 'multiply':
                return `× ${compactNum(v)}`;
            case 'divide':
                return `÷ ${compactNum(v)}`;
            default:
                return compactNum(v);
        }
    });

    return `${baseStr} ${parts.join(' ')}`;
}

export function resolveLineAmounts(
    lines: {
        id: string;
        sort_order: number;
        source_type: CalcSourceType;
        source_line_id: string | null;
        steps: CalcStep[];
        result_effect: ResultEffect;
    }[],
    gross: number
): Map<string, number> {
    const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
    const amounts = new Map<string, number>();
    const ctx: StepResolveCtx = { gross, amounts };

    for (const line of sorted) {
        let base = gross;
        if (line.source_type === 'line' && line.source_line_id) {
            base = amounts.get(line.source_line_id) ?? 0;
        }
        amounts.set(line.id, applySteps(base, line.steps, ctx));
    }

    return amounts;
}
