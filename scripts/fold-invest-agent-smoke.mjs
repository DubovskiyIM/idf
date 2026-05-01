#!/usr/bin/env node
/**
 * Fold invest-agent E2E smoke — проверяет /api/agent/:slug/{schema,world,exec}
 * на deploy'нутом invest-tenant'е в Fold SaaS.
 *
 * Предпосылки:
 *   1. Studio на studio.intent-design.tech задеплоена
 *   2. Runtime tenant для invest template создан через wizard и доступен
 *      на https://<slug>.app.intent-design.tech
 *   3. Environment:
 *      SMOKE_RUNTIME_URL — полный URL tenant'а (обязательно)
 *      SMOKE_JWT         — JWT agent-role user'а (обязательно, получить из auth-plane)
 *      SMOKE_SLUG        — slug (default: "invest")
 *
 * Запуск (локальный dev на localhost:4001):
 *   SMOKE_RUNTIME_URL=http://localhost:4001 SMOKE_JWT=$(cat /tmp/jwt) \
 *     node scripts/fold-invest-agent-smoke.mjs
 *
 * Проверяет 8 шагов:
 *   1. GET /health → 200
 *   2. GET /api/agent/:slug/schema → intents содержит 3 agent-intent'а
 *   3. GET /api/agent/:slug/world → visible entities
 *   4. POST /exec valid order (5k, stock) → 200 confirmed
 *   5. POST /exec over maxAmount (50k) → 403 preapproval_denied maxAmount
 *   6. POST /exec crypto (disallowed) → 403 preapproval_denied csvInclude
 *   7. POST /exec recompute_risk_score → 200 (без preapproval requiredFor)
 *   8. POST /exec intent not_permitted (random id) → 405
 *
 * Exit 0 при успехе, 1 при любом fail'е.
 */

const RUNTIME = process.env.SMOKE_RUNTIME_URL;
const JWT = process.env.SMOKE_JWT;
const SLUG = process.env.SMOKE_SLUG || 'invest';

if (!RUNTIME || !JWT) {
  console.error('[smoke] ERROR: SMOKE_RUNTIME_URL и SMOKE_JWT обязательны');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function log(step, msg) {
  process.stdout.write(`\n[smoke ${step}] ${msg}\n`);
}

function ok(step, msg) {
  process.stdout.write(`[smoke ${step}] ✓ ${msg}\n`);
  passed++;
}

function fail(step, msg, details) {
  process.stderr.write(`[smoke ${step}] ✗ ${msg}\n`);
  if (details !== undefined) {
    process.stderr.write(`  details: ${JSON.stringify(details, null, 2)}\n`);
  }
  failed++;
}

async function req(method, path, body) {
  const res = await fetch(`${RUNTIME}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${JWT}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, body: data };
}

async function main() {
  // ── 1 ──
  log(1, 'GET /health');
  const h = await fetch(`${RUNTIME}/health`).then((r) => r.json()).catch(() => null);
  if (h?.status === 'ok') ok(1, '/health → ok');
  else fail(1, '/health не ok', h);

  // ── 2 ──
  log(2, 'GET /api/agent/:slug/schema');
  const sch = await req('GET', `/api/agent/${SLUG}/schema`);
  if (sch.status !== 200) {
    fail(2, `status=${sch.status}`, sch.body);
  } else {
    const intents = sch.body?.intents ?? {};
    const required = [
      'agent_execute_preapproved_order',
      'agent_recompute_risk_score',
      'agent_generate_report',
    ];
    const missing = required.filter((id) => !(id in intents));
    if (missing.length === 0) ok(2, `schema содержит все 3 agent-intents`);
    else fail(2, 'отсутствуют intents', missing);
  }

  // ── 3 ──
  log(3, 'GET /api/agent/:slug/world');
  const w = await req('GET', `/api/agent/${SLUG}/world`);
  if (w.status === 200 && w.body?.world) ok(3, 'world получен');
  else fail(3, `status=${w.status}`, w.body);

  // ── 4 ──
  log(4, 'POST /exec valid order (stock, 5k) — ожидаем 200');
  const r4 = await req('POST', `/api/agent/${SLUG}/exec`, {
    intentId: 'agent_execute_preapproved_order',
    params: {
      portfolioId: 'portfolio-main',
      assetId: 'asset-aapl',
      direction: 'buy',
      quantity: 10,
      total: 5000,
      assetType: 'stock',
    },
  });
  if (r4.status === 200 && r4.body?.ok) ok(4, 'valid order → confirmed');
  else fail(4, `expected 200 got ${r4.status}`, r4.body);

  // ── 5 ──
  log(5, 'POST /exec over maxAmount (50k) — ожидаем 403 maxAmount');
  const r5 = await req('POST', `/api/agent/${SLUG}/exec`, {
    intentId: 'agent_execute_preapproved_order',
    params: {
      portfolioId: 'portfolio-main',
      assetId: 'asset-tsla',
      direction: 'buy',
      quantity: 200,
      total: 50000,
      assetType: 'stock',
    },
  });
  if (r5.status === 403 && r5.body?.failedCheck === 'maxAmount') {
    ok(5, 'maxAmount → 403 preapproval_denied');
  } else {
    fail(5, `expected 403 maxAmount got ${r5.status}`, r5.body);
  }

  // ── 6 ──
  log(6, 'POST /exec crypto (disallowed) — ожидаем 403 csvInclude');
  const r6 = await req('POST', `/api/agent/${SLUG}/exec`, {
    intentId: 'agent_execute_preapproved_order',
    params: {
      portfolioId: 'portfolio-main',
      assetId: 'asset-btc',
      direction: 'buy',
      quantity: 0.1,
      total: 1000,
      assetType: 'crypto',
    },
  });
  if (r6.status === 403 && r6.body?.failedCheck === 'csvInclude') {
    ok(6, 'crypto → 403 csvInclude');
  } else {
    fail(6, `expected 403 csvInclude got ${r6.status}`, r6.body);
  }

  // ── 7 ──
  log(7, 'POST /exec recompute_risk_score — ожидаем 200 (без requiredFor)');
  const r7 = await req('POST', `/api/agent/${SLUG}/exec`, {
    intentId: 'agent_recompute_risk_score',
    params: { portfolioId: 'portfolio-main', score: 65 },
  });
  if (r7.status === 200 && r7.body?.ok) ok(7, 'recompute_risk_score → 200');
  else fail(7, `expected 200 got ${r7.status}`, r7.body);

  // ── 8 ──
  log(8, 'POST /exec unknown intent — ожидаем 405 intent_not_permitted');
  const r8 = await req('POST', `/api/agent/${SLUG}/exec`, {
    intentId: 'make_coffee',
    params: {},
  });
  if (r8.status === 405) ok(8, 'unknown intent → 405');
  else fail(8, `expected 405 got ${r8.status}`, r8.body);

  process.stdout.write(`\n=== ${passed} ok, ${failed} fail ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('smoke fatal:', e);
  process.exit(1);
});
