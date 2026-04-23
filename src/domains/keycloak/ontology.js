// src/domains/keycloak/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 1: passthrough. Никакого host-enrichment. Все 224 entities
 * (включая representation-helpers вроде MultivaluedHashMap, MappingsRep)
 * попадают в ONTOLOGY как есть — gap-каталог покажет, какие нужно
 * скрывать / hub-absorb / помечать как nested-only.
 */

export const ONTOLOGY = {
  entities: imported.entities,
  roles: imported.roles || { viewer: { base: "viewer" } },
  invariants: imported.invariants || [],
  features: imported.features || {},
};
