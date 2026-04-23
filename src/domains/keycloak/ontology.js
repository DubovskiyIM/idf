// src/domains/keycloak/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Host passthrough после Stage 5+ X1 cleanup (2026-04-23):
 * importer-openapi@0.11.0 делает всю heavy-lifting:
 * - G-K-1: mergeRepresentationDuplicates (idf-sdk#249)
 * - G-K-3: markEmbeddedTypes (idf-sdk#253)
 * - G-K-7: inferFieldRoles (idf-sdk#255)
 *
 * Остаётся только host-specific decl — 5 baseline-ролей для Keycloak RBAC.
 * Importer не извлекает RBAC из security-schemes (G-K-4 deferred) — роли
 * декларируются здесь по таксономии §5 manifesto. Открытое множество;
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

export const ONTOLOGY = {
  entities: imported.entities,
  roles: KEYCLOAK_ROLES,
  invariants: imported.invariants || [],
  features: imported.features || {},
};
