const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...rest) { return originalResolve.call(this, id.startsWith('@/') ? path.join(process.cwd(), 'src', id.slice(2)) : id, ...rest); };
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
process.env.NODE_ENV = 'production';
process.env.LICENSE_SIGNING_SECRET = 'test-signing-secret-not-production-123456789';
process.env.ADMIN_ACCESS_TOKEN = 'test-admin-token-not-production-123456789';
process.env.GEMINI_API_KEY = 'test-provider-secret-never-client';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
const stored = new Map(); let providerCalls = 0; let providerStatus = 200;
global.fetch = async (url, init) => {
  if (url === 'https://redis.test') {
    const [command, ...args] = JSON.parse(init.body); let result;
    if (command === 'HGET') result = stored.get(args[1]) || null;
    else if (command === 'HVALS') result = [...stored.values()];
    else if (command === 'EVAL') { const [, , , id, before, after] = args; result = (stored.get(id) || '') === before ? 1 : 0; if (result) stored.set(id, after); }
    else throw new Error('Unexpected command ' + command);
    return Response.json({ result });
  }
  assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//);
  assert.ok(!url.includes(process.env.GEMINI_API_KEY));
  assert.equal(init.headers['x-goog-api-key'], process.env.GEMINI_API_KEY);
  providerCalls++;
  return Response.json(providerStatus === 200 ? { candidates: [{ content: { parts: [{ text: 'Trả lời: 42' }] } }] } : { error: { message: process.env.GEMINI_API_KEY } }, { status: providerStatus });
};
const { NextRequest } = require('next/server');
const orders = require('../src/app/api/v1/orders/route.ts');
const admin = require('../src/app/api/v1/admin/licenses/route.ts');
const solve = require('../src/app/api/v1/ai/solve/route.ts');
const { verifyLicense } = require('../src/lib/licenseStore.ts');
const { issueLicense, readLicense } = require('../src/lib/serverLicense.ts');
const request = (url, body, authorized = false, method = 'POST') => new NextRequest('http://localhost' + url, { method, headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer ' + process.env.ADMIN_ACCESS_TOKEN } : {}) }, ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
let license, orderId;
test('customer cannot list orders, approve or manually issue licenses', async () => {
  assert.equal((await orders.GET(request('/api/v1/orders', null, false, 'GET'))).status, 401);
  assert.equal((await orders.PUT(request('/api/v1/orders', { action: 'approve' }))).status, 401);
  assert.equal((await admin.POST(request('/api/v1/admin/licenses', { days: 7 }))).status, 401);
});
test('arbitrary, raw, legacy, expired and tampered keys fail closed', async () => {
  for (const key of ['', 'abc', 'AIza-not-a-license', 'ENC_AI_fake']) assert.equal((await verifyLicense(key)).valid, false);
  const token = issueLicense('test', Date.now() + 10000, 'Test');
  assert.equal(readLicense(token).orderId, 'test');
  const parts = token.split('.'); parts[1] = Buffer.from(JSON.stringify({ orderId: 'other', expiresAt: Date.now() + 999999 })).toString('base64url');
  assert.equal(readLicense(parts.join('.')), null);
  assert.throws(() => issueLicense('test', Date.now() - 1, 'Expired'));
});
test('admin issues a signed license without leaking provider credentials', async () => {
  const res = await admin.POST(request('/api/v1/admin/licenses', { days: 7 }, true));
  assert.equal(res.status, 200);
  const data = await res.json(); license = data.licenseKey; orderId = readLicense(license).orderId;
  assert.ok(!JSON.stringify(data).includes(process.env.GEMINI_API_KEY));
  assert.ok(!Buffer.from(license.split('.')[1], 'base64url').toString().includes(process.env.GEMINI_API_KEY));
  assert.equal((await verifyLicense(license)).valid, true);
});
test('AI rejects user provider-key overrides and malformed images before calling Google', async () => {
  const before = providerCalls;
  for (const extra of [{ apiKeyOverride: 'custom' }, { rawKey: 'custom' }, { images: [123] }]) {
    assert.equal((await solve.POST(request('/api/v1/ai/solve', { licenseKey: license, question: 'Test', ...extra }))).status, 400);
  }
  assert.equal(providerCalls, before);
});
test('AI uses server key and sanitizes upstream failures without fabricated answers', async () => {
  const ok = await solve.POST(request('/api/v1/ai/solve', { licenseKey: license, question: 'Test' }));
  assert.equal(ok.status, 200); assert.equal((await ok.json()).answer, 'Trả lời: 42');
  providerStatus = 429;
  const limited = await solve.POST(request('/api/v1/ai/solve', { licenseKey: license, question: 'Test' }));
  assert.equal(limited.status, 429); assert.ok(!(await limited.text()).includes(process.env.GEMINI_API_KEY)); providerStatus = 200;
});
test('renewal invalidates old token; revocation persists after late confirmation', async () => {
  const extended = await orders.PUT(request('/api/v1/orders', { action: 'extend', orderId, addDays: 7 }, true));
  assert.equal(extended.status, 200); const next = (await extended.json()).licenseKey;
  assert.equal((await verifyLicense(license)).valid, false); assert.equal((await verifyLicense(next)).valid, true);
  assert.equal((await orders.PUT(request('/api/v1/orders', { action: 'revoke', orderId }, true))).status, 200);
  await orders.PUT(request('/api/v1/orders', { action: 'confirm_transfer', orderId }));
  assert.equal((await verifyLicense(next)).valid, false);
});
test('customer cannot forge paid status or amount on order creation; retries preserve state', async () => {
  const body = { serviceId: 'edunext-assistant', planId: 'edunext-1w', status: 'approved', amount: 1 };
  const response = await orders.POST(request('/api/v1/orders', body)); assert.equal(response.status, 200);
  const { order } = await response.json(); assert.equal(order.status, 'pending'); assert.notEqual(order.amount, 1);
  await orders.PUT(request('/api/v1/orders', { action: 'approve', orderId: order.orderId }, true));
  const retry = await orders.POST(request('/api/v1/orders', { ...body, orderId: order.orderId }));
  assert.equal((await retry.json()).order.status, 'approved');
});
test('public lookup rejects short guessable IDs and unknown actions never approve', async () => {
  assert.equal((await orders.GET(request('/api/v1/orders?orderId=1234', null, false, 'GET'))).status, 404);
  assert.equal((await orders.PUT(request('/api/v1/orders', { orderId, action: 'typo' }, true))).status, 400);
});
test('distributed compare-and-set retries a concurrent order update', async () => {
  const { changeOrder, getOrder } = require('../src/lib/orderRepository.ts');
  await Promise.all([changeOrder(orderId, value => ({ ...value, amount: value.amount + 1 })), changeOrder(orderId, value => ({ ...value, amount: value.amount + 1 }))]);
  assert.equal((await getOrder(orderId)).amount, 2);
});
