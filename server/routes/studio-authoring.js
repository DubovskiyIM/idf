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

const { Router } = require("express");
const { initAuthoring, applyTurn, canFinalize } = require("../schema/authoringStateMachine.cjs");
const { buildMessages } = require("../schema/authoringPrompts.cjs");
const { callClaude } = require("../schema/claudeClient.cjs");

const sessions = new Map(); // domainId -> state

function makeStudioAuthoringRouter({ claudeClient } = {}) {
  const router = Router({ mergeParams: true });

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

    let llmResponse;
    try {
      const messages = buildMessages({
        state: state.state,
        spec: state.spec,
        userText,
        history: state.history,
      });
      llmResponse = await callClaude({ messages, client: claudeClient });
    } catch (err) {
      writeEvent("error", { message: err.message });
      return res.end();
    }

    const next = await applyTurn(state, { userText, llmResponse });
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

  // test-only: очистка всех сессий
  router._resetAll = () => sessions.clear();

  return router;
}

module.exports = { makeStudioAuthoringRouter, __sessions: sessions };
