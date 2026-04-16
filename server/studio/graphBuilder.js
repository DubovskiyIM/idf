const path = require("path");
const { pathToFileURL } = require("url");
const { checkAnchoring } = require("./anchoringCheck.js");

function normalizeFields(fields) {
  if (Array.isArray(fields)) {
    return fields.map((name) => ({ name, type: "unknown" }));
  }
  return Object.entries(fields || {}).map(([name, spec]) => ({
    name,
    type: spec?.type || "unknown",
    label: spec?.label,
    read: spec?.read,
    write: spec?.write,
  }));
}

async function importDomain(domainName) {
  const entry = path.resolve(__dirname, "..", "..", "src", "domains", domainName, "domain.js");
  const url = pathToFileURL(entry).href + `?t=${Date.now()}`;
  return await import(url);
}

function findEntityByHead(head, entityTypes) {
  const lower = head.toLowerCase();
  return [...entityTypes].find((e) => e.toLowerCase() === lower);
}

function findEntityByFieldBase(field, entityTypes) {
  const base = field.toLowerCase().replace(/id$/, "");
  return [...entityTypes].find((e) => e.toLowerCase() === base);
}

async function buildGraph(domainName) {
  const mod = await importDomain(domainName);
  const ONTOLOGY = mod.ONTOLOGY || {};
  const INTENTS = mod.INTENTS || {};
  const PROJECTIONS = mod.PROJECTIONS || {};

  const nodes = [];
  const edges = [];
  const entityTypes = new Set(Object.keys(ONTOLOGY.entities || {}));

  // Entity nodes + ownership/reference edges
  for (const [entityName, entity] of Object.entries(ONTOLOGY.entities || {})) {
    nodes.push({
      id: `entity:${entityName}`,
      kind: "entity",
      name: entityName,
      entityKind: entity.type || "internal",
      ownerField: entity.ownerField || null,
      fields: normalizeFields(entity.fields),
      statuses: entity.statuses || null,
    });

    const fieldsObj = typeof entity.fields === "object" && !Array.isArray(entity.fields) ? entity.fields : {};

    if (entity.ownerField && fieldsObj[entity.ownerField]) {
      const targetEntity = findEntityByFieldBase(entity.ownerField, entityTypes);
      if (targetEntity && targetEntity !== entityName) {
        edges.push({
          id: `own:${entityName}->${targetEntity}`,
          kind: "ownership",
          source: `entity:${entityName}`,
          target: `entity:${targetEntity}`,
          field: entity.ownerField,
        });
      }
    }

    for (const [fieldName, spec] of Object.entries(fieldsObj)) {
      if (spec?.type === "entityRef" && fieldName !== entity.ownerField) {
        const targetEntity = findEntityByFieldBase(fieldName, entityTypes);
        if (targetEntity && targetEntity !== entityName) {
          edges.push({
            id: `ref:${entityName}->${targetEntity}:${fieldName}`,
            kind: "reference",
            source: `entity:${entityName}`,
            target: `entity:${targetEntity}`,
            field: fieldName,
          });
        }
      }
    }
  }

  // Intent nodes + particle edges
  for (const [intentId, intent] of Object.entries(INTENTS)) {
    nodes.push({
      id: `intent:${intentId}`,
      kind: "intent",
      name: intent.name || intentId,
      intentId,
      particles: intent.particles || {},
      antagonist: intent.antagonist || null,
      creates: intent.creates || null,
    });

    const decls = parseEntityDecls(intent.particles?.entities);

    const effects = intent.particles?.effects || [];
    effects.forEach((eff, i) => {
      const target = typeof eff === "object" ? eff?.target : eff;
      const nodeId = resolveTargetToNodeId(target, decls, entityTypes);
      edges.push({
        id: `effect:${intentId}:${i}`,
        kind: "effect-particle",
        source: `intent:${intentId}`,
        target: nodeId || `unresolved:${target}`,
        raw: eff,
        index: i,
      });
    });

    const witnesses = intent.particles?.witnesses || [];
    witnesses.forEach((w, i) => {
      const nodeId = resolveWitnessToNodeId(w, decls, entityTypes);
      edges.push({
        id: `witness:${intentId}:${i}`,
        kind: "witness-particle",
        source: `intent:${intentId}`,
        target: nodeId || `unresolved:${w}`,
        raw: w,
        index: i,
      });
    });
  }

  // Role nodes + capability edges
  for (const [roleId, role] of Object.entries(ONTOLOGY.roles || {})) {
    nodes.push({
      id: `role:${roleId}`,
      kind: "role",
      name: roleId,
      base: role.base || null,
      scope: role.scope || null,
      preapproval: role.preapproval || null,
      canInvoke: role.canInvoke || role.canExecute || [],
      canSee: role.canSee || null,
    });
    const caps = role.canInvoke || role.canExecute || [];
    for (const intentId of caps) {
      edges.push({
        id: `cap:${roleId}->${intentId}`,
        kind: "role-capability",
        source: `role:${roleId}`,
        target: `intent:${intentId}`,
      });
    }
  }

  // Projection nodes + source edges
  for (const [projId, proj] of Object.entries(PROJECTIONS)) {
    nodes.push({
      id: `projection:${projId}`,
      kind: "projection",
      name: projId,
      archetype: proj.archetype || proj.kind || "unknown",
      source: proj.source || proj.entity || null,
    });
    const sourceEntity = proj.source || proj.entity;
    if (sourceEntity && entityTypes.has(sourceEntity)) {
      edges.push({
        id: `proj:${projId}->${sourceEntity}`,
        kind: "projection-source",
        source: `projection:${projId}`,
        target: `entity:${sourceEntity}`,
      });
    }
  }

  const warnings = [];
  for (const [intentId, intent] of Object.entries(INTENTS)) {
    warnings.push(...checkAnchoring(intentId, intent, ONTOLOGY));
  }

  return { domain: domainName, nodes, edges, warnings };
}

function parseEntityDecls(list) {
  const map = {};
  for (const raw of list || []) {
    const m = /^(\w+)\s*:\s*(\w+)/.exec(raw);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function resolveTargetToNodeId(target, decls, entityTypes) {
  if (!target || typeof target !== "string") return null;
  if (target.includes(".")) {
    const [head] = target.split(".");
    const entityType = decls[head] || findEntityByHead(head, entityTypes);
    if (entityType && entityTypes.has(entityType)) return `entity:${entityType}`;
    return null;
  }
  return `collection:${target}`;
}

function resolveWitnessToNodeId(witness, decls, entityTypes) {
  if (!witness || typeof witness !== "string") return null;
  const head = witness.split(".")[0];
  const entityType = decls[head] || findEntityByHead(head, entityTypes);
  if (entityType && entityTypes.has(entityType)) return `entity:${entityType}`;
  return null;
}

module.exports = { buildGraph };
