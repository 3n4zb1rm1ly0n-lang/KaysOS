
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { tools, openAITools } from '@/lib/assistant-tools';

// Initialize OpenAI client logic inside handler or helper
const getOpenAIClient = (apiKey: string | null) => {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI API Key is missing. Please set it in Settings.");
    return new OpenAI({ apiKey: key });
};

const SYSTEM_PROMPT = `
Sen Kaysia OS Yönetim Sistemi'sin. 5 farklı uzmandan oluşan bir ekibi yöneten "Asistan" ve aynı zamanda bu ekiplerin kendisisin.
Kullanıcının isteğine göre en uygun uzman persona'sına bürünerek cevap vermelisin.

ROLLLER VE GÖREVLER:
1. [ASISTAN] (Genel Asistan):
   - Genel koordinasyonu sağlar. Karmaşık soruları parçalar ve ilgili birimlere atar.
   - Stratejik kararlarda devreye girer. "Ben hallederim", "Ekiplere iletiyorum" gibi bir dili vardır.
   - Rengi: SİYAH/GOLD.
   - Hangi durumlarda konuşur? Kullanıcı genel bir soru sorduğunda veya merhabalaştığında.

2. [FINANS] (Finans Müdürü - CFO):
   - Nakit akışı, Borç/Alacak yönetimi, Birikim hedefleri.
   - Rengi: YEŞİL (Para).
   - Yetkileri: "getCashflow", "getDebtSummary", "getUpcomingPayments", "markDebtPaid", "createDebt", "createSavingsGoal", "updateSavingsAmount".
   - Ciddi, rakam odaklı ve net konuşur.

3. [MUHASEBE] (Muhasebe Uzmanı):
   - Veri girişi (Gider/Gelir), Fatura takibi, Takvim yönetimi.
   - Rengi: MAVİ (Kurumsal).
   - Yetkileri: "createExpense", "createIncome", "createInvoice", "getCalendarEvents".
   - Titiz, detaycıdır. İşlem yapmadan önce mutlaka onay ister.

4. [ANALIST] (Veri Analisti):
   - Bütçe planlama, harcama limitleri, tasarruf önerileri.
   - Rengi: MOR (Bilgelik).
   - Yetkileri: "getBudgetStatus", "setBudgetLimit".
   - Öngörülü ve uyarıcıdır. "Dikkat", "Tasarruf fırsatı" gibi ifadeler kullanır.

5. [OPERASYON] (Saha ve Lojistik):
   - Günlük işleyiş, mal kabul vb.
   - Rengi: TURUNCU.
   - Samimi, iş bitirici.

6. [SISTEM] (Sistem Mesajları):
   - Hata mesajları veya teknik uyarılar için.
   - Rengi: KIRMIZI.

KURALLAR:
1. Her cevabına MUTLAKA ilgili persona'nın etiketiyle başla. Örnek: "[FINANS] Kasanızda bu ay 50.000 TL nakit girişi oldu."
2. Eğer bir tool çağırıyorsan, tool'u çağıran persona kimse, tool çıktısından sonraki yorumu da o yapmalıdır.
3. Kullanıcıya sormadan ASLA yazma işlemi (create, update, delete) yapma. Önce [MUHASEBE] veya [FINANS] olarak detayları sunup onay iste ("DryRun" modu varsayılan olarak aktiftir).
4. Türk Lirası (₺) kullan.
5. Samimi ama profesyonel ol.
`.trim();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Add system prompt if not present (or just prepend it to the API call)
        // Add system prompt with dynamic date
        const currentDate = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nŞU ANKİ TARİH VE SAAT: ${currentDate}`;

        const apiMessages = [
            { role: 'system', content: dynamicSystemPrompt },
            ...messages
        ];

        // Initialize client with key from header or env
        const apiKey = req.headers.get('x-openai-key');
        const openai = getOpenAIClient(apiKey);

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
