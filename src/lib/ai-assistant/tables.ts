/** @deprecated Import from `@/lib/ai-assistant/schema` — geriye uyum. */
export {
    AI_READ_TABLES,
    AI_READ_TABLE_NAMES,
    MAX_QUERY_ROWS,
    AI_SCHEMA,
    schemaForTable,
    staticDescribe,
    listSchemaCatalog
} from '@/lib/ai-assistant/schema';
export type { TableSchema, SchemaColumn } from '@/lib/ai-assistant/schema';

export type TableInfo = {
    name: string;
    label: string;
    hint: string;
    page?: string;
};
