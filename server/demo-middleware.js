/**
 * Demo-tenant middleware. Активен только когда `DEMO_MODE=1`.
 * Без env-флага — no-op (все экспортируемые функции возвращают next()/no-op).
 *
 * Три защиты:
 *   1. Read-only mode — GET всегда, mutating-методы требуют header
 *      `X-Demo-Curator-Token: ${process.env.DEMO_CURATOR_TOKEN}`.
 *      Анонимные posters → 403.
 *   2. Per-IP rate-limit (sliding window) на /api/effects и /api/meta/llm.
 *      Дефолт: 30 req / 60s. Override через DEMO_RL_MAX / DEMO_RL_WINDOW_MS.
 *   3. SSE connection cap. Дефолт: 100 одновременных connection'ов на
 *      /api/effects/stream + /api/meta/llm/runs/X/stream. Override через
 *      DEMO_SSE_MAX.
 *
 * Все три по отдельности exportируются как Express middleware,
 * чтобы host подключал явно (не неявная цепочка). Без external deps.
 */

const DEMO_MODE = process.env.DEMO_MODE === "1";
const CURATOR_TOKEN = process.env.DEMO_CURATOR_TOKEN || "";
const RL_MAX = Number(process.env.DEMO_RL_MAX || 30);
const RL_WINDOW_MS = Number(process.env.DEMO_RL_WINDOW_MS || 60_000);
const SSE_MAX = Number(process.env.DEMO_SSE_MAX || 100);

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ───────── Read-only ─────────

function readOnlyGuard(req, res, next) {
  if (!DEMO_MODE) return next();
  if (!MUTATING.has(req.method)) return next();
  const tok = req.get("X-Demo-Curator-Token");
  if (CURATOR_TOKEN && tok === CURATOR_TOKEN) return next();
  return res.status(403).json({
    error: "demo_read_only",
    message: "Demo tenant — мутирующие операции требуют curator-токен",
  });
}

// ───────── Rate-limit ─────────

// Sliding window per IP. Map<ip, [tsMs, ...]>. Старое выкидывается лениво
// при следующем hit'е (no background cleanup — для demo-tenant'а GC через
// 6h reset cron достаточно).
const rlBuckets = new Map();

function rateLimit(req, res, next) {
  if (!DEMO_MODE) return next();
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rlBuckets.get(ip) || [];
  // Drop старые timestamps
  while (bucket.length && bucket[0] < now - RL_WINDOW_MS) bucket.shift();
  if (bucket.length >= RL_MAX) {
    res.set("Retry-After", Math.ceil(RL_WINDOW_MS / 1000));
    return res.status(429).json({
      error: "demo_rate_limit",
      message: `Превышен лимит ${RL_MAX} запросов / ${RL_WINDOW_MS}мс`,
      retryAfterMs: bucket[0] + RL_WINDOW_MS - now,
    });
  }
  bucket.push(now);
  rlBuckets.set(ip, bucket);
  next();
}

// ───────── SSE cap ─────────

let sseActive = 0;

function sseCap(req, res, next) {
  if (!DEMO_MODE) return next();
  if (sseActive >= SSE_MAX) {
    return res.status(503).json({
      error: "demo_sse_capacity",
      message: `Достигнут лимит ${SSE_MAX} одновременных SSE-подключений`,
    });
  }
  sseActive++;
  // SSE-роуты пишут в res; cleanup на close/end. Express вызывает 'close'
  // когда client отвалился — этого достаточно.
  const release = () => {
    sseActive = Math.max(0, sseActive - 1);
  };
  res.once("close", release);
  res.once("finish", release);
  next();
}

// ───────── Telemetry ─────────

function getStats() {
  return {
    enabled: DEMO_MODE,
    sseActive,
    rlBuckets: rlBuckets.size,
    config: { RL_MAX, RL_WINDOW_MS, SSE_MAX, hasToken: !!CURATOR_TOKEN },
  };
}

module.exports = {
  readOnlyGuard,
  rateLimit,
  sseCap,
  getStats,
  DEMO_MODE,
};
