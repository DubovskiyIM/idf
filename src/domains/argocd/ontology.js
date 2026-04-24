// src/domains/argocd/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 1 host-decl: 5 baseline-ролей для GitOps workflow. Importer не
 * извлекает RBAC из ArgoCD API (у ArgoCD RBAC model — свой policy CSV,
 * не security-scheme в swagger). Роли декларируются по таксономии §5:
 *
 *  - admin:     super-admin, может создавать Clusters/Repos/Projects
 *  - developer: деплоит Applications в свои Projects (owner-scoped)
 *  - deployer:  запускает sync/rollback (action-only, no CRUD)
 *  - viewer:    read-only по всему workspace
 *  - auditor:   read + audit-log (events/conditions history)
 */
const ARGOCD_ROLES = {
  admin: {
    name: "Администратор",
    base: "admin",
    description: "Полный доступ ко всему кластеру (argocd-admin)",
  },
  developer: {
    name: "Разработчик",
    base: "owner",
    description: "Создание и настройка Applications в своих проектах",
  },
  deployer: {
    name: "Деплоер",
    base: "owner",
    description: "Запуск sync/rollback/refresh без прав на конфигурацию",
  },
  viewer: {
    name: "Viewer",
    base: "viewer",
    description: "Read-only доступ к applications / clusters / projects",
  },
  auditor: {
    name: "Аудитор",
    base: "viewer",
    description: "Read-only + доступ к events/conditions timeline",
  },
};

export const ONTOLOGY = {
  entities: imported.entities,
  roles: ARGOCD_ROLES,
  invariants: imported.invariants || [],
  features: imported.features || {},
};
