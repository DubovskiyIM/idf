const express = require("express");
const fs = require("fs");
const path = require("path");
const { buildGraph } = require("../studio/graphBuilder.js");

const router = express.Router();
const DOMAINS_DIR = path.resolve(__dirname, "..", "..", "src", "domains");

router.get("/domains", async (_req, res) => {
  try {
    const names = fs
      .readdirSync(DOMAINS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const domains = [];
    for (const name of names) {
      try {
        const g = await buildGraph(name);
        domains.push({
          name,
          intents: g.nodes.filter((n) => n.kind === "intent").length,
          entities: g.nodes.filter((n) => n.kind === "entity").length,
          warnings: g.warnings.length,
        });
      } catch (err) {
        domains.push({ name, intents: 0, entities: 0, error: err.message });
      }
    }
    res.json({ domains });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/domain/:name/graph", async (req, res) => {
  const { name } = req.params;
  const dir = path.join(DOMAINS_DIR, name);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: `domain "${name}" not found` });
  try {
    const graph = await buildGraph(name);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.post("/domain/:name/validate", async (req, res) => {
  const { name } = req.params;
  try {
    const graph = await buildGraph(name);
    res.json({
      warnings: graph.warnings,
      ok: graph.warnings.filter((w) => w.severity === "error").length === 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
