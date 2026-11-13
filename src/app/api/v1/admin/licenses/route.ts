import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, issueLicense } from '@/lib/serverLicense';
import { changeOrder } from '@/lib/orderRepository';
export async function POST(req: NextRequest) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!isAdmin(req)) return reply({ success: false, message: 'Cần xác thực quản trị viên.' }, 401);
  let body;
  try { body = await req.json(); } catch { return reply({ success: false }, 400); }
  if (!body || !Number.isInteger(body.days) || body.days < 1 || body.days > 365) return reply({ success: false, message: 'Số ngày phải từ 1 đến 365.' }, 400);
  try {
    const orderId = `ORD-${randomUUID()}`, expiresAt = Date.now() + body.days * 86400000;
    const licenseKey = issueLicense(orderId, expiresAt, `${body.days} ngày`);
    await changeOrder(orderId, () => ({ orderId, serviceId: 'edunext-assistant', serviceName: 'EduNext AI', planId: 'edunext-1w', durationLabel: `${body.days} ngày`, amount: 0, transferCode: `ADMIN-${orderId.slice(4,16)}`, status: 'approved', createdAt: Date.now(), expiresAt, durationDays: body.days, licenseKey }));
    return reply({ success: true, licenseKey, expiresAt });
  } catch { return reply({ success: false, message: 'Chưa cấu hình khóa ký hoặc kho dữ liệu riêng.' }, 503); }
}
