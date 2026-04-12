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
const { computeAlgebra } = require("../schema/intentAlgebra.cjs");
const { _registry: ALL_INTENTS } = require("../intents.js");
const { filterWorldForRole } = require("../schema/filterWorld.cjs");
const { buildBookingEffects } = require("../schema/buildBookingEffects.cjs");
const { parseCondition } = require("../schema/conditionParser.cjs");
const { foldWorld, validate } = require("../validator.js");
const { ingestEffect } = require("../effect-pipeline.js");
const db = require("../db.js");
const { v4: uuid } = require("uuid");

const DOMAIN = "booking";
const ROLE = "agent";

/**
 * Валидация параметров запроса против schema-параметров.
 * Strict mode: неожиданные параметры отвергаются.
 */
function validateParams(params, schemaParams) {
  const issues = [];
  const expected = new Set(schemaParams.map(p => p.name));

  // Unexpected keys (strict)
  for (const key of Object.keys(params || {})) {
    if (!expected.has(key)) {
      issues.push({ parameter: key, code: "unexpected", message: `параметр ${key} не описан в schema` });
    }
  }

  // Required + type checks
  for (const p of schemaParams) {
    const value = params?.[p.name];
    if (value == null) {
      if (p.required) {
        issues.push({ parameter: p.name, code: "required", message: `${p.name} обязателен` });
      }
      continue;
    }
    if (p.type === "number" && typeof value !== "number") {
      issues.push({ parameter: p.name, code: "type", expected: "number", got: typeof value });
    }
    if ((p.type === "text" || p.type === "textarea" || p.type === "entityRef") && typeof value !== "string") {
      issues.push({ parameter: p.name, code: "type", expected: "string", got: typeof value });
    }
  }

  return issues;
}

/**
 * Обогащение 409 rejection'а: парсит reason обратно в AST.
 * actualValue пока не резолвится — это TODO.
 */
function enrichFailedCondition(reason) {
  if (!reason) return null;
  const match = reason.match(/Условие не выполнено:\s*(.+)$/);
  if (!match) return null;
  const parsed = parseCondition(match[1]);
  if (!parsed) return null;
  return { ...parsed, actualValue: null };
}

/**
 * Поиск созданной сущности в массиве effects (первый add-эффект).
 */
function findCreatedEntity(effects) {
  for (const eff of effects) {
    if (eff.alpha === "add" && eff.context?.id) {
      return { collection: eff.target, id: eff.context.id };
    }
  }
  return null;
}

/**
 * Обёртка массива эффектов в batch-эффект.
 */
function wrapInBatch(effects, intentId, viewerId) {
  if (effects.length === 1) return effects[0];
  return {
    id: uuid(),
    intent_id: intentId,
    alpha: "batch",
    target: effects[0].target.split(".")[0],
    value: effects.map(e => ({
      intent_id: e.intent_id,
      alpha: e.alpha,
      target: e.target,
      value: e.value,
      context: e.context
    })),
    scope: "account",
    parent_id: null,
    context: { agentId: viewerId, batchSize: effects.length },
    created_at: Date.now(),
    status: "proposed"
  };
}

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

    // Вычисляем алгебру ОДИН раз над всеми зарегистрированными intents
    // (не только canExecute) — relations могут ссылаться на intent'ы вне
    // canExecute, это правильное поведение для агентского планирования.
    const algebra = computeAlgebra(ALL_INTENTS, ontology);

    const allowedIds = ontology.roles?.[ROLE]?.canExecute || [];
    const intents = [];
    for (const id of allowedIds) {
      const intent = getIntent(id);
      if (!intent) continue;
      intents.push(buildIntentSchema(id, intent, ontology, ROLE, algebra[id]));
    }
    const viewer = getViewer(req);
    console.log(`[agent] GET  /schema              ${viewer.id} → 200 (${intents.length} intents, algebra)`);
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
  // POST /exec/:intentId
  // ============================================================

  router.post("/exec/:intentId", (req, res) => {
    const intentId = req.params.intentId;
    const params = req.body || {};

    const ontology = getOntology(DOMAIN);
    if (!ontology) {
      return res.status(503).json({ error: "ontology_unavailable" });
    }

    const allowedIds = ontology.roles?.[ROLE]?.canExecute || [];
    if (!allowedIds.includes(intentId)) {
      const viewer = getViewer(req);
      console.log(`[agent] POST /exec/${intentId} ${viewer.id} → 403 not_allowed`);
      return res.status(403).json({
        error: "intent_not_allowed",
        intentId,
        role: ROLE,
        message: `Интент ${intentId} не доступен для роли ${ROLE}`
      });
    }

    const intent = getIntent(intentId);
    if (!intent) {
      return res.status(404).json({ error: "intent_not_found", intentId });
    }

    // Валидация параметров
    const schema = buildIntentSchema(intentId, intent, ontology, ROLE);
    const issues = validateParams(params, schema.parameters);
    if (issues.length > 0) {
      return res.status(400).json({ error: "parameter_validation", intentId, issues });
    }

    // Сборка эффектов
    const viewer = getViewer(req);
    const world = foldWorld();
    const effects = buildBookingEffects(intentId, params, viewer, world);
    if (!effects || effects.length === 0) {
      return res.status(400).json({
        error: "build_failed",
        intentId,
        reason: "Не удалось собрать эффекты — проверь, что все referenced сущности существуют и в правильном состоянии"
      });
    }

    // Батч или одиночный — оборачиваем
    const effectToPost = wrapInBatch(effects, intentId, viewer.id);

    // Sync ingest
    ingestEffect(effectToPost, {
      broadcast,
      delay: 0
    });

    // Чтение финального статуса из БД
    const stored = db.prepare("SELECT status, resolved_at FROM effects WHERE id = ?").get(effectToPost.id);

    if (!stored) {
      return res.status(500).json({ error: "internal_error", message: "effect не найден после ingest" });
    }

    if (stored.status === "confirmed") {
      const createdEntity = findCreatedEntity(effects);
      console.log(`[agent] POST /exec/${intentId} ${viewer.id} → 200 confirmed ${effectToPost.id}`);
      return res.status(200).json({
        id: effectToPost.id,
        intentId,
        status: "confirmed",
        effects: effects.map(e => ({
          id: e.id, alpha: e.alpha, target: e.target,
          value: e.value, context: e.context
        })),
        createdEntity
      });
    }

    // Rejected — reason надо вычислить повторно через validate
    const effectFromDb = db.prepare("SELECT * FROM effects WHERE id = ?").get(effectToPost.id);
    const result = validate(effectFromDb);
    const reason = result.reason || "unknown";
    const failedCondition = enrichFailedCondition(reason);

    console.log(`[agent] POST /exec/${intentId} ${viewer.id} → 409 rejected (${reason})`);
    return res.status(409).json({
      id: effectToPost.id,
      intentId,
      status: "rejected",
      reason,
      failedCondition,
      cascaded: []
    });
  });

  return router;
}

module.exports = { makeAgentRouter };
