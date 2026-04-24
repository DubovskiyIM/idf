// src/domains/argocd/domain.js
/**
 * ArgoCD — GitOps для Kubernetes. 16-й полевой тест, status-driven admin
 * class (после Keycloak 15-й IAM CRUD). Импортирован из ArgoCD OpenAPI
 * через @intent-driven/importer-openapi@0.11+.
 *
 * Источник: https://raw.githubusercontent.com/argoproj/argo-cd/master/assets/swagger.json
 * Формат: Swagger 2.0 (!), host-side конвертируется в OpenAPI 3.0 через
 * swagger2openapi перед import'ом (см. scripts/argocd-reimport.mjs).
 *
 * Stage 1 цель: baseline-рендер 300 entities + 106 intents. Ожидаемые gap'ы
 * (fix'ятся на Stage 2-4 через host + SDK PRs):
 *
 *  - G-A-1: K8s CRD naming `v<ver><Name>` не dedup'ится в `<Name>`.
 *    intents ссылаются на target="Application", но entity только
 *    `v1alpha1Application`. Нужно SDK mergeK8sCrdDuplicates или host alias.
 *
 *  - G-A-2: markEmbeddedTypes помечает K8s root CRDs embedded. Top-level
 *    `v1alpha1Application/AppProject/Cluster` должны быть non-embedded.
 *
 *  - G-A-3: Status-driven primitives — `sync.status` / `health.status` /
 *    `conditions[]` требуют новый `statusBadge` primitive и
 *    `conditions-timeline` pattern.
 *
 *  - G-A-4: Inline children — `Application.status.resources[]` (K8s Pods/
 *    Deployments как inline child array, не через FK). Новый class gap.
 *
 *  - G-A-5: Deeply-nested spec (source.helm.parameters[], syncPolicy.*)
 *    требует либо tabbed form, либо YAML-editor fallback.
 */
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";
import { v4 as uuid } from "uuid";

export const DOMAIN_ID = "argocd";
export const DOMAIN_NAME = "ArgoCD — GitOps для Kubernetes";

/**
 * AdminShell layout — persistent sidebar + body, как Keycloak. ArgoCD
 * Web UI — classic dashboard/админка, не top-tabs product.
 */
export const SHELL = {
  layout: "persistentSidebar",
  sidebarTitle: "ArgoCD",
};

/**
 * Generic buildEffects — intent.alpha + intent.creates/target → effect.
 * Идентично Keycloak (importer-openapi не выставляет particles.effects
 * на уровне DomainRuntime-friendly shape).
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
