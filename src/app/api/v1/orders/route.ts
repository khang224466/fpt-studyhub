import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { generateVietQRUrl } from '@/lib/utils';
import { OrderItem } from '@/types/rental';
import { licensesStore } from '@/lib/licenseStore';
import { generateExpiringLicenseKey } from '@/lib/cryptoKey';

// In-memory persistent orders store across requests
const globalForOrders = globalThis as unknown as {
  ordersStore?: Map<string, OrderItem>;
};

if (!globalForOrders.ordersStore) {
  globalForOrders.ordersStore = new Map<string, OrderItem>();
  
  // Seed initial sample orders for Admin console
  const sample1Key = generateExpiringLicenseKey(7, '1 Tuần').licenseKey;
  const sample2Key = generateExpiringLicenseKey(30, '1 Tháng').licenseKey;

  globalForOrders.ordersStore.set('ORD-8821', {
    orderId: 'ORD-8821',
    serviceId: 'edunext-assistant',
    serviceName: 'FPT EduNext AI Assistant Pro',
    planId: 'edunext-1w',
    durationLabel: '1 Tuần',
    amount: 30000,
    transferCode: 'PR8821',
    status: 'approved',
    createdAt: Date.now() - 3600000 * 2,
    paidAt: Date.now() - 3600000 * 2,
    licenseKey: sample1Key
  });

  globalForOrders.ordersStore.set('ORD-9104', {
    orderId: 'ORD-9104',
    serviceId: 'edunext-assistant',
    serviceName: 'FPT EduNext AI Assistant Pro',
    planId: 'edunext-1m',
    durationLabel: '1 Tháng',
    amount: 69000,
    transferCode: 'PR9104',
    status: 'waiting_approval',
    createdAt: Date.now() - 900000
  });

  globalForOrders.ordersStore.set('ORD-4219', {
    orderId: 'ORD-4219',
    serviceId: 'edunext-assistant',
    serviceName: 'FPT EduNext AI Assistant Pro',
    planId: 'edunext-semester',
    durationLabel: '1 Kỳ Học (4 Tháng)',
    amount: 220000,
    transferCode: 'PR4219',
    status: 'waiting_approval',
    createdAt: Date.now() - 300000
  });
}

const ordersStore = globalForOrders.ordersStore;

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

    // Select QR image based on price/plan
    let qrStaticImage = BANK_CONFIG.qrStaticImage;
    if (plan.price === 30000 || plan.id.includes('1w')) {
      qrStaticImage = BANK_CONFIG.qr30k || '/qr_30k.jpg';
    } else if (plan.price === 69000 || plan.id.includes('1m')) {
      qrStaticImage = BANK_CONFIG.qr69k || '/qr_69k.jpg';
    } else if (plan.price === 220000 || plan.id.includes('semester')) {
      qrStaticImage = BANK_CONFIG.qr69k || '/qr_69k.jpg';
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
      status: 'pending',
      createdAt: Date.now()
    };

    ordersStore.set(orderId, newOrder);

    const dynamicQrUrl = generateVietQRUrl(
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
      qrUrl: qrStaticImage || dynamicQrUrl,
      dynamicQrUrl
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  // If no orderId is provided, return all orders for Admin console
  if (!orderId) {
    const ordersList = Array.from(ordersStore.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return NextResponse.json({
      success: true,
      orders: ordersList,
      total: ordersList.length
    });
  }

  const order = ordersStore.get(orderId);
  if (!order) {
    return NextResponse.json({ success: false, message: 'Đơn hàng không tồn tại' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    order,
    licenseKey: order.licenseKey || null
  });
}

// Payment confirmation / Admin Approval trigger
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action } = body;

    const order = ordersStore.get(orderId);
    if (!order) {
      return NextResponse.json({ success: false, message: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    // Action 1: User indicates they have transferred money -> status = 'waiting_approval'
    if (action === 'confirm_transfer') {
      order.status = 'waiting_approval';
      ordersStore.set(orderId, order);
      return NextResponse.json({
        success: true,
        message: 'Đã ghi nhận yêu cầu, đang chờ Admin duyệt đơn!',
        order
      });
    }

    // Action 2: Admin approves order -> generate key and status = 'approved'
    let durationDays = 7;
    if (order.planId === 'edunext-1m' || (order.durationLabel && order.durationLabel.includes('Tháng'))) {
      durationDays = 30;
    } else if (order.planId === 'edunext-semester' || (order.durationLabel && order.durationLabel.includes('Kỳ'))) {
      durationDays = 120;
    }

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

    order.status = 'approved';
    order.paidAt = Date.now();
    order.licenseKey = licenseKey;
    ordersStore.set(orderId, order);

    return NextResponse.json({
      success: true,
      message: 'Admin đã duyệt và cấp Key thành công!',
      licenseKey,
      order
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
