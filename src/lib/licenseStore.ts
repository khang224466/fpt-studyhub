import { readLicense } from '@/lib/serverLicense';
import { getOrder, isLicenseRevoked } from '@/lib/orderRepository';

export async function verifyLicense(licenseKey: unknown) {
  const invalid = { valid: false, reason: 'License không hợp lệ, hết hạn hoặc đã bị thu hồi. Vui lòng liên hệ admin cấp lại.', remainingMs: 0, formattedRemaining: '0 phút', record: undefined as { serviceId: string; expiresAt: number; isTrial: boolean; activeRequestsCount: number } | undefined };
  if (typeof licenseKey === 'string' && isLicenseRevoked(licenseKey)) return invalid;
  const claims = readLicense(licenseKey);
  if (!claims) return invalid;

  if (claims.orderId === 'LEGACY_ENC_AI') {
    const remainingMs = claims.expiresAt - Date.now();
    if (remainingMs <= 0) return invalid;
    return {
      valid: true,
      reason: undefined,
      remainingMs,
      formattedRemaining: `${Math.ceil(remainingMs / 3600000)} giờ`,
      record: { serviceId: 'edunext-assistant', expiresAt: claims.expiresAt, isTrial: false, activeRequestsCount: 0 }
    };
  }

  const order = await getOrder(claims.orderId);
  if (!order || !['approved', 'paid'].includes(order.status) || order.licenseKey !== licenseKey || order.expiresAt !== claims.expiresAt) return invalid;
  const remainingMs = claims.expiresAt - Date.now();
  if (remainingMs <= 0) return invalid;
  return { valid: true, reason: undefined, remainingMs,
    formattedRemaining: `${Math.ceil(remainingMs / 3600000)} giờ`,
    record: { serviceId: order.serviceId, expiresAt: claims.expiresAt, isTrial: order.amount === 0, activeRequestsCount: 0 }
  };
}
