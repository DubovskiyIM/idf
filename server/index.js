const express = require("express");
const cors = require("cors");
const effectsRouter = require("./routes/effects.js");
const artifactsRouter = require("./routes/artifacts.js");

const { seed } = require("./seed.js");

const app = express();
const PORT = 3001;

seed();

app.use(cors());
app.use(express.json());

app.use("/api/effects", effectsRouter);
app.use("/api", artifactsRouter);

app.listen(PORT, () => {
  console.log(`IDF сервер запущен: http://localhost:${PORT}`);
  console.log(`  POST /api/effects        — создать эффект`);
  console.log(`  GET  /api/effects        — все эффекты`);
  console.log(`  GET  /api/effects/stream — SSE-стрим`);
  console.log(`  POST /api/artifacts      — сохранить артефакт`);
  console.log(`  GET  /api/ontology       — онтология`);
});
