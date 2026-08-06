import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerAdminPassword } from '@/lib/admin-auth';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

const TABLES = [
    'contact_messages',
    'idea_notes',
    'company_finance_fuel_logs',
    'company_finance_tax_installment_rows',
    'company_finance_tax_installment_debts',
    'company_finance_paket_prim_days',
    'company_finance_paket_prim_closings',
    'company_finance_bagkur_months',
    'company_finance_bagkur_settings',
    'company_finance_monthly_expenses',
    'company_finance_monthly_entries',
    'company_finance_income_tax_brackets',
    'company_finance_kdv_presets',
    'company_finance_calc_lines',
    'ecosystem_items',
    'domains',
    'projects',
    'ai_subscriptions'
] as const;

export async function POST(request: Request) {
    const cookieStore = cookies();
    const auth = cookieStore.get('auth')?.value;
    if (auth !== 'true') {
        return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    let body: { password?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    }

    const password = typeof body.password === 'string' ? body.password : '';

    const expected = getServerAdminPassword();
    if (password !== expected) {
        return NextResponse.json({ error: 'Şifre hatalı.' }, { status: 403 });
    }

    const db = createSupabaseServiceClient();
    const cleared: string[] = [];
    const failures: { table: string; message: string }[] = [];

    for (const table of TABLES) {
        const { error } = await db.from(table).delete().not('id', 'is', null);
        if (error) {
            failures.push({ table, message: error.message });
        } else {
            cleared.push(table);
        }
    }

    if (failures.length > 0 && cleared.length === 0) {
        return NextResponse.json(
            {
                error: 'Hiçbir tablo temizlenemedi. Service role anahtarı veya tablo adlarını kontrol edin.',
                failures
            },
            { status: 500 }
        );
    }

    return NextResponse.json({
        ok: true,
        cleared,
        failures: failures.length > 0 ? failures : undefined,
        hint:
            failures.length > 0
                ? 'Bazı tablolar silinemedi (izin veya eksik tablo). .env içinde SUPABASE_SERVICE_ROLE_KEY tanımlamayı deneyin.'
                : undefined
    });
}
