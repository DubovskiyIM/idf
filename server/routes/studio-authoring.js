/**
 * Studio authoring routes.
 *
 * POST /api/studio/domain/:id/author/turn   — SSE stream нового turn'а
 * GET  /api/studio/domain/:id/author/state  — текущий state сессии
 * POST /api/studio/domain/:id/author/undo   — откат последнего turn'а
 * POST /api/studio/domain/:id/author/reset  — очистить сессию
 *
 * Sessions in-memory. При рестарте сервера теряются (acceptable для demo).
 */

const path = require("node:path");
const { Router } = require("express");
const { initAuthoring, applyTurn, canFinalize, applyManualSpec } = require("../schema/authoringStateMachine.cjs");
const { buildMessages } = require("../schema/authoringPrompts.cjs");
const { callClaude } = require("../schema/claudeClient.cjs");
const { finalizeDomain } = require("../schema/authoringCommit.cjs");
const { registerOntology } = require("../ontologyRegistry.cjs");
const { loadSpecFromFile, saveSpecToFile } = require("../schema/specSerializer.cjs");
const intentsModule = require("../intents.js");
const multer = require("multer");
const { saveAttachment, uploadToAnthropic, removeAttachment } = require("../schema/openapiAttach.cjs");
const STAGING_DIR = path.resolve(__dirname, "../../tmp/openapi-attachments");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const sessions = new Map(); // domainId -> state

function makeStudioAuthoringRouter({ claudeClient, targetDirOverride, anthropicClientFactory } = {}) {
  const router = Router({ mergeParams: true });

  const resolveTargetDir = (id) =>
    targetDirOverride
      ? targetDirOverride
      : path.resolve(__dirname, "../../src/domains", id);

  router.post("/:id/author/turn", async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "missing_domain_id" });
    const userText = String(req.body?.userText || "").trim();
    if (!userText) return res.status(400).json({ error: "missing_userText" });

    if (!sessions.has(id)) sessions.set(id, initAuthoring({ domainId: id }));
    const state = sessions.get(id);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const writeEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent("pending", { state: state.state, turnIndex: state.history.length });

    const attachments = state.pendingAttachment ? [state.pendingAttachment] : null;
    let llmResponse;
    try {
      const messages = buildMessages({
        state: state.state,
        spec: state.spec,
        userText,
        history: state.history,
        attachments,
      });
      const turnClient = claudeClient || (anthropicClientFactory ? anthropicClientFactory() : undefined);
      llmResponse = await callClaude({ messages, client: turnClient });
    } catch (err) {
      writeEvent("error", { message: err.message });
      return res.end();
    }

    const next = await applyTurn(state, { userText, llmResponse });
    // Attachment одноразовый — снимаем pending после первого turn'а
    if (state.pendingAttachment) {
      next.pendingAttachment = null;
    }
    sessions.set(id, next);

    writeEvent("response", {
      userFacing: llmResponse.userFacing || "",
      patch: llmResponse.patch || {},
      state: next.state,
      nextPrompt: next.nextPrompt,
      validationIssues: next.validationIssues,
      canFinalize: canFinalize(next),
      spec: next.spec,
    });
    writeEvent("done", { turnIndex: next.history.length });
    res.end();
  });

  router.get("/:id/author/state", (req, res) => {
    const id = String(req.params.id || "");
    const s = sessions.get(id);
    if (!s) return res.status(404).json({ error: "no_session", domainId: id });
    res.json({
      domainId: id,
      state: s.state,
      spec: s.spec,
      nextPrompt: s.nextPrompt,
      validationIssues: s.validationIssues,
      canFinalize: canFinalize(s),
      turnIndex: s.history.length,
    });
  });

  router.get("/:id/author/spec", async (req, res) => {
    const id = String(req.params.id || "");
    const session = sessions.get(id);
    if (session) {
      return res.json({
        source: "session",
        spec: session.spec,
        state: session.state,
        validationIssues: session.validationIssues,
        canFinalize: canFinalize(session),
      });
    }
    const filePath = path.join(resolveTargetDir(id), "domain.js");
    try {
      const spec = await loadSpecFromFile(filePath);
      return res.json({ source: "file", spec });
    } catch (err) {
      return res.status(404).json({ error: "no_spec", domainId: id, detail: err.message });
    }
  });

  router.put("/:id/author/spec", async (req, res) => {
    const id = String(req.params.id || "");
    const newSpec = req.body?.spec;
    const commit = req.body?.commit === true;
    if (!newSpec || typeof newSpec !== "object" || Array.isArray(newSpec)) {
      return res.status(400).json({ error: "invalid_spec" });
    }
    if (!sessions.has(id)) sessions.set(id, initAuthoring({ domainId: id }));
    const before = sessions.get(id);
    const next = applyManualSpec(before, newSpec);
    sessions.set(id, next);

    let committed = false;
    let writtenPath = null;
    if (commit) {
      if (!canFinalize(next)) {
        return res.status(400).json({
          error: "not_finalizable",
          state: next.state,
          validationIssues: next.validationIssues,
        });
      }
      const targetDir = req.body?.targetDir
        ? path.resolve(req.body.targetDir)
        : resolveTargetDir(id);
      writtenPath = path.join(targetDir, "domain.js");
      try {
        await saveSpecToFile(next.spec, writtenPath);
        try {
          registerOntology(id, next.spec.ONTOLOGY || {});
          intentsModule.registerIntents(next.spec.INTENTS || {}, id);
        } catch {
          // hot-reload failure — non-critical
        }
        sessions.set(id, { ...next, state: "committed" });
        committed = true;
      } catch (err) {
        return res.status(500).json({ error: "commit_failed", detail: err.message });
      }
    }
    res.json({
      ok: true,
      state: sessions.get(id).state,
      validationIssues: next.validationIssues,
      canFinalize: canFinalize(next),
      committed,
      path: writtenPath,
    });
  });

  router.post("/:id/author/undo", (req, res) => {
    const id = String(req.params.id || "");
    const s = sessions.get(id);
    if (!s || s.history.length === 0) {
      return res.status(400).json({ error: "nothing_to_undo" });
    }
    // Rebuild state from initAuthoring + all turns except last
    const trimmed = s.history.slice(0, -1);
    let rebuilt = initAuthoring({ domainId: id });
    for (const turn of trimmed) {
      // Use sync path (applyTurn is async, but doesn't await on anything beyond validatePartial)
      rebuilt = {
        ...rebuilt,
        spec: require("../schema/authoringStateMachine.cjs").mergePatch(rebuilt.spec, turn.llmResponse?.patch || null),
        state: turn.llmResponse?.nextState || rebuilt.state,
        nextPrompt: turn.llmResponse?.nextPrompt || rebuilt.nextPrompt,
        history: [...rebuilt.history, turn],
        validationIssues: [],
      };
    }
    // revalidate
    rebuilt.validationIssues = require("../schema/authoringStateMachine.cjs").validatePartial(rebuilt.spec);
    sessions.set(id, rebuilt);
    res.json({ ok: true, state: rebuilt.state, turnIndex: rebuilt.history.length, spec: rebuilt.spec });
  });

  router.post("/:id/author/reset", (req, res) => {
    const id = String(req.params.id || "");
    sessions.delete(id);
    res.json({ ok: true });
  });

  router.post("/:id/author/attach", upload.single("file"), async (req, res) => {
    const id = String(req.params.id || "");
    if (!req.file) return res.status(400).json({ error: "no_file" });
    if (!sessions.has(id)) sessions.set(id, initAuthoring({ domainId: id }));
    const session = sessions.get(id);
    let saved;
    try {
      saved = await saveAttachment({
        stagingDir: STAGING_DIR,
        sessionId: id,
        originalName: req.file.originalname,
        buffer: req.file.buffer,
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    let uploaded;
    try {
      const client = anthropicClientFactory ? anthropicClientFactory() : undefined;
      uploaded = await uploadToAnthropic({ filePath: saved.path, client });
    } catch (e) {
      await removeAttachment(saved.path).catch(() => {});
      return res.status(502).json({ error: "anthropic_upload_failed", detail: e.message });
    }
    // Cleanup local staging file — Anthropic уже хранит копию
    await removeAttachment(saved.path).catch(() => {});
    sessions.set(id, {
      ...session,
      state: "import_openapi",
      pendingAttachment: { fileId: uploaded.fileId, name: req.file.originalname, mediaType: saved.mediaType },
    });
    res.json({
      ok: true,
      fileId: uploaded.fileId,
      name: req.file.originalname,
      size: saved.size,
      state: "import_openapi",
    });
  });

  router.post("/:id/author/commit", async (req, res) => {
    const id = String(req.params.id || "");
    const state = sessions.get(id);
    if (!state) return res.status(404).json({ error: "no_session", domainId: id });
    if (!canFinalize(state)) {
      return res.status(400).json({
        error: "not_finalizable",
        state: state.state,
        validationIssues: state.validationIssues,
        message: "Нужны хотя бы 1 intent и 1 entity, и state preview или ontology_detail",
      });
    }

    const targetDir = req.body?.targetDir
      ? path.resolve(req.body.targetDir)
      : path.resolve(__dirname, "../../src/domains", id);

    let result;
    try {
      result = await finalizeDomain(state.spec, { targetDir });
    } catch (err) {
      return res.status(500).json({ error: "commit_failed", detail: err.message });
    }

    // Hot-reload: регистрируем ontology + intents сразу — агент/voice/document
    // endpoints начинают работать до рестарта сервера.
    try {
      registerOntology(id, state.spec.ONTOLOGY || {});
      intentsModule.registerIntents(state.spec.INTENTS || {}, id);
    } catch (err) {
      // commit файла прошёл, hot-reload нет — возвращаем ok=true + warning
      return res.json({
        ok: true,
        path: result.path,
        hotReloadWarning: err.message,
      });
    }

    // Перевести session в committed state
    sessions.set(id, { ...state, state: "committed" });

    res.json({
      ok: true,
      path: result.path,
      domainId: id,
      entityCount: Object.keys(state.spec.ONTOLOGY?.entities || {}).length,
      intentCount: Object.keys(state.spec.INTENTS || {}).length,
    });
  });

  // test-only: очистка всех сессий
  router._resetAll = () => sessions.clear();

  return router;
}

module.exports = { makeStudioAuthoringRouter, __sessions: sessions };
