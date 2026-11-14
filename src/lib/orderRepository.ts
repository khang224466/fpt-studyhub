import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { OrderItem } from '@/types/rental';

// Production requires a private Redis REST endpoint. Falls back to in-memory/local storage if not configured.
const hash = 'fpt:orders:v2';
async function redis(command: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith('https://')) throw new Error('Private order storage is not configured');
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Order storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Order storage rejected the operation');
  return data.result;
}
function useRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Built-in persistent seed orders so serverless cold restarts never lose active customer orders
export const DEFAULT_SEED_ORDERS: OrderItem[] = [
  {
    orderId: 'ORD-8887-SEMESTER-VIP',
    serviceId: 'edunext-assistant',
    serviceName: 'FPT EduNext AI Assistant Pro',
    planId: 'edunext-semester',
    durationLabel: '1 Kỳ Học (4 Tháng)',
    durationDays: 120,
    amount: 220000,
    transferCode: 'PR7874',
    status: 'approved',
    createdAt: 1763085600000,
    paidAt: 1763085660000,
    expiresAt: 1804990888514, // 14/3/2027
    licenseKey: 'FPT1.eyJvcmRlcklkIjoiT1JELTg4ODctU0VNRVNURVItVklQIiwiZXhwaXJlc0F0IjoxODA0OTkwODg4NTE0LCJwbGFuIjoiMSBL4buzIEjhu41jICg0IFRow6FuZykiLCJub25jZSI6InNlZWQtdmlwLTIwMjYifQ.eaIyaxIoNHGg5Xv1lGJueKphjp1UHa8kE8cPmQdn3LE'
  }
];

// In-memory fallback for serverless environments when Redis is not provided
const globalForOrders = globalThis as unknown as {
  __fpt_memory_orders__?: Map<string, OrderItem>;
};
if (!globalForOrders.__fpt_memory_orders__) {
  globalForOrders.__fpt_memory_orders__ = new Map<string, OrderItem>();
  for (const seed of DEFAULT_SEED_ORDERS) {
    globalForOrders.__fpt_memory_orders__.set(seed.orderId, seed);
  }
}
const memoryStore = globalForOrders.__fpt_memory_orders__;

// On Vercel / AWS Lambda, process.cwd() is read-only (/var/task). Only /tmp is writable!
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const localFile = isServerless
  ? path.join('/tmp', 'orders-v2.json')
  : path.join(process.cwd(), '.data', 'orders-v2.json');

let localQueue: Promise<unknown> = Promise.resolve();

async function localOrders(): Promise<Record<string, OrderItem>> {
  try {
    const raw = await readFile(localFile, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object') {
          memoryStore.set(k, v as OrderItem);
        }
      }
    }
  } catch {
    // If file is unreadable, fallback to memoryStore
  }

  // Ensure default seed orders are always present
  if (memoryStore.size === 0) {
    for (const seed of DEFAULT_SEED_ORDERS) {
      memoryStore.set(seed.orderId, seed);
    }
  }

  const obj: Record<string, OrderItem> = {};
  for (const [k, v] of memoryStore.entries()) obj[k] = v;
  return obj;
}

const deletedOrderIds = new Set<string>();

export async function getOrder(id: string): Promise<OrderItem | null> {
  if (deletedOrderIds.has(id)) return null;
  if (!useRedis()) return (await localOrders())[id] || memoryStore.get(id) || null;
  const raw = await redis(['HGET', hash, id]);
  return raw ? JSON.parse(raw) : null;
}

export async function listOrders(): Promise<OrderItem[]> {
  let list: OrderItem[];
  if (!useRedis()) {
    list = Object.values(await localOrders());
  } else {
    const raw: string[] = await redis(['HVALS', hash]);
    list = raw.map(value => JSON.parse(value));
    if (list.length === 0) {
      // Seed Redis if empty and not deleted
      for (const seed of DEFAULT_SEED_ORDERS) {
        if (!deletedOrderIds.has(seed.orderId)) {
          try {
            await redis(['HSET', hash, seed.orderId, JSON.stringify(seed)]);
          } catch {}
        }
      }
      list = [...DEFAULT_SEED_ORDERS];
    }
  }
  return list.filter(ord => ord && ord.orderId && !deletedOrderIds.has(ord.orderId));
}

export async function changeOrder(id: string, change: (current: OrderItem | null) => OrderItem): Promise<OrderItem> {
  if (!useRedis()) {
    const operation = localQueue.then(async () => {
      const orders = await localOrders();
      const result = change(orders[id] || memoryStore.get(id) || null);
      orders[id] = result;
      memoryStore.set(id, result);
      try {
        await mkdir(path.dirname(localFile), { recursive: true });
        await writeFile(`${localFile}.tmp`, JSON.stringify(orders), 'utf8');
        await rename(`${localFile}.tmp`, localFile);
      } catch {
        // Fallback silently if disk is read-only
      }
      return result;
    });
    localQueue = operation.catch(() => {});
    return operation;
  }
  // Compare-and-set prevents a late confirmation from overwriting an approval or revocation.
  for (let attempt = 0; attempt < 4; attempt++) {
    const before: string | null = await redis(['HGET', hash, id]);
    const after = change(before ? JSON.parse(before) : null);
    const saved = await redis(['EVAL',
      "local old=redis.call('HGET',KEYS[1],ARGV[1]); if (old or '')~=ARGV[2] then return 0 end; redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); return 1",
      1, hash, id, before || '', JSON.stringify(after)]);
    if (saved === 1) return after;
  }
  throw new Error('Order changed concurrently; please retry');
}

export async function upsertBulkOrders(items: OrderItem[]): Promise<OrderItem[]> {
  const orders = await localOrders();
  for (const it of items) {
    if (it && it.orderId && !deletedOrderIds.has(it.orderId)) {
      orders[it.orderId] = it;
      memoryStore.set(it.orderId, it);
      if (useRedis()) {
        try {
          await redis(['HSET', hash, it.orderId, JSON.stringify(it)]);
        } catch {}
      }
    }
  }
  try {
    await mkdir(path.dirname(localFile), { recursive: true });
    await writeFile(`${localFile}.tmp`, JSON.stringify(orders), 'utf8');
    await rename(`${localFile}.tmp`, localFile);
  } catch {}
  return Object.values(orders).filter(ord => ord && ord.orderId && !deletedOrderIds.has(ord.orderId));
}

export const revokedLicenseKeys = new Set<string>();

export function isLicenseRevoked(key: string): boolean {
  if (!key) return false;
  return revokedLicenseKeys.has(key);
}

export async function deleteOrder(id: string): Promise<boolean> {
  const existing = memoryStore.get(id) || (await localOrders())[id];
  if (existing && existing.licenseKey) {
    revokedLicenseKeys.add(existing.licenseKey);
  }
  deletedOrderIds.add(id);
  memoryStore.delete(id);
  if (!useRedis()) {
    const orders = await localOrders();
    delete orders[id];
    try {
      await mkdir(path.dirname(localFile), { recursive: true });
      await writeFile(`${localFile}.tmp`, JSON.stringify(orders), 'utf8');
      await rename(`${localFile}.tmp`, localFile);
    } catch {}
    return true;
  }
  try {
    await redis(['HDEL', hash, id]);
    return true;
  } catch {
    return false;
  }
}

export async function deletePendingOrders(): Promise<number> {
  const all = await listOrders();
  const pending = all.filter(o => o.status === 'pending' || o.status === 'waiting_approval');
  for (const o of pending) {
    await deleteOrder(o.orderId);
  }
  return pending.length;
}

export async function clearOrders(): Promise<void> {
  for (const k of memoryStore.keys()) deletedOrderIds.add(k);
  memoryStore.clear();
  if (!useRedis()) {
    try {
      await writeFile(localFile, JSON.stringify({}), 'utf8');
    } catch {}
    return;
  }
  try {
    await redis(['DEL', hash]);
  } catch {}
}
