// src/domains/argocd/rules.js
// Stage 1: правил нет. Reactive rules — кандидаты на Stage 4+:
//  - auto-refresh Application каждые N минут (schedule ext)
//  - alert при Health.Degraded дольше M минут (threshold ext)
//  - auto-prune manifests после sync (condition ext)
export const RULES = [];
