// src/domains/gravitino/domain.js
/**
 * Gravitino — metadata-catalog домен. Импортирован из Apache Gravitino
 * OpenAPI spec (docs/open-api/openapi.yaml) через importer-openapi.
 * Enrich через enricher-claude не сработал из-за Claude CLI 2.1.117
 * wire-format регрессии (docs/backlog.md §1.12) — продолжаем на
 * pre-enrich ontology.
 *
 * 14-й домен в IDF, используется как Gravitino-dogfood для SDK/adapter
 * polish (docs/superpowers/specs/2026-04-22-gravitino-dogfood-design.md,
 * локальный файл вне git).
 *
 * U-backend-exec-2: custom buildEffects для 11 modify-nested intents.
 * Generic SDK handler справляется с Create/Drop (intent.particles.effects =
 * replace/remove на target entity), но для setOwner / associateTags /
 * grantRole / enable | disable / linkModelVersion / cancelJob нужен
 * full-entity overwrite — используем α:"add" с тем же id (applyEffect
 * перезаписывает collections[type][id] = { ...ctx }).
 *
 * Targets — pluralized lower snake_case (как world keys: metalakes,
 * catalogs, schemas, tables, users, groups, roles, model_versions, jobs).
 *
 * U-fix-exec-signature (CRITICAL, 2026-05-01): SDK exec(intentId, ctx) —
 * 2 args, не 1. Все hubs передают flat ctx (entity + overrides + params).
 * Handlers здесь явно destructure нужное и через pickOverrides() сбрасывают
 * raw param-keys (metalake / catalog / schema / table / ...) — иначе они
 * попадают в context эффекта и загрязняют entity payload через fold.
 * grantRoleToUser/Group — entity передаётся как userEntity / groupEntity
 * (избегаем collision с param user/group).
 */
import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "gravitino";
export const DOMAIN_NAME = "Gravitino — metadata catalog";

/**
 * NESTED_INTENTS — список intent-id, для которых generic handler не
 * справится (modify nested field, не whole-entity replace). Для них
 * собираем full-entity overwrite через α:"add" с тем же id.
 *
 * U-fix-toggle-tabs: enable* и disable* intents удалены — их нет в
 * imported.js (Gravitino REST API не имеет таких endpoints). Toggle
 * In-Use идёт через alterMetalake и alterCatalog (PUT с full body) —
 * передаём inUse и enabled override в context.
 */
const NESTED_INTENTS = new Set([
  "setOwner",
  "associateTags",
  "associatePoliciesForObject",
  "grantRoleToUser",
  "grantRoleToGroup",
  "alterMetalake",
  "alterCatalog",
  "alterSchema",
  "alterTable",
  "linkModelVersion",
  "deleteModelVersion",
  "updateModelVersionAlias",
  "cancelJob",
]);

/**
 * PARAM_KEYS — raw URL-path параметры Gravitino REST API. Передаются hub'ами
 * в ctx (потому что engine не разделяет params и context — всё flat). Из
 * overrides для alter* их нужно убирать, чтобы не загрязнять entity payload.
 */
const PARAM_KEYS = new Set([
  "metalake", "catalog", "schema", "table", "model", "version", "name",
  "user", "group", "tag", "policy", "role",
  "metadataObjectType", "metadataObjectFullName",
  "jobId", "templateId", "fileset", "versionId",
]);

/**
 * pickOverrides — возвращает только authorial overrides (например inUse,
 * enabled, properties), исключая entity-special-keys и URL-path params.
 */
function pickOverrides(ctx) {
  const out = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (k === "entity" || k === "entityType" || k === "userEntity" || k === "groupEntity" || k === "version") continue;
    if (PARAM_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Helper: создаёт эффект с pluralized lowercase target (точное соответствие
 * world-keys из seed.js). α:"add" с тем же entity.id — overwrite семантика.
 */
function makeEffect(target, alpha, intentId, context) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    alpha,
    target,
    scope: "account",
    value: null,
    context,
  };
}

export function buildEffects(intentId, ctx = {}) {
  if (!NESTED_INTENTS.has(intentId)) return null; // → generic handler

  if (intentId === "setOwner") {
    // ctx: { entity, entityType (collection key), newOwnerName, ...params }
    if (!ctx.entity || !ctx.entityType) return null;
    return [makeEffect(ctx.entityType, "add", intentId, { ...ctx.entity, owner: ctx.newOwnerName })];
  }

  if (intentId === "associateTags") {
    // ctx: { entity, entityType, tags: [names], ...params }
    if (!ctx.entity || !ctx.entityType) return null;
    return [makeEffect(ctx.entityType, "add", intentId, { ...ctx.entity, tags: ctx.tags || [] })];
  }
  if (intentId === "associatePoliciesForObject") {
    if (!ctx.entity || !ctx.entityType) return null;
    return [makeEffect(ctx.entityType, "add", intentId, { ...ctx.entity, policies: ctx.policies || [] })];
  }

  if (intentId === "grantRoleToUser") {
    // ctx: { userEntity, roles: [names], ...params } — replace User.roles целиком.
    // U-fix-exec-signature: было ctx.user (full entity), теперь userEntity —
    // collision с raw param `user` (имя пользователя из URL-path).
    const u = ctx.userEntity;
    if (!u) return null;
    return [makeEffect("users", "add", intentId, { ...u, roles: ctx.roles || [] })];
  }
  if (intentId === "grantRoleToGroup") {
    const g = ctx.groupEntity;
    if (!g) return null;
    return [makeEffect("groups", "add", intentId, { ...g, roles: ctx.roles || [] })];
  }

  // alterMetalake / alterCatalog / alterSchema / alterTable — generic
  // overwrite c merged authorial overrides (inUse / enabled / properties).
  // ctx: { entity, ...overrides, ...rawParams }. pickOverrides() выкидывает
  // raw params (metalake / catalog / schema / table) — иначе они засоряют payload.
  if (intentId === "alterMetalake") {
    if (!ctx.entity) return null;
    return [makeEffect("metalakes", "add", intentId, { ...ctx.entity, ...pickOverrides(ctx) })];
  }
  if (intentId === "alterCatalog") {
    if (!ctx.entity) return null;
    return [makeEffect("catalogs", "add", intentId, { ...ctx.entity, ...pickOverrides(ctx) })];
  }
  if (intentId === "alterSchema") {
    if (!ctx.entity) return null;
    return [makeEffect("schemas", "add", intentId, { ...ctx.entity, ...pickOverrides(ctx) })];
  }
  if (intentId === "alterTable") {
    if (!ctx.entity) return null;
    return [makeEffect("tables", "add", intentId, { ...ctx.entity, ...pickOverrides(ctx) })];
  }

  if (intentId === "linkModelVersion") {
    // ctx: { version: {...}, ...params } — добавляем новую ModelVersion.
    if (!ctx.version) return null;
    const v = ctx.version;
    const id = v.id || `mv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return [makeEffect("model_versions", "add", intentId, { ...v, id })];
  }
  if (intentId === "deleteModelVersion") {
    // ctx: { versionId } — true remove.
    if (!ctx.versionId) return null;
    return [makeEffect("model_versions", "remove", intentId, { id: ctx.versionId })];
  }
  if (intentId === "updateModelVersionAlias") {
    // ctx: { version, aliases } — replace целиком ModelVersion.
    if (!ctx.version) return null;
    return [makeEffect("model_versions", "add", intentId, { ...ctx.version, aliases: ctx.aliases || [] })];
  }

  if (intentId === "cancelJob") {
    // ctx: { entity } — replace job c status=cancelled, endTime=now.
    if (!ctx.entity) return null;
    return [makeEffect("jobs", "add", intentId, { ...ctx.entity, status: "cancelled", endTime: new Date().toISOString() })];
  }

  return null;
}

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}
