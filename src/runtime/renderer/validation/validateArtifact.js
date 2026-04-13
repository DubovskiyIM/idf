/**
 * Проверка инвариантов артефакта v2 (§5.5 дизайна).
 * Возвращает { ok: boolean, errors: string[] }.
 */

const KNOWN_ARCHETYPES = ["feed", "catalog", "detail", "dashboard", "canvas", "form", "wizard"];
const REQUIRED_SLOTS_BY_ARCHETYPE = {
  feed:      ["body", "composer"],
  catalog:   ["body"],
  detail:    ["body"],
  dashboard: ["body"],
  canvas:    ["body"],
  form:      ["body"],
  wizard:    [],
};
const KNOWN_PARAMETER_TYPES = [
  "text", "textarea", "datetime", "url", "email", "tel",
  "number", "file", "image", "multiImage", "select", "entityPicker", "assetPicker", "multiSelect",
  "entityRef", "enum", "boolean",
];

export function validateArtifact(artifact) {
  const errors = [];

  if (!artifact || typeof artifact !== "object") {
    return { ok: false, errors: ["artifact is not an object"] };
  }

  if (artifact.version !== 2) {
    errors.push(`version must be 2, got ${artifact.version}`);
  }
  if (!artifact.projection) errors.push("projection is required");
  if (!artifact.archetype) errors.push("archetype is required");
  else if (!KNOWN_ARCHETYPES.includes(artifact.archetype)) {
    errors.push(`unknown archetype: ${artifact.archetype}`);
  }
  const hasSlots = artifact.slots && typeof artifact.slots === "object";
  if (!hasSlots) {
    errors.push("slots is required and must be an object");
  }

  if (hasSlots) {
    // Обязательные слоты для архетипа
    const required = REQUIRED_SLOTS_BY_ARCHETYPE[artifact.archetype] || [];
    for (const slotName of required) {
      if (!artifact.slots[slotName]) {
        errors.push(`slot "${slotName}" is required for archetype "${artifact.archetype}"`);
      }
    }

    // Дубликаты key в overlay
    const overlay = Array.isArray(artifact.slots.overlay) ? artifact.slots.overlay : [];
    const keys = new Set();
    for (const o of overlay) {
      if (!o.key) {
        errors.push(`overlay entry missing "key": ${JSON.stringify(o).slice(0, 80)}`);
        continue;
      }
      if (keys.has(o.key)) errors.push(`duplicate overlay key: ${o.key}`);
      keys.add(o.key);
    }

    // Параметр-типы в formModal и bulkWizard
    for (const o of overlay) {
      if (o.type === "formModal" || o.type === "bulkWizard") {
        const params = o.parameters || [];
        for (const p of params) {
          if (p.control && !KNOWN_PARAMETER_TYPES.includes(p.control)) {
            errors.push(`unknown parameter control type: "${p.control}" in overlay ${o.key}`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
