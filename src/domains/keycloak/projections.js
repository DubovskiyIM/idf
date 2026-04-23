// src/domains/keycloak/projections.js
import { deriveProjections } from "@intent-driven/core";
import { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

/**
 * Stage 3 host-fix для G-K-2 + G-K-5: explicit canonical whitelist для
 * ROOT_PROJECTIONS. Operation-as-entity (Activate/Deactivate/MoveAfter/
 * Localization/Copy/Import/Export/...) после Stage 2 dedup всё ещё
 * деривируются как catalog'и — операции на parent выглядят как
 * collections в OpenAPI path-graph'е. Whitelist даёт чистый nav-bar
 * 12 canonical модулей вместо 20 mixed catalog'ов.
 *
 * X1: после SDK PR `importer-openapi.detectActionEndpoints` (G-K-2)
 * — operation-noise исчезнет автоматически.
 */

const CANONICAL_ENTITIES = [
  "Realm", "Client", "User", "Group", "Role", "IdentityProvider",
  "ClientScope", "Component", "Organization", "Workflow",
  "AuthenticationFlow", "Event",
];

export const PROJECTIONS = {};

const _derived = deriveProjections(INTENTS, ONTOLOGY);

// Whitelist: только canonical catalog'и + dashboard'ы.
// Catalog'и с mainEntity вне CANONICAL_ENTITIES — отбрасываем как noise.
export const ROOT_PROJECTIONS = Object.entries(_derived)
  .filter(([, p]) => {
    if (p?.kind === "dashboard") return true;
    if (p?.kind !== "catalog") return false;
    return CANONICAL_ENTITIES.includes(p.mainEntity);
  })
  .map(([id]) => id);
