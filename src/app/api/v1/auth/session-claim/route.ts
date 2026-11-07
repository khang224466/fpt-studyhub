import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG } from '@/data/servicesCatalog';
import { verifyLicense } from '@/lib/licenseStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseKey, domain } = body;

    if (!licenseKey) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu mã License Key xác thực.'
      }, { status: 400 });
    }

    const check = verifyLicense(licenseKey);
    if (!check.valid) {
      return NextResponse.json({
        success: false,
        message: check.reason || 'Mã License không tồn tại hoặc đã hết hạn.',
        reason: 'INVALID_OR_EXPIRED_LICENSE'
      }, { status: 403 });
    }

    const record = check.record!;
    const service = SERVICES_CATALOG.find(s => s.id === record.serviceId) || SERVICES_CATALOG[0];

    // Domain validation (warn if executed on different site, unless localhost/testing)
    const isDomainMatch = domain && (
      domain.includes(service.targetDomain) || 
      domain.includes('localhost') || 
      domain.includes('127.0.0.1') ||
      domain.includes('fpt.edu.vn')
    );
    if (!isDomainMatch) {
      return NextResponse.json({
        success: false,
        message: `Bạn đang ở trang "${domain}". Vui lòng truy cập đúng trang web "${service.targetDomain}" trước khi bấm Bookmarklet!`,
        reason: 'DOMAIN_MISMATCH'
      }, { status: 400 });
    }

    const remainingTime = check.formattedRemaining;

    // Construct session payload according to service type
    const localStoragePayload: Record<string, any> = {
      'fpt_studyhub_verified_license': licenseKey,
      'fpt_studyhub_expires_at': record.expiresAt,
      'fpt_studyhub_active_service': service.name,
      'fpt_studyhub_is_trial': record.isTrial
    };

    if (service.id === 'edunext-assistant') {
      localStoragePayload['edunext_assistant_tier'] = record.isTrial ? 'trial_2h' : 'vip_pro';
      localStoragePayload['edunext_version'] = '10.1.0';
      localStoragePayload['edunext_auto_intent'] = 'true';
      localStoragePayload['edunext_auto_vision'] = 'true';
      localStoragePayload['edunext_cloud_proxy'] = 'true';
    } else if (service.id === 'khaothi-online') {
      localStoragePayload['khaothi_vip_access'] = 'true';
      localStoragePayload['khaothi_exam_bank_unlocked'] = 'true';
    } else if (service.id === 'seb-toolkit') {
      localStoragePayload['seb_config_status'] = 'optimized_fpt_certified';
    }

    return NextResponse.json({
      success: true,
      serviceName: service.name,
      targetDomain: service.targetDomain,
      remainingTime,
      expiresAt: record.expiresAt,
      isTrial: record.isTrial,
      localStoragePayload,
      sessionStoragePayload: {
        'fpt_studyhub_session_id': 'sess_' + Math.random().toString(36).substring(2, 10)
      },
      cookiesPayload: [
        `fpt_studyhub_auth=token_${Date.now()}; path=/; max-age=2592000; SameSite=Lax`
      ]
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Lỗi xử lý xác thực: ' + error.message
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
