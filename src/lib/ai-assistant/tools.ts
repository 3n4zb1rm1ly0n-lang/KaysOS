import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_READ_TABLE_NAMES, AI_READ_TABLES, MAX_QUERY_ROWS } from '@/lib/ai-assistant/tables';

const COL = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function safeCol(name: unknown): string | null {
    if (typeof name !== 'string' || !COL.test(name) || name.length > 64) return null;
    return name;
}

export const ASSISTANT_TOOLS = [
    {
        type: 'function' as const,
        function: {
            name: 'list_tables',
            description: 'Okunabilir KaysOS tablolarının adını ve kısa açıklamasını döndürür.',
            parameters: { type: 'object', properties: {}, additionalProperties: false }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'query_table',
            description:
                'Bir tablodan satır okur (yalnızca SELECT). Filtreler AND bağlanır. Büyük tablolarda tarih veya status filtresi kullan.',
            parameters: {
                type: 'object',
                properties: {
                    table: {
                        type: 'string',
                        description: 'Allowlist tablo adı'
                    },
                    columns: {
                        type: 'string',
                        description: 'Virgüllü kolon listesi veya * (varsayılan *)'
                    },
                    filters: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                column: { type: 'string' },
                                op: {
                                    type: 'string',
                                    enum: ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'ilike']
                                },
                                value: { type: 'string' }
                            },
                            required: ['column', 'op', 'value']
                        }
                    },
                    order_column: { type: 'string' },
                    order_asc: { type: 'boolean' },
                    limit: { type: 'integer', minimum: 1, maximum: MAX_QUERY_ROWS }
                },
                required: ['table']
            }
        }
    }
];

type Filter = { column?: string; op?: string; value?: string };

export async function runAssistantTool(
    db: SupabaseClient,
    name: string,
    rawArgs: string
): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
        args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
    } catch {
        return JSON.stringify({ error: 'Geçersiz JSON argüman' });
    }

    if (name === 'list_tables') {
        return JSON.stringify({ tables: AI_READ_TABLES });
    }

    if (name !== 'query_table') {
        return JSON.stringify({ error: `Bilinmeyen araç: ${name}` });
    }

    const table = typeof args.table === 'string' ? args.table : '';
    if (!AI_READ_TABLE_NAMES.has(table)) {
        return JSON.stringify({ error: 'Bu tabloya erişim yok', table });
    }

    const colArg = typeof args.columns === 'string' ? args.columns.trim() : '*';
    let select = '*';
    if (colArg && colArg !== '*') {
        const parts = colArg.split(',').map((c) => c.trim());
        if (parts.some((c) => !safeCol(c))) {
            return JSON.stringify({ error: 'Geçersiz kolon adı' });
        }
        select = parts.join(',');
    }

    const limitRaw = Number(args.limit);
    const limit = Number.isFinite(limitRaw)
        ? Math.min(MAX_QUERY_ROWS, Math.max(1, Math.floor(limitRaw)))
        : 40;

    // Tablo adı runtime allowlist; supabase-js generic zinciri kullanılmaz
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from(table).select(select).limit(limit);

    const filters = Array.isArray(args.filters) ? (args.filters as Filter[]).slice(0, 6) : [];
    for (const f of filters) {
        const col = safeCol(f.column);
        if (!col || typeof f.value !== 'string') continue;
        const op = f.op || 'eq';
        if (op === 'eq') q = q.eq(col, f.value);
        else if (op === 'neq') q = q.neq(col, f.value);
        else if (op === 'gte') q = q.gte(col, f.value);
        else if (op === 'lte') q = q.lte(col, f.value);
        else if (op === 'gt') q = q.gt(col, f.value);
        else if (op === 'lt') q = q.lt(col, f.value);
        else if (op === 'ilike') q = q.ilike(col, f.value);
    }

    const orderCol = safeCol(args.order_column);
    if (orderCol) {
        q = q.order(orderCol, { ascending: args.order_asc !== false });
    }

    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message, table });
    return JSON.stringify({ table, count: data?.length ?? 0, rows: data });
}
