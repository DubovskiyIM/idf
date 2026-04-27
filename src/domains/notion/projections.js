/**
 * Projections notion-домена.
 *
 * Authored — минимум; остальное derived через R-rules.
 * Custom archetypes:
 *   - page_detail — singleton-detail с block-canvas в body + comments subCollection
 *   - block_canvas — кастомный canvas-список блоков (mockup, без CRDT)
 *   - sidebar_workspace — feed с hierarchy-tree-nav
 */

export const PROJECTIONS = {
  // Sidebar — иерархическое дерево pages в текущем workspace
  sidebar_workspace: {
    id: "sidebar_workspace",
    title: "Workspace",
    kind: "feed",
    mainEntity: "Page",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["title", "icon"],
    where: "row.archivedAt === null",
    onItemClick: "page_detail",
    patterns: {
      enabled: ["hierarchy-tree-nav"],
    },
    slots: {
      header: { kind: "intent", intentId: "create_page" },
    },
  },

  // Page detail — основной экран; block-canvas в body, comments как subCollection
  page_detail: {
    id: "page_detail",
    title: "Страница",
    kind: "detail",
    mainEntity: "Page",
    idParam: "pageId",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    // §13d (idf-sdk #402): Block — content страницы (рендерится в body через
    // canvas/BlockEditor), не дочерний CRUD-каталог. Без opt-out R8 absorb'ит
    // block_list как subCollection и UI даёт двойное представление.
    absorbExclude: ["Block"],
    // top-level subCollections (canonical shape — ArchetypeDetail/SDK consume отсюда).
    subCollections: [
      { projectionId: "comments_thread", foreignKey: "pageId", entity: "Comment" },
      { projectionId: "page_permissions_panel", foreignKey: "pageId", entity: "PagePermission" },
    ],
    witnesses: ["title", "icon", "coverImageUrl", "lastEditedById", "updatedAt"],
    slots: {
      hero: {
        kind: "card",
        fields: ["icon", "title", "coverImageUrl"],
      },
      body: {
        kind: "canvas",
        canvasId: "block_canvas",
        // Custom canvas рендерит Block-список с поддержкой 15 kind'ов
      },
      toolbar: {
        intents: ["rename_page", "set_page_icon", "set_cover_image", "share_page", "archive_page", "duplicate_page"],
      },
    },
  },

  // Database detail — hub с absorbed children (views / properties / rows)
  database_detail: {
    id: "database_detail",
    title: "База данных",
    kind: "detail",
    mainEntity: "Database",
    idParam: "databaseId",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["title", "createdAt"],
    slots: {
      hero: { kind: "card", fields: ["title"] },
      subCollections: [
        { projectionId: "database_views_list", foreignKey: "databaseId", entity: "DatabaseView" },
        { projectionId: "database_properties_list", foreignKey: "databaseId", entity: "Property" },
        { projectionId: "database_table_view", foreignKey: "databaseId", entity: "DatabaseRow" },
      ],
      toolbar: {
        intents: ["add_property", "create_view", "add_database_row", "duplicate_database", "archive_database"],
      },
    },
  },

  // Database views catalog (absorbed)
  database_views_list: {
    id: "database_views_list",
    title: "Виды",
    kind: "catalog",
    mainEntity: "DatabaseView",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["name", "kind"],
    slots: {
      header: { kind: "intent", intentId: "create_view" },
    },
  },

  database_properties_list: {
    id: "database_properties_list",
    title: "Свойства",
    kind: "catalog",
    mainEntity: "Property",
    forRoles: ["workspaceOwner", "editor"],
    witnesses: ["name", "kind"],
    slots: {
      header: { kind: "intent", intentId: "add_property" },
    },
  },

  // Table view — стандартный datagrid, derived
  database_table_view: {
    id: "database_table_view",
    title: "Таблица",
    kind: "catalog",
    mainEntity: "DatabaseRow",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["pageId", "createdAt"],
    onItemClick: "page_detail",
    patterns: {
      enabled: ["catalog-default-datagrid", "faceted-filter-panel"],
    },
  },

  // Board view — kanban
  database_board_view: {
    id: "database_board_view",
    title: "Канбан",
    kind: "catalog",
    mainEntity: "DatabaseRow",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["pageId"],
    patterns: {
      enabled: ["kanban-phase-column-board"],
    },
    onItemClick: "page_detail",
  },

  // Gallery view — grid cards
  database_gallery_view: {
    id: "database_gallery_view",
    title: "Галерея",
    kind: "catalog",
    mainEntity: "DatabaseRow",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["pageId"],
    patterns: {
      enabled: ["grid-card-layout"],
    },
    onItemClick: "page_detail",
  },

  // Calendar view — custom canvas
  database_calendar_view: {
    id: "database_calendar_view",
    title: "Календарь",
    kind: "canvas",
    mainEntity: "DatabaseRow",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    slots: {
      body: { kind: "canvas", canvasId: "calendar_view" },
    },
  },

  // Comments thread (subCollection inside page_detail)
  comments_thread: {
    id: "comments_thread",
    title: "Комментарии",
    kind: "feed",
    mainEntity: "Comment",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["body", "authorId", "createdAt", "resolvedAt"],
    where: "row.resolvedAt === null",
    slots: {
      header: { kind: "intent", intentId: "add_comment_to_page" },
    },
  },

  // Page permissions panel (subCollection inside page_detail, restricted to workspaceOwner+editor)
  page_permissions_panel: {
    id: "page_permissions_panel",
    title: "Доступ",
    kind: "catalog",
    mainEntity: "PagePermission",
    forRoles: ["workspaceOwner", "editor"],
    witnesses: ["userId", "level", "grantedAt"],
    slots: {
      header: { kind: "intent", intentId: "share_page" },
    },
  },

  // Members admin (только workspaceOwner)
  members_admin: {
    id: "members_admin",
    title: "Участники workspace",
    kind: "catalog",
    mainEntity: "WorkspaceMember",
    forRoles: ["workspaceOwner"],
    witnesses: ["userId", "role", "invitedAt"],
    slots: {
      header: { kind: "intent", intentId: "invite_member" },
    },
  },

  // Recent activity — feed of recently-edited pages
  recent_activity: {
    id: "recent_activity",
    title: "Недавнее",
    kind: "feed",
    mainEntity: "Page",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["title", "icon", "lastEditedById", "updatedAt"],
    where: "row.archivedAt === null",
    sortBy: "updatedAt",
    sortDirection: "desc",
    onItemClick: "page_detail",
  },

  // Search results — from search_workspace intent
  search_results: {
    id: "search_results",
    title: "Результаты поиска",
    kind: "feed",
    mainEntity: "Page",
    forRoles: ["workspaceOwner", "editor", "commenter", "viewer"],
    witnesses: ["title", "icon"],
    onItemClick: "page_detail",
  },

  // Agent console — composer для agent intent'ов
  agent_console: {
    id: "agent_console",
    title: "Агент",
    kind: "form",
    mainEntity: "Page",
    forRoles: ["workspaceOwner", "editor"],
    slots: {
      toolbar: {
        intents: ["agent_create_page", "agent_set_property", "agent_summarize_page"],
      },
    },
  },
};

// Top-level navigation. Per-role visibility — через projection.forRoles
// (V2Shell фильтрует rootProjections по activeRole).
export const ROOT_PROJECTIONS = [
  "sidebar_workspace",
  "recent_activity",
  "members_admin",
  "agent_console",
];
