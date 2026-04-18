/**
 * Domain audit — проверяет домены на соответствие планке lifequest.
 *
 * 10 проверок: онтология (5) + интенты (5). Возвращает gaps-объекты
 * с полем `kind`. CLI: `node scripts/domain-audit.mjs --all | --domain <name>`.
 *
 * Spec: docs/superpowers/specs/2026-04-18-domains-to-lifequest-bar-design.md
 */

export function checkFieldsTyped(ontology) {
  const gaps = [];
  for (const [name, entity] of Object.entries(ontology.entities || {})) {
    if (Array.isArray(entity.fields)) {
      gaps.push({ kind: "fields-array-form", entity: name });
    }
  }
  return gaps;
}
