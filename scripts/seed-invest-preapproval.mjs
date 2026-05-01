#!/usr/bin/env node
/**
 * Докидывает AgentPreapproval row в уже живой invest-tenant.
 * Нужно когда tenant создан до fix {{owner_id}} в template.
 *
 * Env:
 *   SMOKE_JWT            — JWT из браузера (тот же что для smoke)
 *   SMOKE_RUNTIME_URL    — https://invest-demo.app.intent-design.tech
 *   TENANT_HMAC_SECRET   — из /opt/idf-runtime/invest-demo/.env на VPS
 *                          (ssh root@VPS 'grep TENANT_HMAC_SECRET /opt/idf-runtime/invest-demo/.env')
 */
import { createHmac } from 'node:crypto';

const RUNTIME = process.env.SMOKE_RUNTIME_URL;
const JWT = process.env.SMOKE_JWT;
const HMAC_SECRET = process.env.TENANT_HMAC_SECRET;

if (!RUNTIME || !JWT || !HMAC_SECRET) {
  console.error('Нужны: SMOKE_RUNTIME_URL, SMOKE_JWT, TENANT_HMAC_SECRET');
  process.exit(1);
}

// Декодировать JWT payload (без верификации — только для извлечения sub)
const payload = JSON.parse(Buffer.from(JWT.split('.')[1], 'base64url').toString());
const userId = payload.sub;
if (!userId) {
  console.error('JWT не содержит sub claim:', JSON.stringify(payload));
  process.exit(1);
}
console.log(`userId из JWT: ${userId}`);

const effects = [
  {
    id: `preapproval-${userId.slice(0, 8)}`,
    alpha: 'create',
    entity: 'AgentPreapproval',
    fields: {
      id: `preapproval-${userId.slice(0, 8)}`,
      userId,
      active: true,
      maxOrderAmount: 10000,
      dailyLimit: 50000,
      allowedAssetTypes: 'stock,bond,etf',
      expiresAt: '2027-04-01T00:00:00Z',
    },
    context: { actor: 'system' },
    confirmedAt: new Date().toISOString(),
  },
];

const body = JSON.stringify({ effects });
const path = '/admin/seed';
const ts = Math.floor(Date.now() / 1000).toString();
const sig = createHmac('sha256', HMAC_SECRET)
  .update(`POST\n${path}\n${body}\n${ts}`)
  .digest('hex');

const res = await fetch(`${RUNTIME}${path}`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-idf-ts': ts,
    'x-idf-sig': sig,
  },
  body,
});

const result = await res.json().catch(() => null);
if (res.ok) {
  console.log(`✓ seed OK — inserted: ${result?.inserted ?? '?'}`);
} else {
  console.error(`✗ seed failed ${res.status}:`, JSON.stringify(result));
  process.exit(1);
}
