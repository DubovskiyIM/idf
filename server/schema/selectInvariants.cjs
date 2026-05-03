/**
 * Подбор релевантных инвариантов для конкретного intent'а — для агентского
 * schema. Цель: дать LLM-агенту короткий список правил, на которые этот
 * intent МОЖЕТ упасть. Не все инварианты домена, а только те, что реально
 * стрельнут при выполнении.
 *
 * Стратегия (B): пересечение (alpha intent'а) × (entity, на которую effect
 * пишет) × (kind инварианта).
 *
 *   referential   → relevant если intent делает α:add в entity с FK
 *   transition    → relevant если intent делает α:replace на entity.field
 *   cardinality   → relevant на add/replace в entity
 *   aggregate     → relevant на add/replace в entity или where-target entity
 *   expression    → relevant на add/replace/remove в entity (predicate runtime)
 *   role-capability → не возвращается (это другой layer, проверяется отдельно)
 *
 * Возвращает нормализованный массив для агента: { name, kind, entity,
 * severity, summary } — где summary это однострочное человекочитаемое
 * описание правила (для tool-description LLM-у).
 */

const ALPHA_NORMALIZED = {
  add: "add",
  create: "add",
  replace: "replace",
  update: "replace",
  remove: "remove",
  delete: "remove",
};

function normalizeAlpha(a) {
  return ALPHA_NORMALIZED[a] || a;
}

function collectTargetEntities(intent, ontology) {
  const entities = new Set();
  const effects = intent?.particles?.effects || [];
  for (const eff of effects) {
    const target = eff.target;
    if (typeof target !== "string") continue;
    const [head] = target.split(".");
    // target может быть entity ("Deal") или collection ("deals") — нормализуем
    // к entity-имени через лёгкий resolver: ищем в ontology.entities ключ,
    // совпадающий case-insensitive с head.
    const entityName = resolveEntityName(head, ontology);
    if (entityName) entities.add(entityName);
  }
  // intent.creates — fallback (entity без явного effect.target)
  if (typeof intent.creates === "string") {
    const norm = intent.creates.replace(/\s*\(.*\)\s*$/, "").trim();
    const entityName = resolveEntityName(norm, ontology);
    if (entityName) entities.add(entityName);
  }
  return entities;
}

/**
 * Возвращает Set из "Entity.field" пар, на которые intent делает replace.
 * Используется transition-invariant'ом (он relevant только если меняем
 * именно тот field, который под whitelist'ом).
 */
function collectReplacedFields(intent, ontology) {
  const out = new Set();
  const effects = intent?.particles?.effects || [];
  for (const eff of effects) {
    const alpha = normalizeAlpha(eff.α || eff.alpha);
    if (alpha !== "replace") continue;
    const target = eff.target;
    if (typeof target !== "string" || !target.includes(".")) continue;
    const [head, field] = target.split(".");
    const entityName = resolveEntityName(head, ontology);
    if (entityName && field) out.add(`${entityName}.${field}`);
  }
  return out;
}

function resolveEntityName(name, ontology) {
  if (!name || !ontology?.entities) return null;
  if (ontology.entities[name]) return name;
  const lower = name.toLowerCase();
  for (const key of Object.keys(ontology.entities)) {
    if (key.toLowerCase() === lower) return key;
    // collection-form: bookings → Booking
    if (key.toLowerCase() + "s" === lower) return key;
    if (key.toLowerCase() + "es" === lower) return key;
    if (key.toLowerCase().replace(/y$/, "ies") === lower) return key;
  }
  return null;
}

function collectAlphas(intent) {
  const effects = intent?.particles?.effects || [];
  const alphas = new Set();
  for (const eff of effects) {
    const a = eff.α || eff.alpha;
    if (a) alphas.add(normalizeAlpha(a));
  }
  return alphas;
}

function isRelevant(inv, alphas, entities, replacedFields) {
  const kind = inv.kind;

  if (kind === "role-capability") return false;

  if (kind === "referential") {
    if (!alphas.has("add") && !alphas.has("replace")) return false;
    const fromEntity = (inv.from || "").split(".")[0];
    return entities.has(fromEntity);
  }

  if (kind === "transition") {
    // transition relevant только если intent делает replace ровно на
    // entity.field инварианта (не на другой field той же entity).
    return replacedFields.has(`${inv.entity}.${inv.field}`);
  }

  if (kind === "cardinality") {
    if (!alphas.has("add") && !alphas.has("replace")) return false;
    return entities.has(inv.entity);
  }

  if (kind === "aggregate") {
    if (!alphas.has("add") && !alphas.has("replace")) return false;
    // aggregate может быть привязан и к from-entity, и к target-entity
    const fromEntity = (inv.from || "").split(".")[0];
    const targetEntity = (inv.target || "").split(".")[0];
    return entities.has(fromEntity) || entities.has(targetEntity);
  }

  if (kind === "expression") {
    if (!alphas.has("add") && !alphas.has("replace") && !alphas.has("remove")) return false;
    return entities.has(inv.entity);
  }

  return false;
}

function summarizeWhere(where) {
  if (!where || typeof where !== "object") return "";
  const parts = Object.entries(where)
    .filter(([k]) => !k.startsWith("$"))
    .map(([k, v]) => {
      if (typeof v === "string" && v.startsWith("$")) return `${k}=<${v.slice(1)}>`;
      return `${k}=${JSON.stringify(v)}`;
    });
  return parts.length ? ` where (${parts.join(", ")})` : "";
}

function summarize(inv) {
  switch (inv.kind) {
    case "referential": {
      return `${inv.from} must reference existing ${inv.to}`;
    }
    case "transition": {
      const list = (inv.transitions || [])
        .map(([from, to]) => `${from}→${to}`)
        .join(", ");
      return `${inv.entity}.${inv.field} transitions allowed: ${list}`;
    }
    case "cardinality": {
      const groupBy = inv.groupBy ? ` per ${inv.groupBy}` : "";
      const where = summarizeWhere(inv.where);
      const min = inv.min != null ? `min ${inv.min}` : "";
      const max = inv.max != null ? `max ${inv.max}` : "";
      const bounds = [min, max].filter(Boolean).join(", ") || "row count rule";
      return `${inv.entity}: ${bounds}${groupBy}${where}`;
    }
    case "aggregate": {
      const where = summarizeWhere(inv.where);
      return `${inv.target} = ${inv.op || "sum"}(${inv.from})${where}`;
    }
    case "expression": {
      return inv.message || `row-level rule on ${inv.entity}`;
    }
    default:
      return inv.name || inv.kind;
  }
}

function normalizeForAgent(inv) {
  const entity =
    inv.entity || (inv.from && inv.from.split(".")[0]) || (inv.target && inv.target.split(".")[0]) || null;
  return {
    name: inv.name,
    kind: inv.kind,
    entity,
    severity: inv.severity || "error",
    summary: summarize(inv),
  };
}

function selectRelevantInvariants(intent, ontology) {
  const invariants = (ontology && ontology.invariants) || [];
  if (!Array.isArray(invariants) || invariants.length === 0) return [];

  const alphas = collectAlphas(intent);
  const entities = collectTargetEntities(intent, ontology);
  const replacedFields = collectReplacedFields(intent, ontology);
  if (entities.size === 0 || alphas.size === 0) return [];

  return invariants
    .filter(inv => isRelevant(inv, alphas, entities, replacedFields))
    .map(normalizeForAgent);
}

module.exports = {
  selectRelevantInvariants,
  // экспорт internals для unit-тестов
  _internals: {
    resolveEntityName,
    collectAlphas,
    collectTargetEntities,
    collectReplacedFields,
    isRelevant,
    summarize,
  },
};
