const { Router } = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db.js");

const router = Router();

// --- Артефакты кристаллизации ---

router.get("/artifacts", (req, res) => {
  const rows = db.prepare("SELECT * FROM artifacts ORDER BY created_at DESC").all();
  res.json(rows);
});

router.post("/artifacts", (req, res) => {
  const { projection, code, intents_hash } = req.body;
  const id = uuid();
  const now = Date.now();
  db.prepare(
    "INSERT INTO artifacts (id, projection, code, intents_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projection, code, intents_hash, now);
  res.status(201).json({ id, projection, created_at: now });
});

// --- Онтология ---

router.get("/ontology", (req, res) => {
  const rows = db.prepare("SELECT * FROM ontology ORDER BY updated_at DESC").all();
  res.json(rows.map(r => ({ ...r, definition: JSON.parse(r.definition) })));
});

router.post("/ontology", (req, res) => {
  const { kind, name, definition } = req.body;
  const id = uuid();
  const now = Date.now();
  db.prepare(
    "INSERT INTO ontology (id, kind, name, definition, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, kind, name, JSON.stringify(definition), now, now);
  res.status(201).json({ id, kind, name, created_at: now });
});

router.put("/ontology/:id", (req, res) => {
  const { kind, name, definition } = req.body;
  const now = Date.now();
  db.prepare(
    "UPDATE ontology SET kind = ?, name = ?, definition = ?, updated_at = ? WHERE id = ?"
  ).run(kind, name, JSON.stringify(definition), now, req.params.id);
  res.json({ id: req.params.id, updated_at: now });
});

router.delete("/ontology/:id", (req, res) => {
  db.prepare("DELETE FROM ontology WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
