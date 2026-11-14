import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { changeOrder, getOrder, listOrders, clearOrders } from '@/lib/orderRepository';
import { isAdmin, issueLicense } from '@/lib/serverLicense';
import type { OrderItem } from '@/types/rental';

const headers = { 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const denied = () => reply({ success: false, message: 'Cần xác thực quản trị viên (Thiếu hoặc sai x-admin-token).' }, 401);
const failed = () => reply({ success: false, message: 'Không thể lưu đơn hàng. Kiểm tra cấu hình kho dữ liệu riêng và khóa ký license.' }, 503);
const validId = (id: unknown): id is string => typeof id === 'string' && /^ORD-[\w-]{4,50}$/i.test(id);

// Anti-flood / DoS Rate Limiter (In-Memory IP Bucket)
const ipHits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = ipHits.get(key);
  if (!record || now > record.resetAt) {
    ipHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip')?.trim() ||
         '127.0.0.1';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`order:create:${ip}`, 5, 60000)) {
    return reply({ success: false, message: 'Bạn đang tạo quá nhiều đơn hàng cùng lúc. Vui lòng thử lại sau 1 phút.' }, 429);
  }
  let body;
  try { body = await req.json(); } catch { return reply({ success: false }, 400); }
  if (!body || typeof body !== 'object') return reply({ success: false }, 400);
  const service = SERVICES_CATALOG.find(s => s.id === body.serviceId && !s.isComingSoon);
  const plan = service?.plans.find(p => p.id === body.planId);
  if (!service || !plan) return reply({ success: false, message: 'Gói dịch vụ không hợp lệ.' }, 400);
  if (body.orderId && !validId(body.orderId)) return reply({ success: false, message: 'Mã đơn không hợp lệ. Hãy tải lại trang.' }, 400);
  const orderId = body.orderId || `ORD-${randomUUID()}`;
  try {
    const order = await changeOrder(orderId, current => current || {
      orderId, serviceId: service.id, serviceName: service.name, planId: plan.id,
      durationLabel: plan.durationLabel, amount: plan.price,
      transferCode: `PR${orderId.slice(4).replaceAll('-', '').slice(0, 12).toUpperCase()}`,
      status: 'pending', createdAt: Date.now()
    });
    return reply({ success: true, order, bank: BANK_CONFIG });
  } catch { return failed(); }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('orderId');
  const action = req.nextUrl.searchParams.get('action');
  const key = req.nextUrl.searchParams.get('key');
  if (action === 'check_key') {
    const { isLicenseRevoked } = await import('@/lib/orderRepository');
    const isRev = isLicenseRevoked(key || '');
    return reply({ success: true, valid: !isRev, revoked: Boolean(isRev) });
  }
  try {
    if (!id) {
      // Must be authenticated Admin with valid x-admin-token to view all orders & customer keys
      if (!isAdmin(req)) return denied();
      const orders = (await listOrders()).sort((a,b) => b.createdAt - a.createdAt);
      return reply({ success: true, orders, total: orders.length });
    }
    const order = await getOrder(id!);
    return order ? reply({ success: true, order, licenseKey: order.licenseKey || null }) : reply({ success: false, message: 'Không tìm thấy đơn.' }, 404);
  } catch { return failed(); }
}

export async function PUT(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return reply({ success: false }, 400); }
  if (!body || typeof body !== 'object') return reply({ success: false }, 400);
  const action = body.action;

  // Customers are ONLY permitted to confirm their transfer.
  // Critical operations (approve, extend, revoke, sync_bulk) STRICTLY REQUIRE ADMIN!
  if (action !== 'confirm_transfer') {
    if (!isAdmin(req)) return denied();
  }

  if (action === 'sync_bulk' && Array.isArray(body.orders)) {
    const { upsertBulkOrders } = await import('@/lib/orderRepository');
    const updatedList = await upsertBulkOrders(body.orders);
    return reply({ success: true, orders: updatedList, count: updatedList.length });
  }
  if (!['confirm_transfer', 'approve', 'extend', 'revoke'].includes(action)) return reply({ success: false, message: 'Thao tác không hợp lệ.' }, 400);
  if (action === 'extend' && (!Number.isInteger(body.addDays) || body.addDays < 1 || body.addDays > 365)) return reply({ success: false, message: 'Số ngày phải từ 1 đến 365.' }, 400);
  try {
    let id = body.orderId;
    if (!id && typeof body.transferCode === 'string') {
      id = (await listOrders()).find(o => o.transferCode === body.transferCode.trim().toUpperCase())?.orderId;
    }
    if (!id) return reply({ success: false, message: 'Không tìm thấy mã đơn hoặc mã chuyển khoản.' }, 404);
    const order = await changeOrder(id, current => {
      if (!current) throw new Error('Missing order');
      const updated: OrderItem = { ...current };
      if (action === 'confirm_transfer') {
        if (updated.status === 'pending') updated.status = 'waiting_approval';
        return updated;
      }
      if (action === 'revoke') return { ...updated, status: 'cancelled', licenseKey: '', expiresAt: 0 };
      if (action === 'approve' && ['approved', 'paid'].includes(updated.status)) return updated;
      if (updated.status === 'cancelled') throw new Error('Cancelled order');
      const plan = SERVICES_CATALOG.find(s => s.id === updated.serviceId)?.plans.find(p => p.id === updated.planId);
      const days = action === 'extend' ? body.addDays : plan?.duration === 'semester' ? 120 : plan?.id?.includes('1m') ? 30 : plan?.duration === '2h' ? 2 / 24 : 7;
      updated.expiresAt = Math.max(Date.now(), action === 'extend' ? updated.expiresAt || 0 : 0) + days * 86400000;
      // Issue cryptographically signed FPT1 license token (Zero-Client Leak: No Gemini Key embedded)
      updated.licenseKey = issueLicense(updated.orderId, updated.expiresAt, updated.durationLabel || 'VIP');
      updated.durationDays = (action === 'extend' ? updated.durationDays || 0 : 0) + days;
      updated.status = 'approved';
      updated.paidAt ||= Date.now();
      return updated;
    });
    return reply({ success: true, order, licenseKey: order.licenseKey, expiresAt: order.expiresAt });
  } catch { return failed(); }
}

export async function DELETE(req: NextRequest) {
  // ANY delete or wipe operation STRICTLY REQUIRES ADMIN!
  if (!isAdmin(req)) return denied();
  try {
    let orderId = req.nextUrl.searchParams.get('orderId');
    let action = req.nextUrl.searchParams.get('action');
    if (!orderId && !action) {
      try {
        const body = await req.json();
        if (body && typeof body === 'object') {
          if (body.orderId) orderId = body.orderId;
          if (body.action) action = body.action;
        }
      } catch {}
    }
    const { deleteOrder, deletePendingOrders, clearOrders } = await import('@/lib/orderRepository');
    if (orderId) {
      await deleteOrder(orderId.trim());
      return reply({ success: true, message: `Đã xóa đơn ${orderId} thành công!` });
    }
    if (action === 'delete_pending') {
      const count = await deletePendingOrders();
      return reply({ success: true, count, message: `Đã xóa ${count} đơn chờ thanh toán thành công!` });
    }
    await clearOrders();
    return reply({ success: true, message: 'Đã xóa sạch danh sách đơn hàng (trắng tinh)!' });
  } catch { return failed(); }
}
