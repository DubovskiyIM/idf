const express = require("express");
const fs = require("fs");
const path = require("path");
const { buildGraph } = require("../studio/graphBuilder.js");
const { createFileWatcher } = require("../studio/fileWatcher.js");
const { spawnClaude, isClaudeAvailable } = require("../studio/claudeProxy.js");
const { createDomainSkeleton } = require("../studio/domainCreator.js");
const { sluggify, existsInDomainsDir } = require("../studio/sluggify.js");

const router = express.Router();
const DOMAINS_DIR = path.resolve(__dirname, "..", "..", "src", "domains");

// Статус studio-возможностей. Клиент запрашивает при старте, чтобы понять
// доступен ли Claude (для hero-генерации и chat) и работает ли instance
// в read-only режиме (публичное демо без CLI).
router.get("/status", (_req, res) => {
  const claudeAvailable = isClaudeAvailable();
  res.json({
    claudeAvailable,
    readonly: !claudeAvailable,
    mode: claudeAvailable ? "authoring" : "readonly",
  });
});

const domainWatchers = new Map();

function getOrCreateWatcher(domainName) {
  if (domainWatchers.has(domainName)) return domainWatchers.get(domainName);
  const dir = path.join(DOMAINS_DIR, domainName);
  const w = createFileWatcher(dir);
  domainWatchers.set(domainName, w);
  return w;
}

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

router.get("/domain/:name/events", (req, res) => {
  const { name } = req.params;
  const dir = path.join(DOMAINS_DIR, name);
  if (!fs.existsSync(dir)) return res.status(404).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const watcher = getOrCreateWatcher(name);
  const onChange = (evt) => {
    res.write(`event: graph_invalidated\ndata: ${JSON.stringify(evt)}\n\n`);
  };
  watcher.on("change", onChange);

  const hb = setInterval(() => res.write(": hb\n\n"), 15000);
  req.on("close", () => {
    watcher.off("change", onChange);
    clearInterval(hb);
  });
});

router.post("/domain/new", express.json(), (req, res) => {
  if (!isClaudeAvailable()) {
    return res.status(403).json({ error: "readonly_mode", message: "Studio в read-only режиме: создание доменов недоступно." });
  }
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    createDomainSkeleton(name, description);
    res.json({ ok: true, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Hero onboarding: POST /api/studio/slug {description} →
// {slug, name, description}. Slug collision-free относительно src/domains/*.
// Фронт затем POST /domain/new c этим slug'ом.
router.post("/slug", express.json(), (req, res) => {
  const { description } = req.body || {};
  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "description required" });
  }
  const result = sluggify(description, { existsCheck: existsInDomainsDir(DOMAINS_DIR) });
  res.json({ slug: result.slug, name: result.name, description });
});

router.post("/chat", express.json(), async (req, res) => {
  if (!isClaudeAvailable()) {
    return res.status(403).json({ error: "readonly_mode", message: "Claude CLI недоступен: chat отключён в read-only режиме." });
  }
  const { domain, message, sessionId } = req.body || {};
  if (!domain || !message) return res.status(400).json({ error: "domain and message are required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const cwd = path.resolve(__dirname, "..", "..");
  const proc = spawnClaude({
    domain, message, sessionId, cwd,
    onEvent: (evt) => send(evt.type, evt),
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      try { proc.stop(); } catch {}
    }
  });
  await proc.done;
  send("end", {});
  res.end();
});

module.exports = router;
