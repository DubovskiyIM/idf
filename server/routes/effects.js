const { Router } = require("express");
const db = require("../db.js");
const { validate, cascadeReject, foldWorld } = require("../validator.js");
const { ingestEffect } = require("../effect-pipeline.js");
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
