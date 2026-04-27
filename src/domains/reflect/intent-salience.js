/**
 * Salience overrides — A2 author audit pilot (idf #166 finding → SDK #434 → host activation).
 *
 * SDK classifyIntentRole ожидает numeric salience:
 *   ≥80 → primary, 60-79 → secondary, 30-59 → navigation, <30 → utility.
 *
 * Active при ontology.features.salienceDrivenRouting: true (в ontology.js).
 * Без feature flag в SDK assignToSlots* — annotations dormant.
 */

export const INTENT_SALIENCE = {
  create_activity: 80, // primary — creator-of-mainEntity для catalog activities
  create_tag: 80,      // primary — creator-of-mainEntity для catalog tags
};
