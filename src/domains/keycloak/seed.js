// src/domains/keycloak/seed.js
/**
 * Stage 1: пустой seed. Domain рендерится с пустыми каталогами,
 * проверяем UI на нулевом состоянии (empty states, hero-create CTA).
 *
 * Stage 4+: rich seed с 2-3 realms (master / staging / customer-app),
 * 5+ clients (внутренние / public / confidential), 10+ users, 4 IdP
 * (saml/oidc/google/github), realm roles + composite roles, и т.п.
 */
export function getSeedEffects() {
  return [];
}
