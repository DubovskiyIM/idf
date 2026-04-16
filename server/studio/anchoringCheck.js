function parseEntityDecls(list) {
  const map = {};
  for (const raw of list || []) {
    const m = /^(\w+)\s*:\s*(\w+)/.exec(raw);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function fieldsOf(entitySpec) {
  if (!entitySpec) return [];
  if (Array.isArray(entitySpec.fields)) return entitySpec.fields;
  return Object.keys(entitySpec.fields || {});
}

function findEntityCaseInsensitive(name, ONTOLOGY) {
  if (!name) return null;
  const entities = ONTOLOGY.entities || {};
  if (entities[name]) return name;
  const lower = name.toLowerCase();
  return Object.keys(entities).find((e) => e.toLowerCase() === lower) || null;
}

function isCollectionLike(target, ONTOLOGY) {
  if (target.includes(".")) return false;
  if (target === "drafts") return true;
  const entities = Object.keys(ONTOLOGY.entities || {});
  const lower = target.toLowerCase();
  return entities.some((e) => lower === e.toLowerCase() + "s" || lower === e.toLowerCase() + "es");
}

function checkAnchoring(intentId, intent, ONTOLOGY) {
  const warnings = [];
  const decls = parseEntityDecls(intent.particles?.entities);

  const effects = intent.particles?.effects || [];
  effects.forEach((eff, i) => {
    const target = typeof eff === "object" ? eff?.target : eff;
    if (!target || typeof target !== "string") {
      warnings.push({ intentId, kind: "effect-unanchored", severity: "error", index: i, message: `effect #${i}: no target` });
      return;
    }
    if (target.includes(".")) {
      const [head, field] = target.split(".");
      const entityTypeRaw = decls[head] || head;
      const entityType = findEntityCaseInsensitive(entityTypeRaw, ONTOLOGY);
      if (!entityType) {
        warnings.push({ intentId, kind: "effect-unanchored", severity: "error", index: i, message: `effect #${i}: entity "${head}" not declared` });
      } else {
        const spec = ONTOLOGY.entities[entityType];
        const fields = fieldsOf(spec);
        if (!fields.includes(field)) {
          warnings.push({ intentId, kind: "effect-unanchored", severity: "error", index: i, message: `effect #${i}: field "${field}" not in ${entityType}` });
        }
      }
    } else if (!isCollectionLike(target, ONTOLOGY)) {
      warnings.push({ intentId, kind: "effect-unanchored", severity: "warning", index: i, message: `effect #${i}: "${target}" doesn't resolve to collection or entity.field` });
    }
  });

  const witnesses = intent.particles?.witnesses || [];
  witnesses.forEach((w, i) => {
    if (!w || typeof w !== "string") return;
    const [head, ...rest] = w.split(".");
    const entityTypeRaw = decls[head] || head;
    const entityType = findEntityCaseInsensitive(entityTypeRaw, ONTOLOGY);
    if (!entityType) {
      warnings.push({ intentId, kind: "witness-unanchored", severity: "warning", index: i, message: `witness #${i}: "${head}" not declared in particles.entities` });
      return;
    }
    if (rest.length) {
      const spec = ONTOLOGY.entities[entityType];
      const fields = fieldsOf(spec);
      if (!fields.includes(rest[0]) && rest[0] !== "count") {
        warnings.push({ intentId, kind: "witness-unanchored", severity: "warning", index: i, message: `witness #${i}: field "${rest[0]}" not in ${entityType}` });
      }
    }
  });

  return warnings;
}

module.exports = { checkAnchoring };
