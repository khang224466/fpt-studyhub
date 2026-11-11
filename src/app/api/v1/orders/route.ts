import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { generateVietQRUrl } from '@/lib/utils';
import { OrderItem } from '@/types/rental';
import { licensesStore } from '@/lib/licenseStore';
import { generateExpiringLicenseKey } from '@/lib/cryptoKey';

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
    if (!plan) {
      return NextResponse.json({ success: false, message: 'Gói dịch vụ không khả dụng' }, { status: 400 });
    }

    const orderRandom = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ORD-${Date.now().toString().slice(-4)}${orderRandom}`;
    const transferCode = `PR${orderRandom}`;

    // Determine duration
    let durationDays = 7;
    if (plan.duration === '1m') durationDays = 30;
    if (plan.duration === 'semester') durationDays = 120;

    const { licenseKey, expiresAt } = generateExpiringLicenseKey(durationDays, plan.durationLabel);

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
      status: 'pending',
      createdAt: Date.now(),
      licenseKey
    };

    ordersStore.set(orderId, newOrder);

    const qrUrl = generateVietQRUrl(
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
    const { licenseKey } = generateExpiringLicenseKey(120, '1 Kỳ Học (4 Tháng)');
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
        licenseKey
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

    let durationDays = 7;
    if (order.planId === 'edunext-1m') durationDays = 30;
    if (order.planId === 'edunext-semester') durationDays = 120;

    const { licenseKey, expiresAt } = generateExpiringLicenseKey(durationDays, order.durationLabel);

    licensesStore.set(licenseKey, {
      licenseKey,
      serviceId: order.serviceId,
      planId: order.planId,
      createdAt: Date.now(),
      expiresAt,
      isTrial: false,
      activeRequestsCount: 0
    });

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
