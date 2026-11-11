import crypto from 'crypto';

export const VAULT_SECRET = process.env.VAULT_SECRET || 'fpt-edunext-vault-v1011';
export const ENX_CIPHER_SALT = 'ENX_SEC_2026_FLASH_LITE';

/**
 * Encrypt payload using the exact XOR + Base64 cipher recognized by the client EduNext HUD
 */
export function encryptClientKey(payload: string, salt: string = ENX_CIPHER_SALT): string {
  let hex = '';
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    hex += c.toString(16).padStart(2, '0');
  }
  const b64 = Buffer.from(hex, 'binary').toString('base64');
  return `ENC_AI_${b64}`;
}

/**
 * Decrypt ENC_AI_ key using the client XOR cipher
 */
export function decryptClientKey(encKey: string, salt: string = ENX_CIPHER_SALT): string | null {
  if (!encKey || typeof encKey !== 'string') return null;
  const clean = encKey.trim();
  if (clean.startsWith('AIza') || clean.startsWith('AQ.')) return clean;
  if (!clean.startsWith('ENC_AI_')) return null;

  try {
    const b64 = clean.slice(7);
    const hex = Buffer.from(b64, 'base64').toString('binary');
    let raw = '';
    for (let i = 0; i < hex.length; i += 2) {
      const c = parseInt(hex.substr(i, 2), 16) ^ salt.charCodeAt((i / 2) % salt.length);
      raw += String.fromCharCode(c);
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * Generate a time-limited encrypted license key for client HUD
 * @param durationDays Number of days (e.g. 7 for 1w, 30 for 1m, 120 for semester)
 * @param planLabel Human readable label (e.g. "1 Tuần", "1 Tháng", "1 Kỳ Học")
 * @param apiKey Optional raw Gemini API key
 */
export function generateExpiringLicenseKey(
  durationDays: number,
  planLabel: string,
  apiKey: string = process.env.GEMINI_API_KEY || 'AIzaSyFPT_PRO_STUDYHUB_SECURE_TOKEN'
): { licenseKey: string; expiresAt: number; payload: string } {
  const expiresAt = Date.now() + durationDays * 24 * 3600 * 1000;
  const payload = `EXP|${expiresAt}|${planLabel}|${apiKey}`;
  const licenseKey = encryptClientKey(payload);
  return { licenseKey, expiresAt, payload };
}

/**
 * Parse and validate license expiration
 */
export function validateExpiringKey(encKey: string): {
  valid: boolean;
  expired?: boolean;
  plan?: string;
  expDate?: string;
  remainingDays?: number;
  apiKey?: string;
  reason?: string;
} {
  const raw = decryptClientKey(encKey);
  if (!raw) return { valid: false, reason: 'Key không đúng định dạng ENC_AI_' };

  if (raw.startsWith('EXP|')) {
    const parts = raw.split('|');
    const exp = parseInt(parts[1], 10);
    const plan = parts[2] || 'VIP';
    const apiKey = parts.slice(3).join('|');
    const now = Date.now();

    if (isNaN(exp)) return { valid: false, reason: 'Key lỗi định dạng timestamp' };
    const expDate = new Date(exp).toLocaleDateString('vi-VN') + ' ' + new Date(exp).toLocaleTimeString('vi-VN');

    if (now > exp) {
      return {
        valid: false,
        expired: true,
        plan,
        expDate,
        reason: `Key đã hết hạn sử dụng vào ${expDate}`
      };
    }

    const remainingMs = exp - now;
    const remainingDays = Math.ceil(remainingMs / (24 * 3600 * 1000));

    return {
      valid: true,
      expired: false,
      plan,
      expDate,
      remainingDays,
      apiKey
    };
  }

  if (raw.startsWith('AIza') || raw.startsWith('AQ.') || raw.length >= 20) {
    return {
      valid: true,
      expired: false,
      plan: 'Vĩnh Viễn / Raw Key',
      apiKey: raw
    };
  }

  return { valid: false, reason: 'Key không hợp lệ' };
}

/**
 * Encrypt any plain text API key into ENC_AES_... (AES-256-CBC)
 */
export function encryptApiKeyAes(plainText: string, secret: string = VAULT_SECRET): string {
  if (!plainText) return '';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `ENC_AES_${iv.toString('hex')}:${encrypted}`;
}

/**
 * Encrypt any plain text API key into ENC_FPT_... (Portable Keystream)
 */
export function encryptApiKeyPortable(plainText: string, secret: string = VAULT_SECRET): string {
  if (!plainText) return '';
  const keyBuf = crypto.createHash('sha256').update(secret).digest();
  const plainBuf = Buffer.from(plainText, 'utf8');
  const xorBuf = Buffer.alloc(plainBuf.length);
  for (let i = 0; i < plainBuf.length; i++) {
    xorBuf[i] = plainBuf[i] ^ keyBuf[i % keyBuf.length];
  }
  return `ENC_FPT_${xorBuf.toString('base64')}`;
}

/**
 * Automatically decrypt any key if it starts with ENC_AES_, ENC_FPT_, or ENC_AI_
 */
export function decryptApiKey(token: string, secret: string = VAULT_SECRET): string {
  if (!token || typeof token !== 'string') return '';
  const trimmed = token.trim();

  // 1. Check ENC_AI_ (Client HUD format)
  if (trimmed.startsWith('ENC_AI_')) {
    const raw = decryptClientKey(trimmed);
    if (raw) {
      if (raw.startsWith('EXP|')) {
        const parts = raw.split('|');
        return parts.slice(3).join('|');
      }
      return raw;
    }
  }

  // 2. Check ENC_AES_
  if (trimmed.startsWith('ENC_AES_')) {
    try {
      const parts = trimmed.replace('ENC_AES_', '').split(':');
      if (parts.length === 2) {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const key = crypto.createHash('sha256').update(secret).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (e: any) {
      console.warn('[Crypto] Failed to decrypt ENC_AES_ key:', e.message);
    }
  }

  // 3. Check ENC_FPT_
  if (trimmed.startsWith('ENC_FPT_')) {
    try {
      const b64 = trimmed.replace('ENC_FPT_', '');
      const xorBuf = Buffer.from(b64, 'base64');
      const keyBuf = crypto.createHash('sha256').update(secret).digest();
      const plainBuf = Buffer.alloc(xorBuf.length);
      for (let i = 0; i < xorBuf.length; i++) {
        plainBuf[i] = xorBuf[i] ^ keyBuf[i % keyBuf.length];
      }
      return plainBuf.toString('utf8');
    } catch (e: any) {
      console.warn('[Crypto] Failed to decrypt ENC_FPT_ key:', e.message);
    }
  }

  // If already plain text (e.g. AIza..., gsk_..., sk-...)
  return trimmed;
}
