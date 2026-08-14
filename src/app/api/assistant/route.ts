import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase-server';
import { ASSISTANT_TOOLS, runAssistantTool } from '@/lib/ai-assistant/tools';
import { DEFAULT_OPENAI_MODEL, estimateCostUsd } from '@/lib/ai-assistant/pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_HISTORY = 24;
const MAX_TOOL_ROUNDS = 8;

type ClientMessage = { role?: string; content?: string };

function systemPrompt(): string {
    const today = new Date().toLocaleDateString('tr-TR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    return [
        'KaysOS / Kaysia App yönetim asistanısın. Türkçe, net ve sayıya dayalı konuş.',
        `Bugünün tarihi: ${today}.`,
        'Veriler Supabase’te. Kolon/formül uydurma.',
        'Şirket aylık (ciro, net, KDV, matrah, nakit): MUTLAKA get_company_monthly_summary. gross_amount KDV DAHİL; net=gross/1.20; tevfikat=satışKDV×0.20; cashNet=net−tevfikat−nakit gider netleri.',
        'Kişisel gelir/gider/borç: get_personal_finance_summary. net_nakit=brüt−bloke/haciz (withheld). Bütçe/birikim ve yüzde önerisi: MUTLAKA get_budget_savings_summary. Borçlar ay bağımsız. company_cash=şirket cashNet kopyası.',
        'Paket prim: get_paket_prim_summary. Projeler: get_projects_summary.',
        'Bilinmeyen tablo/kolon: list_schema veya describe_table.',
        'Bağkur ve vergi taksit aylık kazanca otomatik yazılmaz — ayrı tablolar.',
        'Hesaplama (calc_lines) ≠ aylık kazanç (brüt maaş formülü).',
        'Boş ay = 0. Yazma/silme yok (bütçe gönderimi kullanıcı panelinde). TL yaz; kısa özet.',
        'Bütçe önerirken net tabanı, açık borç baskısını ve suggestion.lines yüzdelerini ver; panel yolu /app/dashboard/personal-finance/budget.'
    ].join('\n');
}

async function requireUser() {
    const auth = createSupabaseServerClient();
    const { data } = await auth.auth.getUser();
    return data.user;
}

async function logUsage(row: {
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    tool_rounds: number;
    ok: boolean;
    error?: string | null;
}) {
    try {
        const db = createSupabaseServiceClient();
        await db.from('ai_usage_logs').insert(row);
    } catch {
        // tablo yoksa sohbeti düşürme
    }
}

export async function POST(request: Request) {
    const user = await requireUser();
    if (!user) {
        return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json(
            {
                error:
                    'OPENAI_API_KEY sunucuda yok. Canlıda: Vercel → Settings → Environment Variables. Yerelde: .env + npm run dev yeniden başlat.'
            },
            { status: 503 }
        );
    }

    let body: { messages?: ClientMessage[] };
    try {
        body = (await request.json()) as { messages?: ClientMessage[] };
    } catch {
        return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
    }

    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const history: ChatCompletionMessageParam[] = incoming
        .filter(
            (m) =>
                m &&
                (m.role === 'user' || m.role === 'assistant') &&
                typeof m.content === 'string'
        )
        .slice(-MAX_HISTORY)
        .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: String(m.content).slice(0, 8000)
        }));

    if (history.length === 0 || history[history.length - 1]?.role !== 'user') {
        return NextResponse.json({ error: 'Kullanıcı mesajı gerekli.' }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    const client = new OpenAI({ apiKey });
    const db = createSupabaseServiceClient();

    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt() },
        ...history
    ];

    let promptTokens = 0;
    let completionTokens = 0;
    let toolRounds = 0;
    let content = '';

    try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const completion = await client.chat.completions.create({
                model,
                temperature: 0.3,
                messages,
                tools: ASSISTANT_TOOLS,
                tool_choice: 'auto'
            });

            const usage = completion.usage;
            promptTokens += usage?.prompt_tokens ?? 0;
            completionTokens += usage?.completion_tokens ?? 0;

            const choice = completion.choices[0];
            const msg = choice?.message;
            if (!msg) break;

            const calls = msg.tool_calls;
            if (calls && calls.length > 0) {
                toolRounds += 1;
                messages.push({
                    role: 'assistant',
                    content: msg.content ?? null,
                    tool_calls: calls
                });
                for (const call of calls) {
                    const fn = call.type === 'function' ? call.function : null;
                    const result = fn
                        ? await runAssistantTool(db, fn.name, fn.arguments || '{}')
                        : JSON.stringify({ error: 'Desteklenmeyen araç' });
                    messages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: result.slice(0, 24_000)
                    });
                }
                continue;
            }

            content = (msg.content || '').trim();
            break;
        }

        if (!content) {
            content = 'Veriyi çektim ama özet üretemedim. Soruyu biraz daraltıp tekrar dene.';
        }

        const total = promptTokens + completionTokens;
        const cost_usd = estimateCostUsd(model, promptTokens, completionTokens);
        await logUsage({
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: total,
            cost_usd,
            tool_rounds: toolRounds,
            ok: true,
            error: null
        });

        return NextResponse.json({
            content,
            usage: {
                model,
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: total,
                cost_usd,
                tool_rounds: toolRounds
            }
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'OpenAI hatası';
        const total = promptTokens + completionTokens;
        await logUsage({
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: total,
            cost_usd: estimateCostUsd(model, promptTokens, completionTokens),
            tool_rounds: toolRounds,
            ok: false,
            error: message.slice(0, 500)
        });
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

export async function GET() {
    const user = await requireUser();
    if (!user) {
        return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }
    const ready = Boolean(process.env.OPENAI_API_KEY?.trim());
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

    let paketPrimOk: boolean | null = null;
    let paketPrimError: string | null = null;
    try {
        const db = createSupabaseServiceClient();
        const { error } = await db
            .from('company_finance_paket_prim_days')
            .select('work_date', { count: 'exact', head: true });
        if (error) {
            paketPrimOk = false;
            paketPrimError = error.message;
        } else {
            paketPrimOk = true;
        }
    } catch (e) {
        paketPrimOk = false;
        paketPrimError = e instanceof Error ? e.message : 'supabase hata';
    }

    return NextResponse.json({
        ok: ready,
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
        supabase: {
            has_service_role: hasServiceRole,
            paket_prim_days: paketPrimOk,
            paket_prim_error: paketPrimError
        }
    });
}
