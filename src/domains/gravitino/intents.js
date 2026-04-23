// src/domains/gravitino/intents.js
import { ontology as imported } from "./imported.js";

/**
 * Host-level intent enrichment.
 *
 * Gravitino OpenAPI path convention: `/metalakes/{metalake}/users/{user}/...`.
 * Importer-openapi генерирует intent.parameters с именами по path-params
 * ({user} → intent.parameters.user). Но projection.idParam использует
 * convention `<entity>Id` (userId, groupId, roleId, catalogId, ...) —
 * совпадает с synthetic FK-полями от importer-openapi@0.5.0 path-derived
 * FK synthesis.
 *
 * Mismatch: intent параметры — `user`/`group`/`role`/..., idParam поля —
 * `userId`/`groupId`/`roleId`. Catalog-archetype не распознаёт intent
 * как per-item (row-action) для user_list, потому что param-имя
 * не совпадает с idParam.
 *
 * Host fix: алиасить parameter `user` → `userId` (и аналоги) чтобы
 * catalog-archetype поставил grantRoleToUser / revokeRoleFromUser
 * (и group-аналоги) как row-actions. Дублируем, не переименовываем —
 * существующие params сохраняются, добавляем alias.
 */

const PARAM_ALIASES = {
  // entity-name-суффикс → canonical <entity>Id
  metalake: "metalakeId",
  catalog:  "catalogId",
  schema:   "schemaId",
  table:    "tableId",
  fileset:  "filesetId",
  topic:    "topicId",
  model:    "modelId",
  version:  "versionId",
  role:     "roleId",
  user:     "userId",
  group:    "groupId",
  tag:      "tagId",
  policy:   "policyId",
};

function aliasParameters(intents) {
  const result = {};
  for (const [id, intent] of Object.entries(intents)) {
    const params = intent?.parameters;
    if (!params || typeof params !== "object") {
      result[id] = intent;
      continue;
    }
    const nextParams = { ...params };
    let changed = false;
    for (const [paramName, paramDef] of Object.entries(params)) {
      const canonical = PARAM_ALIASES[paramName];
      if (canonical && !nextParams[canonical]) {
        nextParams[canonical] = { ...paramDef, aliasOf: paramName };
        changed = true;
      }
    }
    result[id] = changed ? { ...intent, parameters: nextParams } : intent;
  }
  return result;
}

/**
 * Target remap для intent'ов, которые семантически модифицируют parent
 * entity, но importer назвал entity по response-shape (Grant/Revoke).
 *
 * Gravitino API: `POST /metalakes/{m}/users/{user}/roles` — этот intent
 * модифицирует User (его role assignments), но importer назвал target
 * "Grant" (из response schema). Для catalog-archetype row-action'ов
 * intent должен targetить User, иначе он не попадёт в user_list
 * overlays/toolbar.
 *
 * Key: intent id (или regex) → entity override. Явный whitelist вместо
 * heuristic'ов чтобы не сломать semantics для invest/sales и т.п.
 */
const TARGET_REMAP = {
  grantRoleToUser:    "User",
  revokeRoleFromUser: "User",
  grantRoleToGroup:   "Group",
  revokeRoleFromGroup:"Group",
};

function remapTargets(intents) {
  const result = {};
  for (const [id, intent] of Object.entries(intents)) {
    const override = TARGET_REMAP[id];
    result[id] = override ? { ...intent, target: override, originalTarget: intent.target } : intent;
  }
  return result;
}

export const INTENTS = remapTargets(aliasParameters(imported.intents));
