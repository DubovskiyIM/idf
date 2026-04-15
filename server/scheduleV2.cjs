/**
 * Парсер выражений для schedule v2 — расширения Rules Engine.
 *
 * Синтаксис:
 *   { after: "5min" }                  — относительно момента триггера
 *   { at: "$.readyAt" }                — абсолютная точка из payload
 *   { at: "$.readyAt + 10min" }        — арифметика над path-expression
 *
 * Возвращает абсолютный timestamp (мс), либо null если выражение
 * нерезолвимо (отсутствующий path).
 */

const DURATION_RE = /^(\d+)\s*(s|sec|min|m|h|hr|d)$/i;

const UNIT_MS = {
  s: 1000, sec: 1000,
  min: 60_000, m: 60_000,
  h: 3_600_000, hr: 3_600_000,
  d: 86_400_000,
};

function parseDuration(str) {
  if (typeof str !== "string") return null;
  const m = str.trim().match(DURATION_RE);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  return value * (UNIT_MS[unit] || 0) || null;
}

function readPath(payload, path) {
  // "$.order.placedAt" → payload.order.placedAt
  if (!path.startsWith("$.")) return undefined;
  const parts = path.slice(2).split(".");
  let cur = payload;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveFiresAt(rule, payload, now = Date.now()) {
  if (rule.after) {
    const ms = parseDuration(rule.after);
    if (ms == null) return null;
    return now + ms;
  }
  if (rule.at) {
    const expr = rule.at.trim();
    // Match "$.path [+ duration]"
    const m = expr.match(/^(\$\.[\w.]+)(?:\s*\+\s*(.+))?$/);
    if (!m) return null;
    const base = readPath(payload, m[1]);
    if (base == null || typeof base !== "number") return null;
    if (!m[2]) return base;
    const offset = parseDuration(m[2]);
    if (offset == null) return null;
    return base + offset;
  }
  return null;
}

module.exports = { parseDuration, resolveFiresAt, readPath };
