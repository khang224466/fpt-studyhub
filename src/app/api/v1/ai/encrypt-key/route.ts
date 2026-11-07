import { NextRequest, NextResponse } from 'next/server';
import { encryptApiKeyAes, encryptApiKeyPortable, decryptApiKey } from '@/lib/cryptoKey';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json({
        success: false,
        message: 'Thiếu API key cần mã hóa.'
      }, { status: 400 });
    }

    const encryptedAes = encryptApiKeyAes(key.trim());
    const encryptedPortable = encryptApiKeyPortable(key.trim());
    const verifiedDecrypted = decryptApiKey(encryptedAes);

    return NextResponse.json({
      success: true,
      originalLength: key.length,
      encryptedAes,
      encryptedPortable,
      decryptionVerified: verifiedDecrypted === key.trim()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: 'Lỗi mã hóa: ' + err.message
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
