const express = require("express");
const cors = require("cors");
const effectsRouter = require("./routes/effects.js");
const artifactsRouter = require("./routes/artifacts.js");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const workflowsRouter = require("./routes/workflows.js");

app.use("/api/effects", effectsRouter);
app.use("/api", artifactsRouter);
app.use("/api/workflows", workflowsRouter);

const { startSync, setBroadcast } = require("./boundary.js");
const { executeWorkflow, setBroadcast: setExecBroadcast } = require("./executor.js");
setBroadcast(effectsRouter.broadcast);
setExecBroadcast(effectsRouter.broadcast);
startSync();

// Endpoint для обновления маппинга типов из онтологии домена
const { updateTypeMap } = require("./validator.js");
app.post("/api/typemap", (req, res) => {
  const map = updateTypeMap(req.body);
  console.log(`  [typemap] Обновлён: ${Object.keys(map).length} типов`);
  res.json({ ok: true, types: Object.keys(map).length });
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

app.listen(PORT, () => {
  console.log(`IDF сервер запущен: http://localhost:${PORT}`);
  console.log(`  POST /api/effects        — создать эффект`);
  console.log(`  GET  /api/effects        — все эффекты`);
  console.log(`  GET  /api/effects/stream — SSE-стрим`);
  console.log(`  POST /api/artifacts      — сохранить артефакт`);
  console.log(`  GET  /api/ontology       — онтология`);
});
