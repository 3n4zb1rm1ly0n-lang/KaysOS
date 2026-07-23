import { NextResponse } from 'next/server';

/** AI assistant is temporarily disabled. */
export async function POST() {
    return NextResponse.json(
        { error: 'Asistan şu an pasif.' },
        { status: 503 }
    );
}

export async function GET() {
    return NextResponse.json(
        { error: 'Asistan şu an pasif.' },
        { status: 503 }
    );
}
