// src/domains/keycloak/projections.js
import { deriveProjections } from "@intent-driven/core";
import { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

/**
 * Stage 1: пусто — все projections derived через crystallize_v2.
 * ROOT_PROJECTIONS вычисляется один раз при загрузке модуля: берём id'ы
 * derived catalog/dashboard, чтобы V2Shell показал хоть какие-то top-tabs.
 *
 * Будет ОЧЕНЬ много (вероятно 80+ ID), nav-shell перегружен — это
 * первый ожидаемый gap для каталога keycloak-gaps.md (G-K-1: nav-graph
 * перегружен).
 *
 * Stage 2: authored 12-14 проекций для canonical entities + явный
 * ROOT_PROJECTIONS со семантической группировкой.
 */
export const PROJECTIONS = {};

const _derived = deriveProjections(INTENTS, ONTOLOGY);
export const ROOT_PROJECTIONS = Object.entries(_derived)
  .filter(([, p]) => (p?.kind === "catalog" || p?.kind === "dashboard"))
  .map(([id]) => id);
