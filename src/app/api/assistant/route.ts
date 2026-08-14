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
        'Veriler Supabase’te. Tahmin etme: list_tables / query_table ile oku, sonra yorumla.',
        'Para tutarlarını TL olarak yaz. Eksik tablo veya boş sonuçta bunu söyle.',
        'Yazma, silme, şema değiştirme yok. SQL uydurma; yalnızca verilen araçları kullan.',
        'Paket prim: sabit ücret ayın takvim gününe yayılır (55.223 TL / ay günü), prim iş gününe göre.',
        'Kısa özet + gerekirse madde madde. Uydurma satır ekleme.'
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
            { error: 'OPENAI_API_KEY tanımlı değil. .env dosyasına ekleyip dev sunucusunu yeniden başlat.' },
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
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
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
    return NextResponse.json({
        ok: ready,
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
    });
}
