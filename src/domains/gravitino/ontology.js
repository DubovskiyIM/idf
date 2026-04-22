// src/domains/gravitino/ontology.js
import { ontology as imported } from "./imported.js";

export const ONTOLOGY = {
  entities: imported.entities,
  roles: imported.roles || { owner: { base: "owner" } },
  invariants: imported.invariants || [],
  features: imported.features || {},
};
