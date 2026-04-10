/**
 * Стабильный хэш входа кристаллизации.
 * Используется для инкрементальности (§16) — детект устаревших артефактов.
 */
export function hashInputs(INTENTS, PROJECTIONS, ONTOLOGY) {
  const parts = [
    Object.keys(INTENTS).sort().join(","),
    Object.keys(PROJECTIONS).sort().join(","),
    Object.keys(ONTOLOGY.entities || {}).sort().join(","),
  ];
  return parts.join("|");
}
