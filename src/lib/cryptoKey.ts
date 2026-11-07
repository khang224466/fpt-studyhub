import crypto from 'crypto';

export const VAULT_SECRET = process.env.VAULT_SECRET || 'fpt-edunext-vault-v1011';

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
 * Automatically decrypt any key if it starts with ENC_AES_ or ENC_FPT_
 * If it's already plain text, returns as-is.
 */
export function decryptApiKey(token: string, secret: string = VAULT_SECRET): string {
  if (!token || typeof token !== 'string') return '';
  const trimmed = token.trim();

  // 1. Check ENC_AES_
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

  // 2. Check ENC_FPT_
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
