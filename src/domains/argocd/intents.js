// src/domains/argocd/intents.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 1 — host passthrough. Importer-openapi@0.11 импортирует 106 intents
 * с операционными именами `ApplicationService_Create`, `ApplicationService_List`
 * (ArgoCD использует grpc-gateway operationId naming). Читабельность
 * страдает — G-A-4 (host-level alias или SDK PR).
 *
 * На Stage 2 применим PARAM_ALIASES и canonical-name rewriting
 * (ApplicationService_Create → createApplication).
 */
export const INTENTS = imported.intents;
