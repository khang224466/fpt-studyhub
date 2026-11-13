export interface ParsedLicenseInfo {
  valid: boolean;
  expired: boolean;
  isNearExpiry: boolean; // <= 5 days
  plan: string;
  expDateStr: string;
  expiresAt: number;
  remainingDays: number;
  remainingHours: number;
  remainingFormatted: string;
}

export function parseClientLicense(encKey?: string, fallbackExpiresAt?: number): ParsedLicenseInfo | null {
  let expTimestamp = fallbackExpiresAt || 0;
  let planLabel = 'VIP';
  if (encKey?.startsWith('FPT1.')) {
    try {
      const encoded = encKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof window !== 'undefined'
        ? new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)))
        : Buffer.from(encoded, 'base64').toString('utf8');
      const claims = JSON.parse(json);
      if (Number.isSafeInteger(claims.expiresAt)) expTimestamp = claims.expiresAt;
      if (typeof claims.plan === 'string') planLabel = claims.plan;
    } catch { return null; }
  }

  if (!expTimestamp) return null;

  const now = Date.now();
  const diffMs = expTimestamp - now;
  const expired = diffMs <= 0;
  const remainingDays = Math.ceil(diffMs / (24 * 3600 * 1000));
  const remainingHours = Math.max(0, Math.ceil(diffMs / (3600 * 1000)));
  const isNearExpiry = !expired && remainingDays <= 5;

  let remainingFormatted = '';
  if (expired) {
    const passedDays = Math.abs(Math.floor(diffMs / (24 * 3600 * 1000)));
    remainingFormatted = `Đã hết hạn (${passedDays > 0 ? passedDays + ' ngày trước' : 'vừa xong'})`;
  } else if (remainingDays <= 1) {
    remainingFormatted = `Còn ${remainingHours} giờ`;
  } else {
    remainingFormatted = `Còn ${remainingDays} ngày (${remainingHours}h)`;
  }

  const expDateObj = new Date(expTimestamp);
  const expDateStr = expDateObj.toLocaleDateString('vi-VN') + ' ' + expDateObj.toLocaleTimeString('vi-VN');

  return {
    valid: true,
    expired,
    isNearExpiry,
    plan: planLabel,
    expDateStr,
    expiresAt: expTimestamp,
    remainingDays,
    remainingHours,
    remainingFormatted
  };
}
