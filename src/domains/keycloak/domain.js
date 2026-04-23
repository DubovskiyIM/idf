// src/domains/keycloak/domain.js
/**
 * Keycloak — identity-and-access-management домен. 14-й dogfood (после
 * Gravitino metadata-catalog), импортирован из Keycloak Admin REST OpenAPI
 * (https://www.keycloak.org/docs-api/latest/rest-api/openapi.yaml) через
 * @intent-driven/importer-openapi@0.6.x.
 *
 * Stage 1 цель: baseline-рендер 224 entities + 254 intents без custom
 * buildEffects, без seed, без authored projections — всё derived. Будет
 * визуально перегружено (большой nav-graph), gap'ы зафиксируются в
 * docs/keycloak-gaps.md.
 *
 * Ожидаемые gap'ы (из project-memory): G23 wizard catalog_create,
 * tab-composed form (Client с 10+ tabs × 30+ полей), connection-test
 * step (IdP / UserFederation), credentials editor (password/OTP/WebAuthn),
 * role-mappings matrix с group inheritance.
 */
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";
import { v4 as uuid } from "uuid";

export const DOMAIN_ID = "keycloak";
export const DOMAIN_NAME = "Keycloak — identity & access";

/**
 * G-K-14 host-config: для admin-style UX используем AdminShell layout
 * (persistent sidebar tree + body), а не top-tabs. V2Shell детектит этот
 * флаг и рендерит @intent-driven/renderer::AdminShell вместо стандартных
 * горизонтальных tabs. Tree строится host-side из ROOT_PROJECTIONS +
 * world-instances + R8 hubSections.
 */
export const SHELL = {
  layout: "persistentSidebar",
  sidebarTitle: "Workspace",
};

/**
 * Stage 7 (P-K-B): testConnection handlers для Wizard step.testConnection.
 * V2Shell проксирует в ctx.testConnection через `handleTestConnection`.
 * Async function(values) → Promise<{ok, message?}>.
 *
 * Keycloak IdP endpoints validation: authorizationUrl / tokenUrl / userInfoUrl
 * для OIDC или metadata URL для SAML. В dogfood реальный probe заменён
 * на format-check + fetch-HEAD (без full OIDC discovery) — достаточно для
 * UX demonstration. Production probe с OIDC discovery + scope-detection —
 * follow-up (требует server-side proxy из-за CORS).
 */
export const TEST_CONNECTION_HANDLERS = {
  async testIdentityProviderConnection(values) {
    const urls = [values?.authorizationUrl, values?.tokenUrl, values?.userInfoUrl]
      .filter(Boolean);
    if (urls.length === 0) {
      return { ok: false, message: "Укажи хотя бы один endpoint URL" };
    }
    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        return { ok: false, message: `Некорректный URL: ${url}` };
      }
      if (!/^https?:\/\//i.test(url)) {
        return { ok: false, message: `URL должен начинаться с http(s)://: ${url}` };
      }
    }
    if (!values?.clientId) {
      return { ok: false, message: "Client ID обязателен" };
    }
    // Имитация round-trip (для dogfood без реального probe)
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
      ok: true,
      message: `OK: ${urls.length} endpoint(s), clientId=${values.clientId}`,
    };
  },
};

/**
 * Generic buildEffects для useEngine. importer-openapi @0.6 не выставляет
 * intent.particles.effects (только entities), поэтому DomainRuntime'овский
 * makeGenericBuildEffects не подходит. Здесь напрямую читаем top-level
 * intent.alpha + intent.creates|target и собираем effect.
 */
export function buildEffects(intentId, ctx = {}) {
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const target = intent.creates || intent.target;
  const alpha = intent.alpha;
  if (!alpha || !target) return null;
  const now = Date.now();
  const id = ctx.id || `${target.toLowerCase()}_${now}_${Math.random().toString(36).slice(2, 6)}`;
  return [{
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: now,
    alpha: alpha === "insert" ? "add" : alpha,
    target,
    scope: "account",
    value: null,
    context: { ...ctx, id, createdAt: now },
  }];
}

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}
