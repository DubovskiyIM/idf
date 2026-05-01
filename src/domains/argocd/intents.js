// src/domains/argocd/intents.js
import { ontology as imported } from "./imported.js";

/**
 * G-A-7 ✅ CLOSED (importer-openapi@0.13.0): grpc-gateway operationId
 * теперь auto-canonicalized в `pathToIntent` (ApplicationService_Create →
 * createApplication, ClusterService_RotateAuth → rotateClusterAuth и т.д.).
 *
 * Host больше не делает 53 переименования. Остаются 3 категории edge cases:
 *
 *  1. Plural naming: SDK даёт `list<Entity>` (singular), host projections
 *     используют `list<Entities>` (plural per Keycloak convention). Aliases
 *     выравнивают форму.
 *  2. Case mismatch: SDK сохраняет PascalCase из operationId (`GPGKey`);
 *     host projections ожидают `Gpgkey` (path-segment lowercase).
 *  3. Semantic overrides: SDK алгоритм не различает verb/noun, для
 *     `PodLogs2` / `CanI` / `GetUserInfo` host даёт более читаемые имена.
 */
const INTENT_RENAME = {
  // (1) Plural list — SDK singular → host plural
  listApplication:     "listApplications",
  listApplicationSet:  "listApplicationSets",
  listCluster:         "listClusters",
  listProject:         "listProjects",
  listRepository:      "listRepositories",
  listCertificate:     "listCertificates",
  listAccount:         "listAccounts",

  // (2) Case mismatch на GPGKey — SDK preserves operationId case
  createGPGKey:        "createGpgkey",
  readGPGKey:          "readGpgkey",
  removeGPGKey:        "removeGpgkey",
  listGPGKey:          "listGpgkeys",

  // (3) Semantic overrides (SDK heuristic не distinguishable verb/noun)
  canAccountI:             "readAccountCanI",
  readSessionUserInfo:     "readUserInfo",
  podApplicationLogs2:     "readApplicationPodLogs",
};

function renameIntents(imported) {
  const renamed = {};
  for (const [oldName, intent] of Object.entries(imported)) {
    const newName = INTENT_RENAME[oldName] || oldName;
    renamed[newName] = newName === oldName
      ? intent
      : { ...intent, _aliasOf: oldName };
  }
  return renamed;
}

export const INTENTS = renameIntents(imported.intents);
