/**
 * Asistan araçları — eski finans tool'ları kaldırıldı.
 * API şu an 503; ileride şirket / borç / kişisel finans tool'ları eklenecek.
 */

export const tools: unknown[] = [];

export async function executeTool(_name: string, _args: unknown): Promise<string> {
    return JSON.stringify({ error: 'Asistan araçları şu an kapalı.' });
}
