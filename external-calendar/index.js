const express = require("express");
const cors = require("cors");
const data = require("./data.js");

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

app.get("/api/slots", (req, res) => {
  res.json(data.getAll());
});

app.post("/api/slots/:id/block", (req, res) => {
  const ok = data.block(req.params.id);
  if (ok) {
    console.log(`  [external] Заблокирован: ${req.params.id}`);
    res.json({ ok: true, slot: data.get(req.params.id) });
  } else {
    res.status(404).json({ error: "Слот не найден" });
  }
});

app.post("/api/slots/:id/unblock", (req, res) => {
  const ok = data.unblock(req.params.id);
  if (ok) {
    console.log(`  [external] Разблокирован: ${req.params.id}`);
    res.json({ ok: true, slot: data.get(req.params.id) });
  } else {
    res.status(404).json({ error: "Слот не найден" });
  }
});

app.delete("/api/slots/:id", (req, res) => {
  const ok = data.remove(req.params.id);
  if (ok) {
    console.log(`  [external] Удалён: ${req.params.id}`);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "Слот не найден" });
  }
});

app.listen(PORT, () => {
  const count = data.getAll().length;
  console.log(`Внешний календарь запущен: http://localhost:${PORT}`);
  console.log(`  ${count} слотов на неделю`);
  console.log(`  POST /api/slots/:id/block   — заблокировать`);
  console.log(`  POST /api/slots/:id/unblock — разблокировать`);
  console.log(`  DELETE /api/slots/:id        — удалить`);
});
