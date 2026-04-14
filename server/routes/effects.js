const { Router } = require("express");
const db = require("../db.js");
const { validate, cascadeReject, foldWorld, checkInvariantsForDomain } = require("../validator.js");
const { ingestEffect } = require("../effect-pipeline.js");
const { validateIntentConditions, getIntent, getDomainByIntentId } = require("../intents.js");
const { getOntology } = require("../ontologyRegistry.cjs");
const { evaluateRules } = require("../ruleEngine.js");
const { v4: uuid } = require("uuid");

const router = Router();

// SSE-подписчики
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

// GET /api/effects — все эффекты
router.get("/", (req, res) => {
  const effects = db.prepare("SELECT * FROM effects ORDER BY created_at ASC").all();
  res.json(effects.map(e => ({
    ...e,
    value: e.value ? JSON.parse(e.value) : null,
    context: e.context ? JSON.parse(e.context) : null,
  })));
});

// GET /api/effects/stream — SSE
router.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("event: connected\ndata: {}\n\n");

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// POST /api/effects — создать эффект
router.post("/", (req, res) => {
  const ef = req.body;
  const delay = parseInt(req.query.delay) || 0;

  ingestEffect(ef, {
    broadcast,
    delay,
    onConfirmed: (stored) => {
      // === Глобальные инварианты (§14, v1.6.1) ===
      // Проверяем world(t) после применения подтверждённого эффекта.
      // Response 201 уже улетел (ingestEffect async), поэтому rollback
      // идёт через cascadeReject + SSE `effect:rejected`.
      try {
        const domain = getDomainByIntentId(stored.intent_id);
        if (domain) {
          const inv = checkInvariantsForDomain(domain);
          const errors = inv.violations.filter(v => v.severity === "error");
          if (errors.length > 0) {
            const now = Date.now();
            db.prepare("UPDATE effects SET status='rejected', resolved_at=? WHERE id=?")
              .run(now, stored.id);
            cascadeReject(stored.id);
            broadcast("effect:rejected", {
              id: stored.id,
              reason: "invariant_violation",
              violations: errors,
            });
            console.log(`[invariants] Эффект ${stored.id} откачен: ${errors.map(v=>v.name).join(", ")}`);
            return; // не запускаем реактивные правила на rejected
          }
          if (inv.violations.length > 0) {
            // warnings: логируем, но не блокируем
            console.log(`[invariants] ${stored.id} warnings: ${inv.violations.map(v=>v.name).join(", ")}`);
          }
        }
      } catch (e) {
        console.error("[invariants] Ошибка проверки:", e);
      }

      // === Темпоральный scheduler (Task 9 plan) ===
      try {
        const { onEffectConfirmed: timerOnConfirmed } = require("../timeEngine.js");
        const { evaluateScheduleV2 } = require("../ruleEngine.js");
        // Обновляем in-memory queue (schedule_timer/revoke_timer effects)
        if (global.__timerQueue) {
          timerOnConfirmed(global.__timerQueue, stored);
        }
        // Прогоняем правила scheduleV2 для других intent_id
        evaluateScheduleV2(stored, {
          getRulesForDomain: (domain) => {
            const ont = getOntology(domain);
            return ont?.rules || [];
          },
          getDomainByIntentId,
          ingestEffect: (ef) => ingestEffect(ef, { broadcast, delay: 0 }),
          foldWorld: () => foldWorld(),
        });
      } catch (e) {
        console.error("[scheduler] hook error:", e);
      }

      // === Реактивные правила (sync) ===
      // Декларативные правила из ontology.rules: trigger match → validate action conditions → emit.
      const ruleDeps = { getDomainByIntentId, getOntology, validateIntentConditions, getIntent };
      try {
        const fired = evaluateRules(stored, () => foldWorld(), ruleDeps);
        for (const { rule, effect } of fired) {
          const now = Date.now();
          db.prepare(`
            INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, 'account', NULL, 'confirmed', NULL, ?, ?, ?)
          `).run(effect.id, effect.intent_id, effect.alpha, effect.target,
            effect.value != null ? JSON.stringify(effect.value) : null,
            JSON.stringify(effect.context), now, now);
          broadcast("effect:confirmed", { id: effect.id });
          console.log(`  [rule:${rule.id}] ${rule.action} выполнен`);
        }
      } catch (e) {
        console.error("[rules] Ошибка выполнения реактивных правил:", e);
      }

      // === Автозакрытие по дедлайну ===
      // Планировать автозакрытие опроса по дедлайну — доменно-специфичный
      // сайд-эффект planning-домена. Живёт здесь как callback, а не в
      // effect-pipeline.js, чтобы пайплайн оставался доменно-независимым.
      if (stored.intent_id === "set_deadline" && stored.value) {
        const rawValue = typeof stored.value === "string" ? stored.value : String(stored.value);
        let deadlineStr;
        try { deadlineStr = JSON.parse(rawValue); } catch { deadlineStr = rawValue; }
        const deadlineTime = new Date(deadlineStr).getTime();
        const delayMs = deadlineTime - Date.now();
        if (delayMs > 0) {
          setTimeout(() => {
            const ctx = typeof stored.context === "string" ? JSON.parse(stored.context) : (stored.context || {});
            const pollId = ctx.id;
            if (!pollId) return;
            const world = foldWorld();
            const poll = (world.polls || []).find(p => p.id === pollId);
            if (!poll || poll.status !== "open") return;
            const closeId = uuid();
            const closeNow = Date.now();
            db.prepare(`
              INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
              VALUES (?, 'close_poll', 'replace', 'poll.status', '"closed"', 'account', NULL, 'confirmed', NULL, ?, ?, ?)
            `).run(closeId, JSON.stringify({ id: pollId }), closeNow, closeNow);
            broadcast("effect:confirmed", { id: closeId });
            console.log(`  [deadline] Опрос ${pollId} автоматически закрыт по дедлайну`);
          }, delayMs);
          console.log(`  [deadline] Автозакрытие опроса запланировано через ${Math.round(delayMs/1000)}с`);
        }
      }
    },
  });

  res.status(201).json({ id: ef.id, status: "proposed" });
});

// DELETE /api/effects — сбросить все эффекты (для разработки)
router.delete("/", (req, res) => {
  db.prepare("DELETE FROM effects").run();
  broadcast("effects:reset", {});
  res.json({ ok: true });
});

// POST /api/effects/seed — загрузить seed-данные (массив эффектов)
router.post("/seed", (req, res) => {
  const effects = req.body;
  if (!Array.isArray(effects)) return res.status(400).json({ error: "Expected array" });

  const insert = db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((effs) => {
    for (const ef of effs) {
      insert.run(
        ef.id, ef.intent_id, ef.alpha, ef.target,
        ef.value != null ? JSON.stringify(ef.value) : null,
        ef.scope || "account", ef.parent_id || null,
        ef.status || "confirmed", ef.ttl || null,
        ef.context ? JSON.stringify(ef.context) : null,
        ef.created_at, ef.resolved_at || ef.created_at
      );
    }
  });

  insertMany(effects);
  broadcast("effects:reset", {}); // trigger reload on clients
  res.status(201).json({ ok: true, count: effects.length });
});

router.broadcast = broadcast;

module.exports = router;
