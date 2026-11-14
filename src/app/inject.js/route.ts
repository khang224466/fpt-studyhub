import { NextRequest, NextResponse } from 'next/server';
import { EDUNEXT_SOURCE } from '@/lib/edunextBundle';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const licenseKey = searchParams.get('key') || '';
  
  const scriptContent = ';(' + EDUNEXT_SOURCE + ')(' + JSON.stringify(licenseKey) + ');';

  return new NextResponse(scriptContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
