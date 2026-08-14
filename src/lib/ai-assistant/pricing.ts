/** USD / 1M token — OpenAI liste fiyatı. */

type Band = { input: number; output: number };

const BANDS: { match: RegExp; band: Band }[] = [
    { match: /gpt-4o-mini/i, band: { input: 0.15, output: 0.6 } },
    { match: /gpt-4o/i, band: { input: 2.5, output: 10 } },
    { match: /gpt-4\.1-mini/i, band: { input: 0.4, output: 1.6 } },
    { match: /gpt-4\.1/i, band: { input: 2, output: 8 } }
];

const FALLBACK: Band = { input: 0.15, output: 0.6 };

export function priceBandForModel(model: string): Band {
    for (const row of BANDS) {
        if (row.match.test(model)) return row.band;
    }
    return FALLBACK;
}

export function estimateCostUsd(
    model: string,
    promptTokens: number,
    completionTokens: number
): number {
    const band = priceBandForModel(model);
    const usd =
        (promptTokens / 1_000_000) * band.input + (completionTokens / 1_000_000) * band.output;
    return Math.round(usd * 1_000_000) / 1_000_000;
}

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

/** Panel AI kullanım bütçe çubuğu (USD). OpenAI soft/hard limit ile hizala. */
export const AI_MONTHLY_BUDGET_USD = 10;
