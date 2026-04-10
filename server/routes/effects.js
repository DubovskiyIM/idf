const { Router } = require("express");
const db = require("../db.js");
const { validate, cascadeReject } = require("../validator.js");

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

  // Записываем как proposed
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

  // Стримим proposed
  broadcast("effect:proposed", { id: ef.id, intent_id: ef.intent_id });

  // Валидация (с опциональной задержкой)
  const resolve = () => {
    // Перечитываем эффект из БД для валидации (там context как строка)
    const stored = db.prepare("SELECT * FROM effects WHERE id = ?").get(ef.id);
    const result = validate(stored);
    const now = Date.now();

    if (result.valid) {
      db.prepare(
        "UPDATE effects SET status = 'confirmed', resolved_at = ? WHERE id = ?"
      ).run(now, ef.id);
      broadcast("effect:confirmed", { id: ef.id });

      // Планировать TTL-истечение если есть
      if (ef.ttl) {
        setTimeout(() => {
          const current = db.prepare("SELECT status FROM effects WHERE id = ?").get(ef.id);
          if (current && current.status === "confirmed") {
            const ttlNow = Date.now();
            db.prepare(
              "UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?"
            ).run(ttlNow, ef.id);
            const ttlCascaded = cascadeReject(ef.id);
            broadcast("effect:rejected", { id: ef.id, reason: "TTL expired", cascaded: ttlCascaded });
          }
        }, ef.ttl);
      }
    } else {
      db.prepare(
        "UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?"
      ).run(now, ef.id);

      const cascaded = cascadeReject(ef.id);
      broadcast("effect:rejected", { id: ef.id, reason: result.reason, cascaded });
    }
  };

  if (delay > 0) {
    setTimeout(resolve, delay);
  } else {
    resolve();
  }

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
