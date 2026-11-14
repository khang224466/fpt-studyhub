import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { changeOrder, getOrder, listOrders, clearOrders } from '@/lib/orderRepository';
import { isAdmin, issueLicense } from '@/lib/serverLicense';
import type { OrderItem } from '@/types/rental';

const headers = { 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const denied = () => reply({ success: false, message: 'Cần xác thực quản trị viên.' }, 401);
const failed = () => reply({ success: false, message: 'Không thể lưu đơn hàng. Kiểm tra cấu hình kho dữ liệu riêng và khóa ký license.' }, 503);
const validId = (id: unknown): id is string => typeof id === 'string' && /^ORD-[\w-]{4,50}$/i.test(id);

export async function POST(req: NextRequest) {
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
  try {
    if (!id) {
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
      const safeDuration = (updated.durationLabel || 'VIP')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd');
      const masterKey = (body.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim().length >= 10)
        ? body.apiKey.trim()
        : Buffer.from('QVEuQWI4Uk42STBzeHlnOEV3aHZDSmlzMkdOQVZEMUcyUVBMNXZYU3pkeWR6dGgtOWVwZw==', 'base64').toString('utf8');
      const payload = `EXP|${updated.expiresAt}|${safeDuration}|${masterKey}`;
      const salt = 'ENX_SEC_2026_FLASH_LITE';
      let hex = '';
      for (let i = 0; i < payload.length; i++) {
        const c = payload.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
        hex += c.toString(16).padStart(2, '0');
      }
      updated.licenseKey = `ENC_AI_${btoa(hex)}`;
      updated.durationDays = (action === 'extend' ? updated.durationDays || 0 : 0) + days;
      updated.status = 'approved';
      updated.paidAt ||= Date.now();
      return updated;
    });
    return reply({ success: true, order, licenseKey: order.licenseKey, expiresAt: order.expiresAt });
  } catch { return failed(); }
}

export async function DELETE(req: NextRequest) {
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
