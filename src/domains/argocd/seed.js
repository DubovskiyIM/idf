// src/domains/argocd/seed.js
// Stage 1: пустой seed. Rich seed (5-10 apps в разных states, 3-4 projects,
// 2-3 clusters, 4-5 repos) добавим на Stage 3 после нормализации entity
// naming (G-A-1 alias v1alpha1Application → Application).
export function getSeedEffects() {
  return [];
}
