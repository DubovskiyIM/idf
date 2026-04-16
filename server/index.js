const express = require("express");
const cors = require("cors");
const effectsRouter = require("./routes/effects.js");
const artifactsRouter = require("./routes/artifacts.js");
const { router: entitiesRouter, registerOntology } = require("./routes/entities.js");
const { registerOntology: registerFullOntology } = require("./ontologyRegistry.cjs");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
// Лимит body 10mb — дефолтные 100kb режут data URL'ы для картинок (аватары).
// Большие изображения всё равно должны идти через upload-API (M4+), но для
// M3-прототипа inline data URL покрывает все realistic-кейсы.
app.use(express.json({ limit: "10mb" }));

const workflowsRouter = require("./routes/workflows.js");

app.use("/api/effects", effectsRouter);
app.use("/api", artifactsRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api/entities", entitiesRouter);

// Agent layer — §17 манифеста
const { makeAgentRouter } = require("./routes/agent.js");
app.use("/api/agent/:domain", makeAgentRouter(effectsRouter.broadcast));

// §26.3: document как равноправная материализация (§1 manifesto).
// /api/document/:domain/:projection → HTML (print-ready) | JSON-граф.
const { makeDocumentRouter } = require("./routes/document.js");
app.use("/api/document/:domain", makeDocumentRouter());

// §1: voice — 4-я базовая материализация (v1.6.2 prototype).
// /api/voice/:domain/:projection → JSON turns | SSML | plain text.
const { makeVoiceRouter } = require("./routes/voice.js");
app.use("/api/voice/:domain", makeVoiceRouter());

// LLM enrichment — кристаллизация через Claude API
const crystallizeRouter = require("./routes/crystallize.js");
app.use("/api/crystallize", crystallizeRouter);

const { startSync, setBroadcast } = require("./boundary.js");
const { executeWorkflow, setBroadcast: setExecBroadcast } = require("./executor.js");
setBroadcast(effectsRouter.broadcast);
setExecBroadcast(effectsRouter.broadcast);
startSync();

// Endpoint для обновления маппинга типов из онтологии домена.
// Если в query передан ?domain=X, онтология также регистрируется в реестре
// entities router'а (для серверного поиска через searchConfig) И в
// ontologyRegistry (для агентского слоя — /api/agent/:domain/*).
const { updateTypeMap } = require("./validator.js");
app.post("/api/typemap", (req, res) => {
  const map = updateTypeMap(req.body);
  const domain = req.query.domain;
  let registeredEntities = 0;
  if (domain && req.body?.entities) {
    registeredEntities = registerOntology(domain, req.body);
    // Side-effect: агентский слой читает полную ontology (с roles,
    // visibleFields, ownerField) из этого реестра.
    registerFullOntology(domain, req.body);
  }
  const roleCount = Object.keys(req.body?.roles || {}).length;
  console.log(`  [typemap] Обновлён: ${Object.keys(map).length} типов${domain ? `, ontology[${domain}]: ${registeredEntities} сущностей, ${roleCount} ролей` : ""}`);
  res.json({ ok: true, types: Object.keys(map).length, entities: registeredEntities, roles: roleCount });
});

// Endpoint для регистрации намерений домена — заменяет hardcoded
// INTENT_CONDITIONS в старом validator.js. Клиент POST'ит свой INTENTS-объект
// при монтировании домена, сервер использует его для валидации условий.
const { registerIntents } = require("./intents.js");
app.post("/api/intents", (req, res) => {
  const intents = req.body?.intents || req.body;
  const domain = req.query.domain;
  if (!domain) {
    return res.status(400).json({
      error: "domain_required",
      message: "POST /api/intents requires ?domain=X query param"
    });
  }
  const count = registerIntents(intents, domain);
  console.log(`  [intents] Зарегистрирован domain=${domain}: ${count} намерений`);
  res.json({ ok: true, domain, registered: count });
});

// Endpoint для исполнения workflow
app.post("/api/execute/:workflowId", async (req, res) => {
  try {
    res.json({ ok: true, status: "started" });
    // Исполнение асинхронно — результаты стримятся через SSE
    executeWorkflow(req.params.workflowId).catch(err => {
      console.error("  [executor] Ошибка:", err.message);
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Auth routes
const authRouter = require("./routes/auth.js");
app.use("/api/auth", authRouter);

// Studio routes (авторская среда)
const studioRouter = require("./routes/studio.js");
app.use("/api/studio", studioRouter);

// Production: раздаём Vite build из dist/
const path = require("path");
const fs = require("fs");
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: все не-API маршруты → index.html
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
  console.log("  [static] Раздаём dist/ (production mode)");
}

// WebSocket
const http = require("http");
const server = http.createServer(app);
const { setupWebSocket } = require("./ws.js");
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`IDF сервер запущен: http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`  POST /api/auth/register  — регистрация`);
  console.log(`  POST /api/auth/login     — вход`);
  console.log(`  GET  /api/auth/users     — все пользователи`);
  console.log(`  POST /api/effects        — создать эффект`);
  console.log(`  GET  /api/effects/stream — SSE-стрим`);
});

// ─── Темпоральный scheduler v2 (§4 спеки, Task 10 plan) ───
{
  const { TimerQueue, hydrateFromWorld, fireDue } = require("./timeEngine.js");
  const { foldWorld } = require("./validator.js");
  const { ingestEffect: ingest2 } = require("./effect-pipeline.js");
  require("./systemIntents.cjs"); // регистрирует schedule_timer/revoke_timer в _system

  global.__timerQueue = new TimerQueue();
  try {
    hydrateFromWorld(global.__timerQueue, foldWorld());
    console.log(`  [timer] hydrated ${global.__timerQueue.size()} active timer(s) из Φ`);
  } catch (e) {
    console.error("  [timer] hydrate error:", e);
  }

  const TIMER_TICK_MS = Number(process.env.IDF_TIMER_TICK_MS || 1000);
  setInterval(() => {
    try {
      fireDue(global.__timerQueue, Date.now(), {
        ingestEffect: (ef) => ingest2(ef, { broadcast: () => {}, delay: 0 }),
        foldWorld,
      });
    } catch (e) {
      console.error("[timer] tick error:", e);
    }
  }, TIMER_TICK_MS);
}

// ─── Cron-rules v1 → schedule v2 (self-rescheduling timers) ───
// Старый формат "daily:09:00" / "weekly:sun:20:00" переводится на timeEngine:
// при boot создаётся первый ScheduledTimer на next slot. Re-emission после
// firing — honest border (см. §26 open items / Task 13 validation report):
// для этого нужно либо системное правило на revoke_timer, либо спец-handler
// в fireDue. В прототипе нет живых cron-rules, формальная миграция достаточна.
//
// Fallback: IDF_DISABLE_CRON_MIGRATION=1 оставляет старый polling.
{
  const db = require("./db.js");
  const { ingestEffect } = require("./effect-pipeline.js");
  const { getAllOntologies } = require("./ontologyRegistry.cjs");

  if (process.env.IDF_DISABLE_CRON_MIGRATION === "1") {
    // ── LEGACY path: старый 60s polling ──
    const { evaluateScheduledRules } = require("./ruleEngine.js");
    const { getIntent } = require("./intents.js");
    setInterval(async () => {
      try {
        const results = evaluateScheduledRules(new Date(), { getAllOntologies, getIntent, db });
        for (const { effect } of results) {
          await ingestEffect(effect, { broadcast: () => {}, delay: 0 });
        }
        if (results.length > 0) console.log(`[schedule] fired ${results.length} scheduled rule(s)`);
      } catch (e) {
        console.error("[schedule] error:", e);
      }
    }, 60 * 1000);
  } else {
    // ── NEW path: cron → schedule_timer ──
    const { cronToFirstFiresAt, parseSchedule } = require("./ruleEngine.js");
    setTimeout(() => {
      try {
        const ontologies = getAllOntologies();
        let migrated = 0;
        for (const [domain, ont] of Object.entries(ontologies || {})) {
          for (const rule of (ont?.rules || [])) {
            if (!rule.schedule) continue;
            const parsed = parseSchedule(rule.schedule);
            const firesAt = cronToFirstFiresAt(parsed, Date.now());
            if (firesAt == null) continue;
            ingestEffect({
              id: `cron_migr_${domain}_${rule.id}_${Date.now()}`,
              intent_id: "schedule_timer",
              alpha: "add",
              target: "ScheduledTimer",
              value: null,
              scope: "account",
              context: {
                id: `cron_${domain}_${rule.id}`,
                firesAt,
                fireIntent: rule.action || rule.fireIntent,
                triggerEventKey: `cron:${domain}:${rule.id}`,
                cronSchedule: rule.schedule, // для self-respawn в fireDue
              },
              created_at: Date.now(),
            }, { broadcast: () => {}, delay: 0 });
            migrated++;
          }
        }
        if (migrated > 0) console.log(`  [cron-migration] перенесено ${migrated} cron-rule(s) на timeEngine`);
      } catch (e) {
        console.error("  [cron-migration] error:", e);
      }
    }, 1000);
  }
}
