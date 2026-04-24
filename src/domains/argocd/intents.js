// src/domains/argocd/intents.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 2 host-workaround для G-A-4 (grpc-gateway operationId naming).
 *
 * ArgoCD Swagger 2.0 использует operationId вида `<Service>_<Verb>` —
 * `ApplicationService_Create`, `ApplicationService_List`. Host-код и
 * row-action resolver'ы ожидают canonical `createApplication` /
 * `listApplications` (Keycloak / Gravitino convention). Без переименования
 * renderer не находит intent по canonical имени.
 *
 * Rename map — explicit для 30+ наиболее востребованных. Автоматический
 * SDK rename (SDK PR `importer-openapi.canonicalizeGrpcOperationIds`) —
 * более правильное решение, но требует rule-engine для irregular verbs
 * (Sync/Rollback/GetManifests/ListResourceEvents/...).
 *
 * Оригинальное имя сохраняется как alias (`intent._aliasOf`) для
 * отладки / обратной совместимости с server-логом.
 */
const INTENT_RENAME = {
  // Applications
  ApplicationService_Create:               "createApplication",
  ApplicationService_List:                 "listApplications",
  ApplicationService_Get:                  "readApplication",
  ApplicationService_Update:               "updateApplication",
  ApplicationService_Delete:               "removeApplication",
  ApplicationService_Patch:                "patchApplication",
  ApplicationService_Sync:                 "syncApplication",
  ApplicationService_Rollback:             "rollbackApplication",
  ApplicationService_TerminateOperation:   "terminateApplicationOperation",
  ApplicationService_RevisionMetadata:     "readApplicationRevisionMetadata",
  ApplicationService_ManagedResources:     "readApplicationManagedResources",
  ApplicationService_ResourceTree:         "readApplicationResourceTree",
  ApplicationService_GetManifests:         "readApplicationManifests",
  ApplicationService_ServerSideDiff:       "readApplicationServerSideDiff",
  ApplicationService_ListResourceEvents:   "listApplicationResourceEvents",
  ApplicationService_ListLinks:            "listApplicationLinks",
  ApplicationService_PodLogs2:             "readApplicationPodLogs",

  // Projects (AppProject CRD → короткое Project в UI)
  ProjectService_Create:                   "createProject",
  ProjectService_List:                     "listProjects",
  ProjectService_Get:                      "readProject",
  ProjectService_Update:                   "updateProject",
  ProjectService_Delete:                   "removeProject",

  // Clusters
  ClusterService_Create:                   "createCluster",
  ClusterService_List:                     "listClusters",
  ClusterService_Get:                      "readCluster",
  ClusterService_Update:                   "updateCluster",
  ClusterService_Delete:                   "removeCluster",
  ClusterService_RotateAuth:               "rotateClusterAuth",
  ClusterService_InvalidateCache:          "invalidateClusterCache",

  // Repositories
  RepositoryService_CreateRepository:      "createRepository",
  RepositoryService_ListRepositories:      "listRepositories",
  RepositoryService_Get:                   "readRepository",
  RepositoryService_Update:                "updateRepository",
  RepositoryService_DeleteRepository:      "removeRepository",
  RepositoryService_GetAppDetails:         "readRepositoryAppDetails",

  // ApplicationSets
  ApplicationSetService_Create:            "createApplicationSet",
  ApplicationSetService_List:              "listApplicationSets",
  ApplicationSetService_Get:               "readApplicationSet",
  ApplicationSetService_Delete:            "removeApplicationSet",
  ApplicationSetService_Generate:          "generateApplicationSet",

  // GPG / Certificates
  GPGKeyService_Create:                    "createGpgkey",
  GPGKeyService_List:                      "listGpgkeys",
  GPGKeyService_Get:                       "readGpgkey",
  GPGKeyService_Delete:                    "removeGpgkey",
  CertificateService_CreateCertificate:    "createCertificate",
  CertificateService_ListCertificates:     "listCertificates",
  CertificateService_DeleteCertificate:    "removeCertificate",

  // Accounts / Sessions
  AccountService_ListAccounts:             "listAccounts",
  AccountService_GetAccount:               "readAccount",
  AccountService_UpdatePassword:           "updateAccountPassword",
  AccountService_CreateToken:              "createAccountToken",
  AccountService_DeleteToken:              "removeAccountToken",
  AccountService_CanI:                     "readAccountCanI",
  SessionService_Create:                   "createSession",
  SessionService_Delete:                   "removeSession",
  SessionService_GetUserInfo:              "readUserInfo",
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
