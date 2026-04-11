/**
 * Agent layer — REST endpoint'ы для LLM-агента как равноправного
 * пользователя booking-домена. §17 манифеста.
 *
 * Route-префикс /api/agent/:domain/* константно подразумевает role="agent".
 * Первая реализация ограничена booking-доменом.
 *
 * Endpoints:
 *   GET  /api/agent/booking/schema        — intents + ontology (отфильтрованные)
 *   GET  /api/agent/booking/world         — folded world с row+field фильтром
 *   POST /api/agent/booking/exec/:intentId — sync exec с 200/409
 *
 * Auth: Bearer JWT через authMiddleware (server/auth.js).
 */

const { Router } = require("express");
const { authMiddleware, getUser } = require("../auth.js");
const { getOntology } = require("../ontologyRegistry.cjs");
const { getIntent } = require("../intents.js");
const { buildIntentSchema } = require("../schema/buildIntentSchema.cjs");
const { filterWorldForRole } = require("../schema/filterWorld.cjs");
const { buildBookingEffects } = require("../schema/buildBookingEffects.cjs");
const { parseCondition } = require("../schema/conditionParser.cjs");
const { foldWorld, validate } = require("../validator.js");
const { ingestEffect } = require("../effect-pipeline.js");
const db = require("../db.js");
const { v4: uuid } = require("uuid");

const DOMAIN = "booking";
const ROLE = "agent";

function makeAgentRouter(broadcast) {
  const router = Router();
  router.use(authMiddleware);

  // ============================================================
  // Helpers
  // ============================================================

  function getViewer(req) {
    const user = getUser(req.userId);
    return user
      ? { id: user.id, name: user.name, email: user.email }
      : { id: req.userId, name: "agent", email: req.userEmail };
  }

  function filterOntologyForRole(ontology, role) {
    const roleDef = ontology.roles?.[role];
    if (!roleDef) return null;
    const visibleFields = roleDef.visibleFields || {};
    const statusMapping = roleDef.statusMapping || {};
    const entities = {};
    for (const [entityName, entityDef] of Object.entries(ontology.entities || {})) {
      const fields = visibleFields[entityName];
      if (!fields) continue;
      entities[entityName] = {
        fields,
        statuses: entityDef.statuses || null
      };
      if (entityDef.ownerField) entities[entityName].ownerField = entityDef.ownerField;
      if (Object.keys(statusMapping).length > 0) {
        entities[entityName].statusMapping = statusMapping;
      }
    }
    return { entities };
  }

  // ============================================================
  // GET /schema
  // ============================================================

  router.get("/schema", (req, res) => {
    const ontology = getOntology(DOMAIN);
    if (!ontology) {
      return res.status(503).json({
        error: "ontology_unavailable",
        message: "Ontology для booking не зарегистрирована. Клиент должен POST /api/typemap?domain=booking."
      });
    }
    const allowedIds = ontology.roles?.[ROLE]?.canExecute || [];
    const intents = [];
    for (const id of allowedIds) {
      const intent = getIntent(id);
      if (!intent) continue;
      intents.push(buildIntentSchema(id, intent, ontology, ROLE));
    }
    const viewer = getViewer(req);
    console.log(`[agent] GET  /schema              ${viewer.id} → 200 (${intents.length} intents)`);
    res.json({
      domain: DOMAIN,
      role: ROLE,
      viewer,
      ontology: filterOntologyForRole(ontology, ROLE),
      intents
    });
  });

  // ============================================================
  // GET /world
  // ============================================================

  router.get("/world", (req, res) => {
    const ontology = getOntology(DOMAIN);
    if (!ontology) {
      return res.status(503).json({
        error: "ontology_unavailable",
        message: "Ontology для booking не зарегистрирована."
      });
    }
    const viewer = getViewer(req);
    const rawWorld = foldWorld();
    let filtered;
    try {
      filtered = filterWorldForRole(rawWorld, ontology, ROLE, viewer);
    } catch (err) {
      console.error("[agent] filterWorld error:", err);
      return res.status(500).json({ error: "internal_error", message: err.message });
    }
    const totalRows = Object.values(filtered).reduce((s, arr) => s + (arr?.length || 0), 0);
    console.log(`[agent] GET  /world               ${viewer.id} → 200 (${totalRows} rows)`);
    res.json({
      domain: DOMAIN,
      role: ROLE,
      viewer,
      world: filtered
    });
  });

  // ============================================================
  // POST /exec/:intentId — placeholder, реализуется в Task 12
  // ============================================================

  router.post("/exec/:intentId", (req, res) => {
    res.status(501).json({ error: "not_implemented" });
  });

  return router;
}

module.exports = { makeAgentRouter };
