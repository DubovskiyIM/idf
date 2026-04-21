/**
 * SQLite-backed реализация Persistence interface из @intent-driven/engine.
 *
 * Оборачивает существующий better-sqlite3 db в async-контракт. Sync-calls
 * заворачиваются в Promise.resolve(...) — zero overhead в V8 JIT.
 *
 * Persistence contract:
 *   - appendEffect(effect): Promise<void>
 *   - readEffects(filter?): Promise<Effect[]>
 *   - updateStatus(id, status, opts?): Promise<void>
 *   - ruleState: { get(ruleId, userId), set(ruleId, userId, patch) }
 */

const db = require("./db.js");

// Лениво добавить колонку `reason` в effects, если её ещё нет (для persistence
// контракта updateStatus со reason). SQLite не поддерживает IF NOT EXISTS
// в ALTER — используем try/catch.
try {
  db.exec("ALTER TABLE effects ADD COLUMN reason TEXT");
} catch {
  // column already exists
}

function safeJson(s) {
  if (s == null) return null;
  if (typeof s !== "string") return s;
  if (s === "") return null;
  try { return JSON.parse(s); } catch { return null; }
}

function createSqlitePersistence() {
  return {
    async appendEffect(effect) {
      if (!effect?.id) throw new Error("Effect must have id");
      db.prepare(`
        INSERT INTO effects
          (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        effect.id,
        effect.intent_id,
        effect.alpha,
        effect.target,
        effect.value != null ? JSON.stringify(effect.value) : null,
        effect.scope || "account",
        effect.parent_id || null,
        effect.status || "proposed",
        effect.ttl || null,
        JSON.stringify(effect.context || {}),
        effect.created_at,
        effect.resolved_at || null,
        effect.reason || null,
      );
    },

    async readEffects(filter = {}) {
      let sql = "SELECT * FROM effects WHERE 1=1";
      const params = [];
      if (filter.status) { sql += " AND status = ?"; params.push(filter.status); }
      if (filter.since != null) { sql += " AND created_at >= ?"; params.push(filter.since); }
      sql += " ORDER BY created_at ASC";
      const rows = db.prepare(sql).all(...params);
      return rows.map((r) => ({
        ...r,
        value: safeJson(r.value),
        context: safeJson(r.context) || {},
      }));
    },

    async updateStatus(id, status, opts = {}) {
      db.prepare(`
        UPDATE effects
           SET status = ?,
               resolved_at = COALESCE(?, resolved_at, ?),
               reason = COALESCE(?, reason)
         WHERE id = ?
      `).run(
        status,
        opts.resolvedAt || null,
        Date.now(),
        opts.reason || null,
        id,
      );
    },

    ruleState: {
      async get(ruleId, userId) {
        const row = db.prepare(
          "SELECT counter, last_fired_at FROM rule_state WHERE rule_id = ? AND user_id = ?"
        ).get(ruleId, userId);
        return row
          ? { counter: row.counter || 0, lastFiredAt: row.last_fired_at || null }
          : { counter: 0, lastFiredAt: null };
      },
      async set(ruleId, userId, patch) {
        const prev = await this.get(ruleId, userId);
        const next = { ...prev, ...patch };
        db.prepare(`
          INSERT INTO rule_state (rule_id, user_id, counter, last_fired_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(rule_id, user_id)
          DO UPDATE SET counter = excluded.counter, last_fired_at = excluded.last_fired_at
        `).run(ruleId, userId, next.counter, next.lastFiredAt);
      },
    },
  };
}

module.exports = { createSqlitePersistence };
