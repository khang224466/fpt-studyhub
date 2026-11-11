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
  const salt = 'ENX_SEC_2026_FLASH_LITE';
  let expTimestamp = fallbackExpiresAt || 0;
  let planLabel = 'VIP';

  if (encKey && typeof encKey === 'string' && encKey.startsWith('ENC_AI_')) {
    try {
      const b64 = encKey.slice(7);
      const hex = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      let raw = '';
      for (let i = 0; i < hex.length; i += 2) {
        const c = parseInt(hex.substr(i, 2), 16) ^ salt.charCodeAt((i / 2) % salt.length);
        raw += String.fromCharCode(c);
      }
      if (raw.startsWith('EXP|')) {
        const parts = raw.split('|');
        const parsedExp = parseInt(parts[1], 10);
        if (!isNaN(parsedExp)) expTimestamp = parsedExp;
        if (parts[2]) planLabel = parts[2];
      }
    } catch (_) {}
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
