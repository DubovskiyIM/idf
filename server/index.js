const express = require("express");
const cors = require("cors");
const effectsRouter = require("./routes/effects.js");
const artifactsRouter = require("./routes/artifacts.js");
const { router: entitiesRouter, registerOntology } = require("./routes/entities.js");

const app = express();
const PORT = 3001;

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

const { startSync, setBroadcast } = require("./boundary.js");
const { executeWorkflow, setBroadcast: setExecBroadcast } = require("./executor.js");
setBroadcast(effectsRouter.broadcast);
setExecBroadcast(effectsRouter.broadcast);
startSync();

// Endpoint для обновления маппинга типов из онтологии домена.
// Если в query передан ?domain=X, онтология также регистрируется в реестре
// entities router'а (для серверного поиска через searchConfig).
const { updateTypeMap } = require("./validator.js");
app.post("/api/typemap", (req, res) => {
  const map = updateTypeMap(req.body);
  const domain = req.query.domain;
  let registeredEntities = 0;
  if (domain && req.body?.entities) {
    registeredEntities = registerOntology(domain, req.body);
  }
  console.log(`  [typemap] Обновлён: ${Object.keys(map).length} типов${domain ? `, ontology[${domain}]: ${registeredEntities} сущностей` : ""}`);
  res.json({ ok: true, types: Object.keys(map).length, entities: registeredEntities });
});

// Endpoint для регистрации намерений домена — заменяет hardcoded
// INTENT_CONDITIONS в старом validator.js. Клиент POST'ит свой INTENTS-объект
// при монтировании домена, сервер использует его для валидации условий.
const { registerIntents } = require("./intents.js");
app.post("/api/intents", (req, res) => {
  const intents = req.body?.intents || req.body;
  const count = registerIntents(intents);
  console.log(`  [intents] Зарегистрировано: ${count} намерений`);
  res.json({ ok: true, registered: count });
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
