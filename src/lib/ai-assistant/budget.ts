import { AI_MONTHLY_BUDGET_USD } from '@/lib/ai-assistant/pricing';

export type AiBudgetSettings = {
    id: string;
    limit_usd: number;
    period_started_at: string;
    updated_at?: string;
};

export const DEFAULT_AI_BUDGET: AiBudgetSettings = {
    id: 'main',
    limit_usd: AI_MONTHLY_BUDGET_USD,
    period_started_at: new Date(0).toISOString()
};

export function normalizeBudgetRow(row: Partial<AiBudgetSettings> | null): AiBudgetSettings {
    const limit = Number(row?.limit_usd);
    return {
        id: 'main',
        limit_usd:
            Number.isFinite(limit) && limit > 0 ? Math.round(limit * 100) / 100 : AI_MONTHLY_BUDGET_USD,
        period_started_at:
            typeof row?.period_started_at === 'string' && row.period_started_at
                ? row.period_started_at
                : DEFAULT_AI_BUDGET.period_started_at,
        updated_at: typeof row?.updated_at === 'string' ? row.updated_at : undefined
    };
}
