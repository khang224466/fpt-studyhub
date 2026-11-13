import { NextResponse } from 'next/server';
export function POST() { return NextResponse.json({ success: false, message: 'Client API-key encryption is retired. Configure GEMINI_API_KEY on the server.' }, { status: 410 }); }
