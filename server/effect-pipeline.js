/**
 * Единый пайплайн приёма эффектов. Вызывается и REST-роутом (POST /api/effects),
 * и WebSocket-обработчиком (handleMessage type:"effect"). До этого логика была
 * дублирована в двух местах и дрейфовала.
 *
 * Отвечает за:
 *  1) INSERT как proposed
 *  2) broadcast "effect:proposed"
 *  3) Валидация (с опциональной задержкой)
 *  4) UPDATE status → confirmed | rejected
 *  5) broadcast "effect:confirmed" | "effect:rejected"
 *  6) TTL auto-reject через setTimeout
 *
 * Не трогает доменно-специфичные побочные эффекты (типа авто-закрытия опроса
 * по дедлайну) — они подаются через onConfirmed callback от конкретного
 * транспорта.
 */

const db = require("./db.js");
const { validate, cascadeReject } = require("./validator.js");

/**
 * @param {Object} ef — сырой эффект от клиента (id, intent_id, alpha, target,
 *   value, scope, parent_id, ttl, context, created_at)
 * @param {Object} opts
 * @param {Function} opts.broadcast — (event, data) → void, специфичен для
 *   транспорта (SSE для REST, WS для WebSocket)
 * @param {number} [opts.delay] — опциональная задержка валидации (мс)
 * @param {Function} [opts.onConfirmed] — callback после успешной валидации,
 *   получает сохранённый эффект. Используется для доменных сайд-эффектов
 *   (авто-закрытие опроса, нотификации и т.п.).
 */
function ingestEffect(ef, { broadcast, delay = 0, onConfirmed } = {}) {
  if (!broadcast) throw new Error("ingestEffect: broadcast function required");

  // 1) INSERT как proposed
  db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?)
  `).run(
    ef.id, ef.intent_id, ef.alpha, ef.target,
    ef.value != null ? JSON.stringify(ef.value) : null,
    ef.scope || "account",
    ef.parent_id || null,
    ef.ttl || null,
    ef.context ? JSON.stringify(ef.context) : null,
    ef.created_at
  );

  // 2) broadcast proposed
  broadcast("effect:proposed", { id: ef.id, intent_id: ef.intent_id });

  // 3-5) Валидация + обновление статуса + broadcast результата
  const resolve = () => {
    const stored = db.prepare("SELECT * FROM effects WHERE id = ?").get(ef.id);
    const result = validate(stored);
    const now = Date.now();

    if (result.valid) {
      db.prepare("UPDATE effects SET status = 'confirmed', resolved_at = ? WHERE id = ?").run(now, ef.id);
      broadcast("effect:confirmed", { id: ef.id });

      if (onConfirmed) {
        try { onConfirmed(stored, ef); } catch (e) { console.error("[ingestEffect] onConfirmed threw:", e); }
      }

      // 6) TTL auto-reject
      if (ef.ttl) {
        setTimeout(() => {
          const current = db.prepare("SELECT status FROM effects WHERE id = ?").get(ef.id);
          if (current && current.status === "confirmed") {
            const ttlNow = Date.now();
            db.prepare("UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?").run(ttlNow, ef.id);
            const ttlCascaded = cascadeReject(ef.id);
            broadcast("effect:rejected", { id: ef.id, reason: "TTL expired", cascaded: ttlCascaded });
          }
        }, ef.ttl);
      }
    } else {
      db.prepare("UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?").run(now, ef.id);
      const cascaded = cascadeReject(ef.id);
      broadcast("effect:rejected", { id: ef.id, reason: result.reason, cascaded });
    }
  };

  if (delay > 0) {
    setTimeout(resolve, delay);
  } else {
    resolve();
  }
}

module.exports = { ingestEffect };
