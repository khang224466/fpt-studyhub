import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { generateVietQRUrl } from '@/lib/utils';
import { OrderItem } from '@/types/rental';
import { generateExpiringLicenseKey } from '@/lib/cryptoKey';

const CLOUD_STORE_ID = 'ff808181a09d98f701a1c947378e0537';
const CLOUD_STORE_URL = `https://api.restful-api.dev/objects/${CLOUD_STORE_ID}`;

// In-memory fallback
const globalForOrders = globalThis as unknown as {
  ordersStore?: Map<string, OrderItem>;
};
if (!globalForOrders.ordersStore) {
  globalForOrders.ordersStore = new Map<string, OrderItem>();
}
const localOrdersStore = globalForOrders.ordersStore;

async function fetchOrdersFromCloud(): Promise<OrderItem[]> {
  try {
    const res = await fetch(CLOUD_STORE_URL, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      cache: 'no-store'
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data.orders)) {
        // Sync to local memory
        localOrdersStore.clear();
        for (const ord of json.data.orders) {
          if (ord.orderId) localOrdersStore.set(ord.orderId, ord);
        }
        return json.data.orders;
      }
    }
  } catch (err) {
    console.error('[Orders Cloud Sync Fetch Error]:', err);
  }
  return Array.from(localOrdersStore.values());
}

async function saveOrdersToCloud(orders: OrderItem[]): Promise<boolean> {
  // Always update local memory first
  localOrdersStore.clear();
  for (const ord of orders) {
    if (ord.orderId) localOrdersStore.set(ord.orderId, ord);
  }

  try {
    const res = await fetch(CLOUD_STORE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'FPT_STUDYHUB_ORDERS_STORE_2026',
        data: { orders }
      })
    });
    return res.ok;
  } catch (err) {
    console.error('[Orders Cloud Sync Save Error]:', err);
    return false;
  }
}

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

    // Select accurate QR image
    let qrStaticImage = BANK_CONFIG.qrStaticImage;
    if (plan.price === 30000 || plan.id.includes('1w')) {
      qrStaticImage = BANK_CONFIG.qr30k || '/qr_30k.jpg';
    } else if (plan.price === 69000 || plan.id.includes('1m')) {
      qrStaticImage = BANK_CONFIG.qr69k || '/qr_69k.jpg';
    } else if (plan.price === 220000 || plan.id.includes('semester')) {
      qrStaticImage = BANK_CONFIG.qr220k || '/qr_220k.png';
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

    const existingOrders = await fetchOrdersFromCloud();
    // Prepend new order
    const updatedOrders = [newOrder, ...existingOrders.filter(o => o.orderId !== orderId)];
    await saveOrdersToCloud(updatedOrders);

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

  const orders = await fetchOrdersFromCloud();

  // If no orderId is provided, return all orders for Admin console
  if (!orderId) {
    const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return NextResponse.json({
      success: true,
      orders: sorted,
      total: sorted.length
    });
  }

  const order = orders.find(o => o.orderId === orderId);
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

    const orders = await fetchOrdersFromCloud();
    const orderIndex = orders.findIndex(o => o.orderId === orderId);

    if (orderIndex === -1) {
      return NextResponse.json({ success: false, message: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const order = orders[orderIndex];

    // Action 1: User indicates transfer done -> status = 'waiting_approval'
    if (action === 'confirm_transfer') {
      order.status = 'waiting_approval';
      orders[orderIndex] = order;
      await saveOrdersToCloud(orders);
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

    const { licenseKey } = generateExpiringLicenseKey(durationDays, order.durationLabel);

    order.status = 'approved';
    order.paidAt = Date.now();
    order.licenseKey = licenseKey;
    orders[orderIndex] = order;
    await saveOrdersToCloud(orders);

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
