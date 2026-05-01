/**
 * Seed notion-домена.
 *
 * Coverage: 1 Workspace, 5 Users, 5 WorkspaceMembers, 8 Pages (3 root + 5 nested),
 * 30 Blocks, 1 Database с 4 Properties × 6 Rows × ~24 PropertyValues,
 * 4 Comments, 3 PagePermission overrides, 2 DatabaseViews.
 * Итого: ~95 effects.
 */

const NOW = Date.now();
const H = 1000 * 60 * 60;
const D = H * 24;

function ef(target, ctx) {
  return {
    id: `seed_notion_${target}_${ctx.id}`,
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
    context: { ...ctx, createdAt: ctx.createdAt || NOW },
  };
}

export function getSeedEffects() {
  const effects = [];

  // ── Users (5) ────────────────────────────────────────────────
  effects.push(ef("users", { id: "u-anna", name: "Анна (owner)", email: "anna@fold.demo" }));
  effects.push(ef("users", { id: "u-boris", name: "Борис (editor)", email: "boris@fold.demo" }));
  effects.push(ef("users", { id: "u-vera", name: "Вера (commenter)", email: "vera@fold.demo" }));
  effects.push(ef("users", { id: "u-grigory", name: "Григорий (viewer)", email: "grigory@fold.demo" }));
  effects.push(ef("users", { id: "u-bot", name: "AI Assistant", email: "ai@fold.demo" }));

  // ── Workspace ────────────────────────────────────────────────
  effects.push(ef("workspaces", {
    id: "ws-fold",
    name: "Fold Engineering",
    ownerId: "u-anna",
    plan: "team",
    defaultPermissionLevel: "view",
  }));

  // ── WorkspaceMembers (5) ─────────────────────────────────────
  effects.push(ef("workspaceMembers", { id: "wm-1", userId: "u-anna", workspaceId: "ws-fold", role: "workspaceOwner", invitedAt: NOW - 30 * D }));
  effects.push(ef("workspaceMembers", { id: "wm-2", userId: "u-boris", workspaceId: "ws-fold", role: "editor", invitedAt: NOW - 25 * D }));
  effects.push(ef("workspaceMembers", { id: "wm-3", userId: "u-vera", workspaceId: "ws-fold", role: "commenter", invitedAt: NOW - 20 * D }));
  effects.push(ef("workspaceMembers", { id: "wm-4", userId: "u-grigory", workspaceId: "ws-fold", role: "viewer", invitedAt: NOW - 15 * D }));
  effects.push(ef("workspaceMembers", { id: "wm-5", userId: "u-bot", workspaceId: "ws-fold", role: "editor", invitedAt: NOW - 7 * D }));

  // ── Pages (8: 3 root + 5 nested) ─────────────────────────────
  effects.push(ef("pages", {
    id: "p-eng-root", workspaceId: "ws-fold", parentPageId: null,
    title: "Engineering Wiki", icon: "📚", position: 0,
    createdById: "u-anna", lastEditedById: "u-anna",
    createdAt: NOW - 30 * D, updatedAt: NOW - 1 * D,
  }));
  effects.push(ef("pages", {
    id: "p-onboarding", workspaceId: "ws-fold", parentPageId: "p-eng-root",
    title: "Onboarding Guide", icon: "🚀", position: 0,
    createdById: "u-anna", lastEditedById: "u-boris",
    createdAt: NOW - 28 * D, updatedAt: NOW - 2 * D,
  }));
  effects.push(ef("pages", {
    id: "p-architecture", workspaceId: "ws-fold", parentPageId: "p-eng-root",
    title: "Architecture Overview", icon: "🏛", position: 1,
    createdById: "u-boris", lastEditedById: "u-boris",
    createdAt: NOW - 20 * D, updatedAt: NOW - 3 * D,
  }));
  effects.push(ef("pages", {
    id: "p-frontend", workspaceId: "ws-fold", parentPageId: "p-architecture",
    title: "Frontend stack", icon: "🎨", position: 0,
    createdById: "u-boris", lastEditedById: "u-boris",
    createdAt: NOW - 18 * D, updatedAt: NOW - 4 * D,
  }));
  effects.push(ef("pages", {
    id: "p-product-root", workspaceId: "ws-fold", parentPageId: null,
    title: "Product", icon: "📦", position: 1,
    createdById: "u-anna", lastEditedById: "u-anna",
    createdAt: NOW - 25 * D, updatedAt: NOW - 5 * D,
  }));
  effects.push(ef("pages", {
    id: "p-roadmap", workspaceId: "ws-fold", parentPageId: "p-product-root",
    title: "Roadmap Q2", icon: "🗺", position: 0,
    createdById: "u-anna", lastEditedById: "u-anna",
    createdAt: NOW - 15 * D, updatedAt: NOW - 1 * D,
  }));
  effects.push(ef("pages", {
    id: "p-meetings-root", workspaceId: "ws-fold", parentPageId: null,
    title: "Meeting Notes", icon: "📝", position: 2,
    createdById: "u-anna", lastEditedById: "u-anna",
    createdAt: NOW - 30 * D, updatedAt: NOW - 6 * D,
  }));
  effects.push(ef("pages", {
    id: "p-meeting-2026-04-25", workspaceId: "ws-fold", parentPageId: "p-meetings-root",
    title: "Standup 2026-04-25", icon: "🗓", position: 0,
    createdById: "u-boris", lastEditedById: "u-boris",
    createdAt: NOW - 1 * D, updatedAt: NOW - 1 * D,
  }));

  // ── Blocks (30) — для p-onboarding и p-architecture ───────────
  // p-onboarding: 12 blocks
  const onboardingBlocks = [
    { kind: "heading_1", text: "Welcome to Fold Engineering" },
    { kind: "paragraph", text: "Этот гид поможет тебе быстро влиться в команду. Прочитай его в первый день." },
    { kind: "heading_2", text: "Шаг 1: Доступы" },
    { kind: "todo", text: "GitHub workspace", checked: true },
    { kind: "todo", text: "Slack — каналы #eng, #releases", checked: true },
    { kind: "todo", text: "VPN сертификат", checked: false },
    { kind: "todo", text: "Sentry / Grafana", checked: false },
    { kind: "heading_2", text: "Шаг 2: Окружение" },
    { kind: "code", text: "git clone git@github.com:fold/idf.git\nnpm install\nnpm run dev", language: "bash" },
    { kind: "callout", text: "Если npm install падает на peer-deps — добавь --legacy-peer-deps", emoji: "💡", color: "yellow" },
    { kind: "heading_2", text: "Шаг 3: Первая задача" },
    { kind: "paragraph", text: "Возьми любой issue с лейблом good-first-issue в репо idf и решай." },
  ];
  onboardingBlocks.forEach((b, i) => {
    effects.push(ef("blocks", { id: `b-onb-${i}`, pageId: "p-onboarding", position: i, ...b }));
  });

  // p-architecture: 10 blocks
  const archBlocks = [
    { kind: "heading_1", text: "Architecture Overview" },
    { kind: "paragraph", text: "IDF — формат описания приложения. Прототип демонстрирует кристаллизатор." },
    { kind: "heading_2", text: "Domains" },
    { kind: "bulleted_list", text: "host (этот репо) — runtime + 14 demo доменов" },
    { kind: "bulleted_list", text: "idf-sdk — пакеты core / renderer / 4 адаптера" },
    { kind: "bulleted_list", text: "idf-runtime — multi-tenant production runtime" },
    { kind: "heading_2", text: "Materializations" },
    { kind: "paragraph", text: "Четыре равноправных читателя одного Φ: pixels / voice / agent-API / document." },
    { kind: "quote", text: "Формат → читатели. Не фреймворк." },
    { kind: "divider" },
  ];
  archBlocks.forEach((b, i) => {
    effects.push(ef("blocks", { id: `b-arch-${i}`, pageId: "p-architecture", position: i, ...b }));
  });

  // p-roadmap: 8 blocks
  const roadmapBlocks = [
    { kind: "heading_1", text: "Roadmap Q2 2026" },
    { kind: "heading_2", text: "Цели квартала" },
    { kind: "todo", text: "Закрыть P0-блок SDK gap'ов", checked: true },
    { kind: "todo", text: "Запустить первый production pilot", checked: false },
    { kind: "todo", text: "Pattern Bank → 50 stable patterns", checked: false },
    { kind: "heading_2", text: "Риски" },
    { kind: "callout", text: "Φ schema-versioning не закрыт — блокирует prod", emoji: "⚠️", color: "red" },
    { kind: "paragraph", text: "Mitigation: design-spec в backlog §2.8" },
  ];
  roadmapBlocks.forEach((b, i) => {
    effects.push(ef("blocks", { id: `b-rm-${i}`, pageId: "p-roadmap", position: i, ...b }));
  });

  // ── Database: Tasks (на p-roadmap) ────────────────────────────
  effects.push(ef("databases", {
    id: "db-tasks",
    workspaceId: "ws-fold",
    parentPageId: "p-roadmap",
    title: "Tasks",
    defaultViewId: "dv-table",
    archivedAt: null,
  }));

  // 2 views
  effects.push(ef("databaseViews", {
    id: "dv-table", databaseId: "db-tasks", name: "All tasks", kind: "table",
    sortByPropertyId: "prop-priority", sortDirection: "desc", filtersJson: {},
    position: 0,
  }));
  effects.push(ef("databaseViews", {
    id: "dv-board", databaseId: "db-tasks", name: "By status", kind: "board",
    groupByPropertyId: "prop-status", filtersJson: {}, position: 1,
  }));

  // 4 properties
  effects.push(ef("properties", { id: "prop-status", databaseId: "db-tasks", name: "Status", kind: "select",
    optionsJson: { options: ["todo", "in_progress", "done"] }, position: 0 }));
  effects.push(ef("properties", { id: "prop-priority", databaseId: "db-tasks", name: "Priority", kind: "select",
    optionsJson: { options: ["P0", "P1", "P2", "P3"] }, position: 1 }));
  effects.push(ef("properties", { id: "prop-assignee", databaseId: "db-tasks", name: "Assignee", kind: "person", position: 2 }));
  effects.push(ef("properties", { id: "prop-due", databaseId: "db-tasks", name: "Due date", kind: "date", position: 3 }));

  // 6 rows (= pages с parentPageId = p-roadmap)
  const rowDefs = [
    { id: "row-1", title: "Φ schema versioning design-spec", status: "in_progress", priority: "P0", assignee: "u-anna", due: "2026-05-10" },
    { id: "row-2", title: "Pattern Bank 50 stable", status: "in_progress", priority: "P1", assignee: "u-boris", due: "2026-06-30" },
    { id: "row-3", title: "First pilot tenant onboarding", status: "todo", priority: "P0", assignee: "u-anna", due: "2026-05-20" },
    { id: "row-4", title: "IrreversibleBadge auto-placement", status: "todo", priority: "P2", assignee: "u-boris", due: "2026-06-15" },
    { id: "row-5", title: "Reader-equivalence runtime check", status: "todo", priority: "P1", assignee: "u-bot", due: "2026-07-01" },
    { id: "row-6", title: "domain-audit refresh", status: "done", priority: "P3", assignee: "u-boris", due: "2026-04-25" },
  ];
  rowDefs.forEach((r, i) => {
    // Page для row
    effects.push(ef("pages", {
      id: `p-${r.id}`,
      workspaceId: "ws-fold",
      parentPageId: "p-roadmap",
      title: r.title,
      icon: "📌",
      position: 100 + i,
      createdById: "u-anna",
      lastEditedById: "u-anna",
      createdAt: NOW - (10 - i) * D,
      updatedAt: NOW - i * D,
    }));
    effects.push(ef("databaseRows", {
      id: r.id, databaseId: "db-tasks", pageId: `p-${r.id}`, position: i,
    }));
    // 4 PropertyValue
    effects.push(ef("propertyValues", { id: `pv-${r.id}-status`, rowId: r.id, propertyId: "prop-status", valueJson: { value: r.status } }));
    effects.push(ef("propertyValues", { id: `pv-${r.id}-priority`, rowId: r.id, propertyId: "prop-priority", valueJson: { value: r.priority } }));
    effects.push(ef("propertyValues", { id: `pv-${r.id}-assignee`, rowId: r.id, propertyId: "prop-assignee", valueJson: { userId: r.assignee } }));
    effects.push(ef("propertyValues", { id: `pv-${r.id}-due`, rowId: r.id, propertyId: "prop-due", valueJson: { date: r.due } }));
  });

  // ── Comments (4) ─────────────────────────────────────────────
  effects.push(ef("comments", {
    id: "c-1", pageId: "p-onboarding", blockId: null,
    body: "Шаг 2 устарел — теперь pnpm. Проверь, пожалуйста.",
    authorId: "u-vera", createdAt: NOW - 2 * D,
  }));
  effects.push(ef("comments", {
    id: "c-2", pageId: null, blockId: "b-arch-7",
    body: "Можно добавить ссылку на манифест v2?",
    authorId: "u-vera", createdAt: NOW - 1 * D,
  }));
  effects.push(ef("comments", {
    id: "c-3", pageId: null, blockId: "b-arch-7",
    body: "Согласен, добавлю в следующем pass'е.",
    authorId: "u-boris", parentCommentId: "c-2", createdAt: NOW - 0.5 * D,
  }));
  effects.push(ef("comments", {
    id: "c-4", pageId: "p-roadmap", blockId: null,
    body: "Q2 cut можно ужать до 2 OKR — поговорим на ретро.",
    authorId: "u-anna", createdAt: NOW - 0.2 * D,
    resolvedAt: null,
  }));

  // ── PagePermissions (3 override'а — для commenter / viewer / guest) ──
  effects.push(ef("pagePermissions", {
    id: "pp-1", pageId: "p-roadmap", userId: "u-vera", level: "edit",
    grantedAt: NOW - 5 * D, grantedById: "u-anna",
  }));
  effects.push(ef("pagePermissions", {
    id: "pp-2", pageId: "p-architecture", userId: "u-grigory", level: "comment",
    grantedAt: NOW - 3 * D, grantedById: "u-boris",
  }));
  effects.push(ef("pagePermissions", {
    id: "pp-3", pageId: "p-meeting-2026-04-25", userId: "u-vera", level: "view",
    grantedAt: NOW - 1 * D, grantedById: "u-boris",
  }));

  return effects;
}
