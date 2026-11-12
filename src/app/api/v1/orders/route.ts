
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

const CLOUD_STORE_ID = 'ff808181a09d98f701a1cd0fe3610db6';
const CLOUD_STORE_URL = `https://api.restful-api.dev/objects/${CLOUD_STORE_ID}`;

// In-memory fallback
const globalForOrders = globalThis as unknown as {
  ordersStore?: Map<string, OrderItem>;
};
if (!globalForOrders.ordersStore) {
  globalForOrders.ordersStore = new Map<string, OrderItem>();
}
const localOrdersStore = globalForOrders.ordersStore;

interface CompactOrder {
  id: string; // orderId
  tc: string; // transferCode
  st: 'p' | 'w' | 'a' | 'c'; // pending, waiting_approval, approved, cancelled
  pi: string; // planId
  am: number; // amount
  ca: number; // createdAt
  pa?: number; // paidAt
  ea?: number; // expiresAt
  dd?: number; // durationDays
  k?: string; // licenseKey
}

function serializeCompactOrders(orders: OrderItem[]): string {
  // Prune queue to fit well within SQL column limits:
  // Always preserve ALL pending and waiting orders, plus up to 6 latest approved/finished orders
  const pendingOrWaiting = orders.filter(o => o.status === 'pending' || o.status === 'waiting_approval');
  const finished = orders.filter(o => o.status !== 'pending' && o.status !== 'waiting_approval');
  const sortedFinished = finished.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const toSave = [...pendingOrWaiting, ...sortedFinished];

  const compactList: CompactOrder[] = toSave.map(o => ({
    id: o.orderId,
    tc: o.transferCode,
    st: (o.status === 'approved' || o.status === 'paid') ? 'a' : o.status === 'waiting_approval' ? 'w' : o.status === 'cancelled' ? 'c' : 'p',
    pi: o.planId,
    am: o.amount,
    ca: o.createdAt || Date.now(),
    pa: o.paidAt,
    ea: o.expiresAt,
    dd: o.durationDays,
    k: o.licenseKey || undefined
  }));

  return JSON.stringify(compactList);
}

function deserializeCompactOrders(rawStr: string): OrderItem[] {
  try {
    const compactList: CompactOrder[] = JSON.parse(rawStr);
    if (!Array.isArray(compactList)) return [];

    return compactList.map(co => {
      const plan = SERVICES_CATALOG[0].plans.find(p => p.id === co.pi) || SERVICES_CATALOG[0].plans[0];
      const status = co.st === 'a' ? 'approved' : co.st === 'w' ? 'waiting_approval' : co.st === 'c' ? 'cancelled' : 'pending';
      const durationDays = co.dd || (co.pi.includes('semester') ? 120 : co.pi.includes('1m') ? 30 : 7);
      const durationLabel = co.pi.includes('semester') ? '1 Kỳ Học (4 Tháng)' : co.pi.includes('1m') ? '1 Tháng' : '1 Tuần';

      let licenseKey = co.k || '';
      let expiresAt = co.ea || 0;
      if (status === 'approved' && !licenseKey) {
        const gen = generateExpiringLicenseKey(durationDays, durationLabel);
        licenseKey = gen.licenseKey;
        expiresAt = gen.expiresAt;
      }

      return {
        orderId: co.id,
        serviceId: 'edunext-assistant',
        serviceName: 'FPT EduNext AI Assistant Pro',
        planId: co.pi || plan.id,
        durationLabel,
        amount: co.am || plan.price,
        transferCode: co.tc,
        status,
        createdAt: co.ca,
        paidAt: co.pa,
        expiresAt,
        durationDays,
        licenseKey
      };
    });
  } catch {
    return [];
  }
}

async function fetchOrdersFromCloud(): Promise<OrderItem[]> {
  try {
    const res = await fetch(`${CLOUD_STORE_URL}?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store' },
      cache: 'no-store', next: { revalidate: 0 }
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        let incoming: OrderItem[] = [];
        if (typeof json.data.raw === 'string') {
          incoming = deserializeCompactOrders(json.data.raw);
        } else if (Array.isArray(json.data.orders)) {
          incoming = json.data.orders;
        }

        // Merge incoming into local memory store (preserving any newer local memory updates)
        for (const ord of incoming) {
          if (ord.orderId) {
            const existing = localOrdersStore.get(ord.orderId);
            if (!existing || existing.status === 'pending' || ord.status === 'approved') {
              localOrdersStore.set(ord.orderId, ord);
            }
          }
        }
        return Array.from(localOrdersStore.values());
      }
    }
  } catch (err) {
    console.error('[Orders Cloud Sync Fetch Error]:', err);
  }
  return Array.from(localOrdersStore.values());
}

async function saveOrdersToCloud(orders: OrderItem[]): Promise<boolean> {
  for (const ord of orders) {
    if (ord.orderId) localOrdersStore.set(ord.orderId, ord);
  }

  const rawCompact = serializeCompactOrders(Array.from(localOrdersStore.values()));

  try {
    const res = await fetch(CLOUD_STORE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'FPT_STUDYHUB_ORDERS_STORE_2026',
        data: { raw: rawCompact }
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
    const { 
      serviceId, 
      planId, 
      customerEmail, 
      customerPhone,
      orderId: clientOrderId,
      transferCode: clientTransferCode
    } = body;

    const service = SERVICES_CATALOG.find(s => s.id === serviceId) || SERVICES_CATALOG[0];
    const plan = service.plans.find(p => p.id === planId) || service.plans[0];

    const orderRandom = Math.floor(1000 + Math.random() * 9000);
    const orderId = clientOrderId || body.orderId || `ORD-${Date.now().toString().slice(-4)}${orderRandom}`;
    const transferCode = clientTransferCode || body.transferCode || `PR${orderRandom}`;

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
      durationLabel: body.durationLabel || plan.durationLabel,
      amount: body.amount || plan.price,
      customerEmail,
      customerPhone,
      transferCode,
      status: body.status || 'pending',
      createdAt: body.createdAt || Date.now()
    };

    const existingOrders = await fetchOrdersFromCloud();
    const updatedOrders = [newOrder, ...existingOrders.filter(o => o.orderId !== orderId && o.transferCode !== transferCode)];
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
  const transferCode = searchParams.get('transferCode');

  const orders = await fetchOrdersFromCloud();

  if (!orderId && !transferCode) {
    const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return NextResponse.json({
      success: true,
      orders: sorted,
      total: sorted.length
    }, { headers: NO_CACHE_HEADERS });
  }

  const searchOrderId = (orderId || '').trim().toUpperCase();
  const searchCode = (transferCode || '').trim().toUpperCase();

  const order = orders.find(o => {
    const oId = (o.orderId || '').toUpperCase();
    const tCode = (o.transferCode || '').toUpperCase();
    if (searchOrderId && (oId === searchOrderId || oId.endsWith(searchOrderId))) return true;
    if (searchCode && (tCode === searchCode || tCode === ('PR' + searchCode) || ('PR' + tCode) === searchCode || oId.endsWith(searchCode))) return true;
    if (searchOrderId && (tCode === searchOrderId || tCode === ('PR' + searchOrderId))) return true;
    return false;
  });

  if (!order) {
    return NextResponse.json({ success: false, message: 'Đơn hàng không tồn tại' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  // If approved but licenseKey empty, auto-generate valid license key
  if ((order.status === 'approved' || order.status === 'paid') && !order.licenseKey) {
    const durationDays = order.durationDays || (order.planId?.includes('semester') ? 120 : order.planId?.includes('1m') ? 30 : 7);
    const gen = generateExpiringLicenseKey(durationDays, order.durationLabel || '1 Ky Hoc (4 Thang)');
    order.licenseKey = gen.licenseKey;
    order.expiresAt = gen.expiresAt;
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
    const targetCode = (transferCode || '').trim().toUpperCase();
    const targetOrderId = (orderId || '').trim().toUpperCase();

    let orderIndex = orders.findIndex(o => {
      const oId = (o.orderId || '').toUpperCase();
      const tCode = (o.transferCode || '').toUpperCase();
      if (targetOrderId && oId === targetOrderId) return true;
      if (targetCode && (tCode === targetCode || tCode === ('PR' + targetCode) || ('PR' + tCode) === targetCode)) return true;
      if (targetCode && oId.endsWith(targetCode)) return true;
      return false;
    });

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

    const { licenseKey, expiresAt } = generateExpiringLicenseKey(durationDays, order.durationLabel || '1 Ky Hoc (4 Thang)', apiKey);

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

// Purge / Clear all orders (Xóa sạch luồng đơn hàng, reset trắng tinh)
export async function DELETE(req: NextRequest) {
  try {
    localOrdersStore.clear();
    await saveOrdersToCloud([]);
    return NextResponse.json({
      success: true,
      message: 'Đã xóa sạch danh sách đơn hàng (trắng tinh)!',
      orders: []
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
