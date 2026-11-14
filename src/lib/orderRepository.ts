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

// In-memory fallback for serverless environments when Redis is not provided
const globalForOrders = globalThis as unknown as {
  __fpt_memory_orders__?: Map<string, OrderItem>;
};
if (!globalForOrders.__fpt_memory_orders__) {
  globalForOrders.__fpt_memory_orders__ = new Map<string, OrderItem>();
}
const memoryStore = globalForOrders.__fpt_memory_orders__;

const localFile = path.join(process.cwd(), '.data', 'orders-v2.json');
let localQueue: Promise<unknown> = Promise.resolve();

async function localOrders(): Promise<Record<string, OrderItem>> {
  try {
    const data = JSON.parse(await readFile(localFile, 'utf8'));
    return data;
  } catch {
    const obj: Record<string, OrderItem> = {};
    for (const [k, v] of memoryStore.entries()) obj[k] = v;
    return obj;
  }
}

export async function getOrder(id: string): Promise<OrderItem | null> {
  if (!useRedis()) return (await localOrders())[id] || memoryStore.get(id) || null;
  const raw = await redis(['HGET', hash, id]);
  return raw ? JSON.parse(raw) : null;
}

export async function listOrders(): Promise<OrderItem[]> {
  if (!useRedis()) return Object.values(await localOrders());
  const raw: string[] = await redis(['HVALS', hash]);
  return raw.map(value => JSON.parse(value));
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
        // Fallback silently if disk is read-only (e.g. serverless runtime)
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

export async function clearOrders(): Promise<void> {
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