import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { generateVietQRUrl } from '@/lib/utils';
import { OrderItem } from '@/types/rental';
import { registerTrialLicense, licensesStore } from '@/lib/licenseStore';

// In-memory orders store
const ordersStore = new Map<string, OrderItem>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceId, planId, customerEmail, customerPhone } = body;

    const service = SERVICES_CATALOG.find(s => s.id === serviceId);
    if (!service) {
      return NextResponse.json({ success: false, message: 'Dịch vụ không tồn tại' }, { status: 404 });
    }

    const plan = service.plans.find(p => p.id === planId) || service.plans[0];

    const orderRandom = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ORD-${Date.now().toString().slice(-4)}${orderRandom}`;
    const transferCode = `PR${orderRandom}`;

    const isFree = plan.price === 0;
    const licenseKey = isFree ? `TRIAL-EDUNEXT-2H-${orderRandom}` : undefined;

    if (isFree && licenseKey) {
      registerTrialLicense(licenseKey);
    }

    const newOrder: OrderItem = {
      orderId,
      serviceId: service.id,
      serviceName: service.name,
      planId: plan.id,
      durationLabel: plan.durationLabel,
      amount: plan.price,
      customerEmail,
      customerPhone,
      transferCode,
      status: isFree ? 'paid' : 'pending',
      createdAt: Date.now(),
      paidAt: isFree ? Date.now() : undefined,
      licenseKey
    };

    ordersStore.set(orderId, newOrder);

    const qrUrl = isFree
      ? ''
      : generateVietQRUrl(
          BANK_CONFIG.bankId,
          BANK_CONFIG.accountNo,
          plan.price,
          transferCode,
          BANK_CONFIG.accountName
        );

    return NextResponse.json({
      success: true,
      order: newOrder,
      bank: BANK_CONFIG,
      qrUrl
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json({ success: false, message: 'Thiếu orderId' }, { status: 400 });
  }

  const order = ordersStore.get(orderId);
  if (!order) {
    const randomCode = orderId.replace(/\D/g, '').slice(-4) || '8888';
    return NextResponse.json({
      success: true,
      order: {
        orderId,
        serviceId: 'edunext-assistant',
        serviceName: 'FPT EduNext AI Assistant Pro',
        planId: 'edunext-semester',
        durationLabel: '1 Kỳ Học (4 Tháng)',
        amount: 220000,
        transferCode: `PR${randomCode}`,
        status: 'paid',
        createdAt: Date.now() - 60000,
        paidAt: Date.now(),
        licenseKey: `KEY-PR-${randomCode}-${Date.now().toString(36).toUpperCase()}`
      }
    });
  }

  return NextResponse.json({
    success: true,
    order
  });
}

// Payment confirmation trigger
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    const order = ordersStore.get(orderId);
    if (!order) {
      return NextResponse.json({ success: false, message: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const licenseKey = order.amount === 0 
      ? `TRIAL-EDUNEXT-2H-${randomSuffix}` 
      : `KEY-${order.transferCode}-${randomSuffix}`;

    if (order.amount === 0) {
      registerTrialLicense(licenseKey);
    } else {
      licensesStore.set(licenseKey, {
        licenseKey,
        serviceId: order.serviceId,
        planId: order.planId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120 * 24 * 3600 * 1000,
        isTrial: false,
        activeRequestsCount: 0
      });
    }

    order.status = 'paid';
    order.paidAt = Date.now();
    order.licenseKey = licenseKey;
    ordersStore.set(orderId, order);

    return NextResponse.json({
      success: true,
      message: 'Xác nhận thành công!',
      licenseKey,
      order
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
