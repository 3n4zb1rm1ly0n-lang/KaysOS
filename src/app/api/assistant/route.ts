
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { tools, openAITools } from '@/lib/assistant-tools';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
Sen Kaysia Finans Asistanısın, kullanıcının Supabase üzerindeki finansal verilerini yöneten yardımsever bir yapay zekasın.
Borçlar, nakit akışı ve ödemeler gibi verileri okuyabilir ve yazma işlemleri (ödeme işaretleme, gider ekleme vb.) yapabilirsin.
AYRICA BÜTÇE YÖNETİMİ de yaparsın. Kullanıcının harcama kategorilerine limit koymasına yardımcı ol.

KURALLAR (ÇOK ÖNEMLİ):
1. GÜVENLİK ÖNCELİKLİ: Kullanıcıya sormadan ASLA yazma işlemi (create, update, delete) yapma.
2. DRY RUN (Deneme): Kullanıcı bir işlem istediğinde (örn. "borcu öde"), MUTLAKA önce tool'u \`dryRun: true\` ile çalıştır.
3. ÖNERİ SUN: Tool'dan dönen "proposed" (önerilen) sonucunu kullanıcıya net bir şekilde sun ve onay iste.
4. UYGULA: Kullanıcı "Onaylıyorum", "Evet", "Yap" dediğinde, tool'u \`dryRun: false\` ile tekrar çağır.
5. DİL: Her zaman TÜRKÇE konuş. Samimi ama profesyonel ol.
6. ANALİZ: Kullanıcı bütçe sorduğunda, sadece rakam verme; yorum yap (örn. "Kira bütçenizi %80 doldurdunuz, dikkatli olun").

Audit logları (denetim kayıtları) otomatik tutulur.
Finansal özetleri güzel formatla (liste veya tablo).
`.trim();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Add system prompt if not present (or just prepend it to the API call)
        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        // First call to OpenAI
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // or gpt-3.5-turbo if cost is an issue, but gpt-4o is better for tool calling
            messages: apiMessages,
            tools: openAITools as any,
            tool_choice: 'auto',
        });

        const choice = response.choices[0];
        const message = choice.message;

        // If there are tool calls, execute them
        if (message.tool_calls) {
            // Append the assistant's message with tool calls to history
            apiMessages.push(message);

            for (const toolCall of message.tool_calls) {
                const forbiddenTools = []; // Add any if needed
                // @ts-ignore
                const fnName = toolCall.function.name;
                // @ts-ignore
                const args = JSON.parse(toolCall.function.arguments);

                console.log(`Executing tool: ${fnName} with args:`, args);

                let result;
                try {
                    // @ts-ignore - dynamic access
                    const toolFn = tools[fnName];
                    if (toolFn) {
                        result = await toolFn(args);
                    } else {
                        result = { error: `Tool ${fnName} not found` };
                    }
                } catch (error: any) {
                    console.error(`Error executing ${fnName}:`, error);
                    result = { error: error.message };
                }

                // Append tool result
                apiMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                });
            }

            // Second call to OpenAI to generate the final response after tool outputs
            const finalResponse = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: apiMessages,
            });

            return NextResponse.json(finalResponse.choices[0].message);
        }

        // If no tool usage, just return the message
        return NextResponse.json(message);

    } catch (error: any) {
        console.error('AI Assistant Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
