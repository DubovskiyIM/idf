// src/domains/keycloak/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 2 host-fix для G-K-1: importer-openapi@0.6 создаёт 25
 * duplicate-пар базовое имя / `XRepresentation` (Realm + RealmRepresentation,
 * Client + ClientRepresentation, ...). Path-derived и schema-derived
 * генерируют разные entity names. intent.target использует короткое
 * имя (`Realm`, 6 intents), но fields fully-populated только в
 * `RealmRepresentation` (152 поля vs 4 в `Realm`).
 *
 * Host-merge: для каждой пары — переносим fields/relations из
 * `XRepresentation` в `X` (с приоритетом полным версии — Representation
 * как source-of-truth), затем удаляем `XRepresentation` из ontology.
 * Intents продолжают targetиться на короткое имя `X`.
 *
 * X1: после SDK PR `importer-openapi.mergeRepresentationDuplicates` этот
 * блок удаляется.
 */
function mergeRepresentationDuplicates(entities) {
  const merged = { ...entities };
  let mergedCount = 0;
  for (const name of Object.keys(entities)) {
    const repName = name + "Representation";
    if (!merged[repName]) continue;
    const base = merged[name];
    const rep = merged[repName];
    merged[name] = {
      ...base,
      ...rep,
      fields: { ...(base.fields || {}), ...(rep.fields || {}) },
      relations: { ...(base.relations || {}), ...(rep.relations || {}) },
    };
    delete merged[repName];
    mergedCount++;
  }
  if (typeof globalThis !== "undefined" && globalThis.__keycloakDedupCount === undefined) {
    globalThis.__keycloakDedupCount = mergedCount;
  }
  return merged;
}

/**
 * Stage 2 host-fix для G-K-7 (semantic field-roles): importer-openapi
 * не выводит fieldRole — UI рендерит password как plain-text, datetime
 * как ISO-string, email без mailto-link. Pattern-bank нескольких
 * primitive'ов (secret-mask, date-relative, email-link) требует
 * fieldRole hint.
 *
 * Heuristic-based, conservative. Не трогаем lifespan/policy-поля
 * (`refreshTokenMaxReuse` — это число секунд, не секрет).
 */
function applyFieldRoleHints(entities) {
  const SECRET_FIELD_PATTERNS = [
    /^password$/i, /^secret$/i, /^token$/i, /^.*Password$/, /^store_?password$/i,
    /^key_?password$/i, /^registrationAccessToken$/, /^client_?secret$/i,
  ];
  const DATETIME_PATTERNS = [
    /^.*[Dd]ate$/, /^.*[Tt]imestamp$/, /^expir.*$/i, /^notBefore$/, /^updated_at$/,
    /^sentDate$/, /^lastUpdatedDate$/, /^createdTimestamp$/,
  ];
  const EMAIL_PATTERNS = [/^email$/];
  const URL_PATTERNS = [/^.*[Uu]rl$/, /^redirectUris?$/, /^webOrigins$/];

  const matchAny = (name, patterns) => patterns.some(p => p.test(name));

  const result = {};
  for (const [entityName, entity] of Object.entries(entities)) {
    const fields = entity.fields || {};
    const next = {};
    for (const [fieldName, field] of Object.entries(fields)) {
      let fieldRole = field.fieldRole;
      if (!fieldRole && matchAny(fieldName, SECRET_FIELD_PATTERNS)) fieldRole = "secret";
      else if (!fieldRole && matchAny(fieldName, DATETIME_PATTERNS)) fieldRole = "datetime";
      else if (!fieldRole && matchAny(fieldName, EMAIL_PATTERNS)) fieldRole = "email";
      else if (!fieldRole && matchAny(fieldName, URL_PATTERNS)) fieldRole = "url";
      next[fieldName] = fieldRole ? { ...field, fieldRole } : field;
    }
    result[entityName] = { ...entity, fields: next };
  }
  return result;
}

/**
 * Stage 2 host-fix для G-K-3 (частичный): помечаем 100 orphan entities
 * (нет intent.target на них) как `entity.kind: "embedded"` — nested-only
 * types, не для top-level UI. crystallize_v2 не должен делать catalog
 * для таких. ROOT_PROJECTIONS-filter и так отбрасывает не-catalog'и.
 */
function markOrphansEmbedded(entities, intents) {
  const targetSet = new Set();
  for (const i of Object.values(intents)) {
    if (typeof i?.target === "string") targetSet.add(i.target);
  }
  const result = {};
  // importer-openapi дефолтом ставит entity.kind = "internal" — для
  // целей этого host-fix считаем "internal" эквивалентом "не задан".
  for (const [name, entity] of Object.entries(entities)) {
    const isOrphan = !targetSet.has(name);
    const isUnclassified = !entity.kind || entity.kind === "internal";
    if (isOrphan && isUnclassified) {
      result[name] = { ...entity, kind: "embedded" };
    } else {
      result[name] = entity;
    }
  }
  return result;
}

/**
 * Stage 2 host-fix для G-K-4: importer-openapi не извлекает RBAC из
 * Keycloak's security-schemes (realm-management client roles). Декларируем
 * 5 базовых ролей по таксономии §5 manifesto. Открытое множество —
 * dogfood-минимум для filterWorldForRole + role-aware nav (forRoles).
 */
const KEYCLOAK_ROLES = {
  admin: {
    name: "Администратор",
    base: "admin",
    description: "Полный доступ ко всем realms (super-admin master realm)",
  },
  realmAdmin: {
    name: "Администратор realm'а",
    base: "owner",
    description: "Полный доступ в пределах одного realm (realm-management.realm-admin)",
  },
  userMgr: {
    name: "Менеджер пользователей",
    base: "owner",
    description: "CRUD на User/Group/Role в realm'е (realm-management.manage-users)",
  },
  viewer: {
    name: "Аудитор",
    base: "viewer",
    description: "Read-only по всему realm + audit-log (view-realm + view-events)",
  },
  self: {
    name: "Пользователь",
    base: "owner",
    description: "Self-service: свой профиль, credentials, sessions, consent",
  },
};

const _step1 = mergeRepresentationDuplicates(imported.entities);
const _step2 = applyFieldRoleHints(_step1);
const _step3 = markOrphansEmbedded(_step2, imported.intents);

export const ONTOLOGY = {
  entities: _step3,
  roles: KEYCLOAK_ROLES,
  invariants: imported.invariants || [],
  features: imported.features || {},
};
