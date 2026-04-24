// src/domains/argocd/seed.js
/**
 * Stage 3 rich seed — воспроизводит Applications в разных sync/health
 * states для валидации Stage 4 statusBadge primitive. Coverage:
 *   - 3 project (default / platform / team-payments)
 *   - 2 cluster (in-cluster / prod-aws)
 *   - 5 repository (git + helm + oci)
 *   - 10 application (разброс по syncStatus × healthStatus)
 *   - 3 applicationset
 *   - 3 gpgkey
 *   - 2 certificate
 *   - 3 account
 *
 * Семантика состояний (ArgoCD semantic):
 *   sync:   Synced / OutOfSync / Unknown
 *   health: Healthy / Progressing / Degraded / Missing / Suspended / Unknown
 */
const NOW = Date.now();
const H = 1000 * 60 * 60;

function ef(target, ctx) {
  return {
    id: `seed_argocd_${target}_${ctx.id}`,
    intent_id: "_seed",
    alpha: "add",
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: NOW,
    resolved_at: NOW,
    target,
    value: null,
    context: { ...ctx, createdAt: NOW },
  };
}

export function getSeedEffects() {
  const effects = [];

  // --- Projects ---
  effects.push(ef("Project", {
    id: "p_default",
    name: "default",
    description: "Дефолтный проект — допускает любые source-repos и destinations",
    sourceRepos: "*",
    destinations: "*/*",
  }));
  effects.push(ef("Project", {
    id: "p_platform",
    name: "platform",
    description: "Инфраструктурные компоненты платформы",
    sourceRepos: "https://github.com/acme/platform-gitops",
    destinations: "in-cluster/platform-*, prod-aws/platform-*",
  }));
  effects.push(ef("Project", {
    id: "p_payments",
    name: "team-payments",
    description: "Сервисы команды Payments (PCI-scope)",
    sourceRepos: "https://github.com/acme/payments-gitops",
    destinations: "prod-aws/payments",
  }));

  // --- Clusters ---
  effects.push(ef("Cluster", {
    id: "c_in_cluster",
    name: "in-cluster",
    server: "https://kubernetes.default.svc",
    project: "p_platform",
    connectionStatus: "Successful",
    kubernetesVersion: "1.29",
  }));
  effects.push(ef("Cluster", {
    id: "c_prod_aws",
    name: "prod-aws",
    server: "https://api.prod-aws.acme.internal",
    project: "p_platform",
    connectionStatus: "Successful",
    kubernetesVersion: "1.28",
  }));

  // --- Repositories ---
  const repos = [
    { id: "r_platform", repo: "https://github.com/acme/platform-gitops", type: "git", project: "p_platform", username: "argocd-bot", connectionStatus: "Successful" },
    { id: "r_payments", repo: "https://github.com/acme/payments-gitops", type: "git", project: "p_payments", username: "argocd-bot", connectionStatus: "Successful" },
    { id: "r_prometheus", repo: "https://prometheus-community.github.io/helm-charts", type: "helm", project: "p_platform", username: "", connectionStatus: "Successful" },
    { id: "r_nginx", repo: "https://charts.bitnami.com/bitnami", type: "helm", project: "p_platform", username: "", connectionStatus: "Successful" },
    { id: "r_legacy", repo: "https://github.com/acme/legacy-gitops", type: "git", project: "p_default", username: "argocd-bot", connectionStatus: "Failed" },
  ];
  for (const r of repos) effects.push(ef("Repository", r));

  // --- Applications (разброс по sync × health — 10 шт) ---
  const apps = [
    { name: "frontend",         project: "p_platform", namespace: "platform",     syncStatus: "Synced",    healthStatus: "Healthy" },
    { name: "api-gateway",      project: "p_platform", namespace: "platform",     syncStatus: "Synced",    healthStatus: "Healthy" },
    { name: "grafana",          project: "p_platform", namespace: "monitoring",   syncStatus: "Synced",    healthStatus: "Progressing" },
    { name: "prometheus",       project: "p_platform", namespace: "monitoring",   syncStatus: "OutOfSync", healthStatus: "Healthy" },
    { name: "payments-api",     project: "p_payments", namespace: "payments",     syncStatus: "Synced",    healthStatus: "Degraded" },
    { name: "payments-worker",  project: "p_payments", namespace: "payments",     syncStatus: "OutOfSync", healthStatus: "Degraded" },
    { name: "legacy-billing",   project: "p_default",  namespace: "default",      syncStatus: "Unknown",   healthStatus: "Missing" },
    { name: "cert-manager",     project: "p_platform", namespace: "cert-manager", syncStatus: "Synced",    healthStatus: "Healthy" },
    { name: "ingress-nginx",    project: "p_platform", namespace: "ingress-nginx",syncStatus: "Synced",    healthStatus: "Healthy" },
    { name: "backup-cron",      project: "p_platform", namespace: "platform",     syncStatus: "Synced",    healthStatus: "Suspended" },
  ];
  apps.forEach((a, i) => {
    effects.push(ef("Application", {
      id: `a_${a.name}`,
      name: a.name,
      project: a.project,
      namespace: a.namespace,
      server: a.project === "p_payments" ? "prod-aws" : "in-cluster",
      source: a.project === "p_payments"
        ? "https://github.com/acme/payments-gitops"
        : "https://github.com/acme/platform-gitops",
      revision: a.syncStatus === "OutOfSync" ? "main@a8f9f37" : "main@7f7d512",
      syncStatus: a.syncStatus,
      healthStatus: a.healthStatus,
      lastSyncedAt: NOW - (i + 1) * H,
    }));
  });

  // --- ApplicationSets ---
  effects.push(ef("Applicationset", {
    id: "as_preview", name: "preview-envs", project: "p_platform",
    generatorKind: "Git",
  }));
  effects.push(ef("Applicationset", {
    id: "as_cluster_addons", name: "cluster-addons", project: "p_platform",
    generatorKind: "Cluster",
  }));
  effects.push(ef("Applicationset", {
    id: "as_payments_regions", name: "payments-regions", project: "p_payments",
    generatorKind: "List",
  }));

  // --- GPG keys ---
  effects.push(ef("Gpgkey", {
    id: "gpg_alice", keyID: "ABCD1234", fingerprint: "ABCD1234EFGH5678IJKL9012MNOP3456QRST7890",
    owner: "Alice Corp <alice@acme.com>", subType: "rsa4096", trust: "ultimate",
  }));
  effects.push(ef("Gpgkey", {
    id: "gpg_bot", keyID: "0123BEEF", fingerprint: "0123BEEF4567DEADBEEF8901ABCDEF2345CAFE67",
    owner: "ArgoCD Bot <argo@acme.com>", subType: "ed25519", trust: "full",
  }));
  effects.push(ef("Gpgkey", {
    id: "gpg_legacy", keyID: "DEADBEEF", fingerprint: "DEADBEEF1111222233334444555566667777888899",
    owner: "Legacy Admin <admin@acme.com>", subType: "rsa2048", trust: "marginal",
  }));

  // --- Certificates ---
  effects.push(ef("Certificate", { id: "cert_github",  serverName: "github.com",   certType: "ssh" }));
  effects.push(ef("Certificate", { id: "cert_gitlab",  serverName: "gitlab.acme.internal", certType: "https" }));

  // --- Accounts ---
  effects.push(ef("Account", { id: "acc_admin", name: "admin", capabilities: "login,apiKey", enabled: true }));
  effects.push(ef("Account", { id: "acc_ci",    name: "ci-bot", capabilities: "apiKey", enabled: true }));
  effects.push(ef("Account", { id: "acc_readonly", name: "readonly", capabilities: "login", enabled: true }));

  return effects;
}
