import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface LicenseClaims {
  orderId: string;
  expiresAt: number;
  plan: string;
  nonce: string;
}

function signingSecret() {
  const secret = process.env.LICENSE_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('LICENSE_SIGNING_SECRET must contain at least 32 characters');
  return secret;
}

export function issueLicense(orderId: string, expiresAt: number, plan: string): string {
  if (!orderId || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw new Error('Invalid license claims');
  const payload = Buffer.from(JSON.stringify({ orderId, expiresAt, plan, nonce: randomUUID() })).toString('base64url');
  const signature = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `FPT1.${payload}.${signature}`;
}

export function readLicense(token: unknown): LicenseClaims | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'FPT1' || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return null;
  const expected = createHmac('sha256', signingSecret()).update(parts[1]).digest();
  const signature = Buffer.from(parts[2], 'base64url');
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof claims.orderId !== 'string' || typeof claims.plan !== 'string' || typeof claims.nonce !== 'string' ||
        !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= Date.now()) return null;
    return claims;
  } catch { return null; }
}

export function isAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_ACCESS_TOKEN;
  if (!secret || secret.length < 32) return false;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const a = Buffer.from(supplied), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
