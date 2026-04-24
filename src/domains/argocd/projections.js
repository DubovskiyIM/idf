// src/domains/argocd/projections.js
// Stage 1: пустой whitelist — все проекции derived из intents + ontology.
// На Stage 3 добавим canonical ROOT_PROJECTIONS + authored bodyOverride
// с dataGridBody + statusBadge columns.
export const PROJECTIONS = {};
export const ROOT_PROJECTIONS = [];
