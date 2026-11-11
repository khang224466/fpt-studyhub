import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { generateVietQRUrl } from '@/lib/utils';
import { OrderItem } from '@/types/rental';
import { generateExpiringLicenseKey, extendLicenseKey } from '@/lib/cryptoKey';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

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
    const res = await fetch(`${CLOUD_STORE_URL}?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store' },
      cache: 'no-store'
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data.orders)) {
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
      return NextResponse.json({ success: false, message: 'Dịch vụ không tồn tại' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const plan = service.plans.find(p => p.id === planId) || service.plans[0];
    if (!plan) {
      return NextResponse.json({ success: false, message: 'Gói dịch vụ không khả dụng' }, { status: 400, headers: NO_CACHE_HEADERS });
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
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  const orders = await fetchOrdersFromCloud();

  if (!orderId) {
    const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return NextResponse.json({
      success: true,
      orders: sorted,
      total: sorted.length
    }, { headers: NO_CACHE_HEADERS });
  }

  const order = orders.find(o => o.orderId === orderId);
  if (!order) {
    return NextResponse.json({ success: false, message: 'Đơn hàng không tồn tại' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({
    success: true,
    order,
    licenseKey: order.licenseKey || null
  }, { headers: NO_CACHE_HEADERS });
}

// Payment confirmation / Admin Approval trigger
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, apiKey, transferCode } = body;

    const orders = await fetchOrdersFromCloud();
    let orderIndex = orders.findIndex(o => 
      (orderId && o.orderId === orderId) || 
      (transferCode && o.transferCode === transferCode)
    );

    // If order not found in cloud store, auto-upsert so requests are NEVER dropped
    if (orderIndex === -1) {
      const activeOrderId = orderId || `ORD-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
      const activeTransferCode = transferCode || body.transferCode || ('PR' + activeOrderId.slice(-4));
      const newOrder: OrderItem = {
        orderId: activeOrderId,
        serviceId: body.serviceId || 'edunext-assistant',
        serviceName: body.serviceName || 'FPT EduNext AI Assistant Pro',
        planId: body.planId || 'edunext-semester',
        durationLabel: body.durationLabel || '1 Kỳ Học (4 Tháng)',
        amount: body.amount || 220000,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        transferCode: activeTransferCode,
        status: action === 'approve' ? 'approved' : 'waiting_approval',
        createdAt: Date.now()
      };
      orders.unshift(newOrder);
      orderIndex = 0;
    }

    const order = orders[orderIndex];

    // Action 1: User indicates transfer done -> status = 'waiting_approval'
    if (action === 'confirm_transfer') {
      order.status = 'waiting_approval';
      if (body.durationLabel) order.durationLabel = body.durationLabel;
      if (body.amount) order.amount = body.amount;
      if (body.planId) order.planId = body.planId;
      if (transferCode) order.transferCode = transferCode;
      orders[orderIndex] = order;
      await saveOrdersToCloud(orders);
      return NextResponse.json({
        success: true,
        message: 'Đã ghi nhận yêu cầu, đang chờ Admin duyệt đơn!',
        order
      }, { headers: NO_CACHE_HEADERS });
    }

    // Action 2: Extend license expiration (Gia hạn Key)
    if (action === 'extend') {
      const addDays = parseInt(body.addDays, 10) || 7;
      const currentKey = order.licenseKey || '';
      const { licenseKey, expiresAt } = extendLicenseKey(
        currentKey,
        addDays,
        order.durationLabel || '1 Tuan',
        apiKey
      );
      order.licenseKey = licenseKey;
      order.expiresAt = expiresAt;
      order.status = 'approved';
      order.durationDays = (order.durationDays || 7) + addDays;
      orders[orderIndex] = order;
      await saveOrdersToCloud(orders);
      return NextResponse.json({
        success: true,
        message: `Đã gia hạn thành công thêm ${addDays} ngày!`,
        order,
        licenseKey,
        expiresAt
      }, { headers: NO_CACHE_HEADERS });
    }

    // Action 3: Revoke license key (Thu hồi / Khóa Key)
    if (action === 'revoke') {
      order.status = 'cancelled';
      order.licenseKey = '';
      order.expiresAt = 0;
      orders[orderIndex] = order;
      await saveOrdersToCloud(orders);
      return NextResponse.json({
        success: true,
        message: 'Đã thu hồi bản quyền thành công!',
        order
      }, { headers: NO_CACHE_HEADERS });
    }

    // Action 4: Admin approves order -> generate key and status = 'approved'
    let durationDays = 7;
    if (order.planId === 'edunext-1m' || (order.durationLabel && order.durationLabel.includes('Tháng'))) {
      durationDays = 30;
    } else if (order.planId === 'edunext-semester' || (order.durationLabel && order.durationLabel.includes('Kỳ'))) {
      durationDays = 120;
    }

    const { licenseKey, expiresAt } = generateExpiringLicenseKey(durationDays, order.durationLabel, apiKey);

    order.status = 'approved';
    order.paidAt = Date.now();
    order.licenseKey = licenseKey;
    order.expiresAt = expiresAt;
    order.durationDays = durationDays;
    orders[orderIndex] = order;
    await saveOrdersToCloud(orders);

    return NextResponse.json({
      success: true,
      message: 'Admin đã duyệt và cấp Key thành công!',
      licenseKey,
      expiresAt,
      order
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
