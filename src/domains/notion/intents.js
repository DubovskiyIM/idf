/**
 * Intents notion-домена — ~60 intent'ов в 8 категориях.
 *
 * Категории:
 *   - Workspace (5)
 *   - Pages (10)
 *   - Blocks (12)
 *   - Databases (10)
 *   - Views (8)
 *   - Comments (5)
 *   - Permissions (4)
 *   - Search/Nav (3)
 *   - Agent (3)
 */

export const INTENTS = {
  // ─────────────────────────────────────────────────────────────
  // Workspace (5)
  // ─────────────────────────────────────────────────────────────

  create_workspace: {
    α: "create",
    name: "Создать workspace",
    target: "Workspace",
    confirmation: "form",
    parameters: [
      { name: "name", type: "text", required: true, label: "Название" },
      { name: "plan", type: "select", options: ["free", "team", "enterprise"], required: true, label: "План" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Workspace",
        fields: {
          id: "{{auto}}",
          name: "{{params.name}}",
          plan: "{{params.plan}}",
          ownerId: "{{viewer.id}}",
          defaultPermissionLevel: "view",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  rename_workspace: {
    α: "update",
    name: "Переименовать workspace",
    target: "Workspace",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Workspace", required: true },
      { name: "name", type: "text", required: true, label: "Название" },
    ],
    particles: {
      effects: [{ α: "update", target: "Workspace", fields: { name: "{{params.name}}" } }],
    },
  },

  set_workspace_default_permission: {
    α: "replace",
    name: "Доступ по умолчанию",
    target: "Workspace.defaultPermissionLevel",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "Workspace", required: true },
      { name: "level", type: "select", options: ["edit", "comment", "view", "none"], required: true, label: "Уровень" },
    ],
    particles: {
      effects: [{
        α: "replace", target: "Workspace.defaultPermissionLevel",
        fields: { defaultPermissionLevel: "{{params.level}}" },
      }],
    },
  },

  invite_member: {
    α: "create",
    name: "Пригласить участника",
    target: "WorkspaceMember",
    confirmation: "form",
    parameters: [
      { name: "workspaceId", type: "entityRef", entity: "Workspace", required: true },
      { name: "userId", type: "entityRef", entity: "User", required: true, label: "Пользователь" },
      { name: "role", type: "select", options: ["editor", "commenter", "viewer", "guest"], required: true, label: "Роль" },
    ],
    particles: {
      effects: [{
        α: "create", target: "WorkspaceMember",
        fields: {
          id: "{{auto}}",
          userId: "{{params.userId}}",
          workspaceId: "{{params.workspaceId}}",
          role: "{{params.role}}",
          invitedAt: "{{now}}",
        },
      }],
    },
  },

  revoke_member: {
    α: "remove",
    name: "Удалить участника",
    target: "WorkspaceMember",
    confirmation: "click",
    context: { __irr: { point: "medium", reason: "Восстановление через invite" } },
    parameters: [{ name: "id", type: "entityRef", entity: "WorkspaceMember", required: true }],
    particles: { effects: [{ α: "remove", target: "WorkspaceMember", fields: {} }] },
  },

  change_member_role: {
    α: "replace",
    name: "Сменить роль",
    target: "WorkspaceMember.role",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "WorkspaceMember", required: true },
      { name: "role", type: "select", options: ["workspaceOwner", "editor", "commenter", "viewer", "guest"], required: true, label: "Новая роль" },
    ],
    particles: {
      effects: [{ α: "replace", target: "WorkspaceMember.role", fields: { role: "{{params.role}}" } }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Pages (10)
  // ─────────────────────────────────────────────────────────────

  create_page: {
    α: "create",
    name: "Создать страницу",
    target: "Page",
    confirmation: "form",
    parameters: [
      { name: "workspaceId", type: "entityRef", entity: "Workspace", required: true },
      { name: "title", type: "text", required: true, label: "Заголовок" },
      { name: "icon", type: "text", label: "Иконка (emoji)" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Page",
        fields: {
          id: "{{auto}}",
          workspaceId: "{{params.workspaceId}}",
          parentPageId: null,
          title: "{{params.title}}",
          icon: "{{params.icon}}",
          position: 0,
          createdById: "{{viewer.id}}",
          lastEditedById: "{{viewer.id}}",
          createdAt: "{{now}}",
          updatedAt: "{{now}}",
        },
      }],
    },
  },

  create_subpage: {
    α: "create",
    name: "Создать подстраницу",
    target: "Page",
    confirmation: "form",
    parameters: [
      { name: "parentPageId", type: "entityRef", entity: "Page", required: true, label: "Родитель" },
      { name: "title", type: "text", required: true, label: "Заголовок" },
      { name: "icon", type: "text", label: "Иконка" },
    ],
    // Workspace и position derive в server-side builder
  },

  rename_page: {
    α: "update",
    name: "Переименовать",
    target: "Page",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Page", required: true },
      { name: "title", type: "text", required: true, label: "Новое название" },
    ],
    particles: {
      effects: [{
        α: "update", target: "Page",
        fields: { title: "{{params.title}}", lastEditedById: "{{viewer.id}}", updatedAt: "{{now}}" },
      }],
    },
  },

  set_page_icon: {
    α: "replace",
    name: "Изменить иконку",
    target: "Page.icon",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "Page", required: true },
      { name: "icon", type: "text", required: true, label: "Иконка (emoji)" },
    ],
    particles: {
      effects: [{ α: "replace", target: "Page.icon", fields: { icon: "{{params.icon}}", updatedAt: "{{now}}" } }],
    },
  },

  set_cover_image: {
    α: "replace",
    name: "Изменить обложку",
    target: "Page.coverImageUrl",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Page", required: true },
      { name: "coverImageUrl", type: "url", required: true, label: "URL обложки" },
    ],
    particles: {
      effects: [{
        α: "replace", target: "Page.coverImageUrl",
        fields: { coverImageUrl: "{{params.coverImageUrl}}", updatedAt: "{{now}}" },
      }],
    },
  },

  move_page: {
    α: "replace",
    name: "Переместить страницу",
    target: "Page.parentPageId",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Page", required: true },
      { name: "newParentPageId", type: "entityRef", entity: "Page", label: "Новый родитель (или пусто для root)" },
      { name: "newPosition", type: "number", required: true, label: "Позиция" },
    ],
    // Сложный effect — server-side builder.
  },

  duplicate_page: {
    α: "create",
    name: "Дублировать",
    target: "Page",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Page", required: true, label: "Источник" },
      { name: "newTitle", type: "text", required: true, label: "Название копии" },
    ],
    // Server-side builder копирует все blocks.
  },

  archive_page: {
    α: "replace",
    name: "В архив",
    target: "Page.archivedAt",
    confirmation: "click",
    salience: "primary",
    context: { __irr: { point: "medium", reason: "Восстановление 30 дней, потом hard-delete" } },
    parameters: [{ name: "id", type: "entityRef", entity: "Page", required: true }],
    particles: {
      effects: [{
        α: "replace", target: "Page.archivedAt",
        fields: { archivedAt: "{{now}}", updatedAt: "{{now}}" },
      }],
    },
  },

  unarchive_page: {
    α: "replace",
    name: "Восстановить из архива",
    target: "Page.archivedAt",
    confirmation: "click",
    permittedFor: ["workspaceOwner"],
    parameters: [{ name: "id", type: "entityRef", entity: "Page", required: true }],
    particles: {
      effects: [{
        α: "replace", target: "Page.archivedAt",
        fields: { archivedAt: null, updatedAt: "{{now}}" },
      }],
    },
  },

  share_page: {
    α: "create",
    name: "Поделиться страницей",
    target: "PagePermission",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "userId", type: "entityRef", entity: "User", required: true, label: "Кому" },
      { name: "level", type: "select", options: ["edit", "comment", "view"], required: true, label: "Уровень" },
    ],
    particles: {
      effects: [{
        α: "create", target: "PagePermission",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          userId: "{{params.userId}}",
          level: "{{params.level}}",
          grantedAt: "{{now}}",
          grantedById: "{{viewer.id}}",
        },
      }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Blocks (12)
  // ─────────────────────────────────────────────────────────────

  add_block: {
    α: "create",
    name: "Добавить блок",
    target: "Block",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "kind", type: "select", required: true, options: ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list", "numbered_list", "todo", "toggle", "quote", "callout", "code", "divider"], label: "Тип" },
      { name: "text", type: "textarea", label: "Текст" },
      { name: "position", type: "number", required: true, label: "Позиция" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Block",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          kind: "{{params.kind}}",
          text: "{{params.text}}",
          position: "{{params.position}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  update_block_content: {
    α: "update",
    name: "Изменить текст блока",
    target: "Block",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Block", required: true },
      { name: "text", type: "textarea", required: true, label: "Текст" },
    ],
    particles: { effects: [{ α: "update", target: "Block", fields: { text: "{{params.text}}" } }] },
  },

  change_block_kind: {
    α: "replace",
    name: "Сменить тип блока",
    target: "Block.kind",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "Block", required: true },
      { name: "kind", type: "select", required: true, options: ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list", "numbered_list", "todo", "toggle", "quote", "callout"] },
    ],
    particles: {
      effects: [{ α: "replace", target: "Block.kind", fields: { kind: "{{params.kind}}" } }],
    },
  },

  reorder_blocks: {
    α: "replace",
    name: "Изменить порядок блоков",
    target: "Block.position",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "Block", required: true },
      { name: "newPosition", type: "number", required: true, label: "Новая позиция" },
    ],
    particles: {
      effects: [{ α: "replace", target: "Block.position", fields: { position: "{{params.newPosition}}" } }],
    },
  },

  indent_block: {
    α: "replace",
    name: "Сдвинуть вправо",
    target: "Block.parentBlockId",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "Block", required: true },
      { name: "parentBlockId", type: "entityRef", entity: "Block", required: true },
    ],
    particles: {
      effects: [{ α: "replace", target: "Block.parentBlockId", fields: { parentBlockId: "{{params.parentBlockId}}" } }],
    },
  },

  outdent_block: {
    α: "replace",
    name: "Сдвинуть влево",
    target: "Block.parentBlockId",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Block", required: true }],
    particles: {
      effects: [{ α: "replace", target: "Block.parentBlockId", fields: { parentBlockId: null } }],
    },
  },

  delete_block: {
    α: "remove",
    name: "Удалить блок",
    target: "Block",
    confirmation: "click",
    salience: "primary",
    parameters: [{ name: "id", type: "entityRef", entity: "Block", required: true }],
    particles: { effects: [{ α: "remove", target: "Block", fields: {} }] },
  },

  add_image_block: {
    α: "create",
    name: "Добавить изображение",
    target: "Block",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "src", type: "url", required: true, label: "URL" },
      { name: "caption", type: "text", label: "Подпись" },
      { name: "position", type: "number", required: true, label: "Позиция" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Block",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          kind: "image",
          src: "{{params.src}}",
          caption: "{{params.caption}}",
          position: "{{params.position}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  add_code_block: {
    α: "create",
    name: "Добавить код",
    target: "Block",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "language", type: "select", required: true, options: ["plaintext", "javascript", "typescript", "python", "go", "rust", "sql", "bash", "json", "yaml", "markdown"] },
      { name: "text", type: "textarea", required: true, label: "Код" },
      { name: "position", type: "number", required: true, label: "Позиция" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Block",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          kind: "code",
          language: "{{params.language}}",
          text: "{{params.text}}",
          position: "{{params.position}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  embed_link: {
    α: "create",
    name: "Встроить ссылку",
    target: "Block",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "url", type: "url", required: true, label: "URL" },
      { name: "provider", type: "select", required: true, options: ["youtube", "figma", "loom", "miro", "other"], label: "Провайдер" },
      { name: "position", type: "number", required: true, label: "Позиция" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Block",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          kind: "embed",
          url: "{{params.url}}",
          provider: "{{params.provider}}",
          position: "{{params.position}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  add_callout_block: {
    α: "create",
    name: "Добавить сноску",
    target: "Block",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "text", type: "textarea", required: true, label: "Текст" },
      { name: "emoji", type: "text", label: "Emoji" },
      { name: "color", type: "select", options: ["default", "blue", "yellow", "green", "red", "purple"], label: "Цвет" },
      { name: "position", type: "number", required: true },
    ],
    particles: {
      effects: [{
        α: "create", target: "Block",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          kind: "callout",
          text: "{{params.text}}",
          emoji: "{{params.emoji}}",
          color: "{{params.color}}",
          position: "{{params.position}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  convert_to_database: {
    α: "create",
    name: "Преобразовать в БД",
    target: "Database",
    confirmation: "form",
    parameters: [
      { name: "parentPageId", type: "entityRef", entity: "Page", required: true },
      { name: "title", type: "text", required: true, label: "Название БД" },
    ],
    // Сложный multi-effect — server-side
  },

  // ─────────────────────────────────────────────────────────────
  // Databases (10)
  // ─────────────────────────────────────────────────────────────

  create_database: {
    α: "create",
    name: "Создать базу данных",
    target: "Database",
    confirmation: "form",
    parameters: [
      { name: "workspaceId", type: "entityRef", entity: "Workspace", required: true },
      { name: "parentPageId", type: "entityRef", entity: "Page", label: "Родительская страница" },
      { name: "title", type: "text", required: true, label: "Название" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Database",
        fields: {
          id: "{{auto}}",
          workspaceId: "{{params.workspaceId}}",
          parentPageId: "{{params.parentPageId}}",
          title: "{{params.title}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  add_property: {
    α: "create",
    name: "Добавить свойство",
    target: "Property",
    confirmation: "form",
    parameters: [
      { name: "databaseId", type: "entityRef", entity: "Database", required: true },
      { name: "name", type: "text", required: true, label: "Название" },
      { name: "kind", type: "select", required: true, options: ["text", "number", "select", "multi_select", "date", "person", "checkbox", "url", "email", "phone", "relation"] },
      { name: "position", type: "number", required: true },
    ],
    particles: {
      effects: [{
        α: "create", target: "Property",
        fields: {
          id: "{{auto}}",
          databaseId: "{{params.databaseId}}",
          name: "{{params.name}}",
          kind: "{{params.kind}}",
          position: "{{params.position}}",
        },
      }],
    },
  },

  rename_property: {
    α: "update",
    name: "Переименовать свойство",
    target: "Property",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Property", required: true },
      { name: "name", type: "text", required: true, label: "Название" },
    ],
    particles: { effects: [{ α: "update", target: "Property", fields: { name: "{{params.name}}" } }] },
  },

  change_property_kind: {
    α: "replace",
    name: "Сменить тип свойства",
    target: "Property.kind",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "Property", required: true },
      { name: "kind", type: "select", required: true, options: ["text", "number", "select", "multi_select", "date", "person", "checkbox", "url", "email", "phone", "relation"] },
    ],
    // Сложный — миграция PropertyValue под новый kind. Server-side.
  },

  delete_property: {
    α: "remove",
    name: "Удалить свойство",
    target: "Property",
    confirmation: "click",
    salience: "primary",
    context: { __irr: { point: "medium", reason: "Удаляются все значения" } },
    parameters: [{ name: "id", type: "entityRef", entity: "Property", required: true }],
    particles: { effects: [{ α: "remove", target: "Property", fields: {} }] },
  },

  add_database_row: {
    α: "create",
    name: "Добавить строку",
    target: "DatabaseRow",
    confirmation: "form",
    parameters: [
      { name: "databaseId", type: "entityRef", entity: "Database", required: true },
      { name: "title", type: "text", required: true, label: "Заголовок (Page.title)" },
    ],
    // Two effects: Page + DatabaseRow. Server-side.
  },

  set_property_value: {
    α: "replace",
    name: "Установить значение свойства",
    target: "PropertyValue",
    confirmation: "form",
    parameters: [
      { name: "rowId", type: "entityRef", entity: "DatabaseRow", required: true },
      { name: "propertyId", type: "entityRef", entity: "Property", required: true },
      { name: "valueJson", type: "json", required: true, label: "Значение" },
    ],
    // upsert (create if missing, replace if exists). Server-side.
  },

  bulk_set_property: {
    α: "replace",
    name: "Массовое задание свойства",
    target: "PropertyValue",
    confirmation: "form",
    parameters: [
      { name: "databaseId", type: "entityRef", entity: "Database", required: true },
      { name: "propertyId", type: "entityRef", entity: "Property", required: true },
      { name: "valueJson", type: "json", required: true, label: "Значение для всех строк" },
    ],
    // Server-side bulk
  },

  archive_database: {
    α: "replace",
    name: "Архивировать БД",
    target: "Database.archivedAt",
    confirmation: "click",
    salience: "primary",
    context: { __irr: { point: "medium", reason: "Связанные views и rows становятся скрыты" } },
    parameters: [{ name: "id", type: "entityRef", entity: "Database", required: true }],
    particles: {
      effects: [{ α: "replace", target: "Database.archivedAt", fields: { archivedAt: "{{now}}" } }],
    },
  },

  duplicate_database: {
    α: "create",
    name: "Дублировать БД",
    target: "Database",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Database", required: true },
      { name: "newTitle", type: "text", required: true, label: "Название копии" },
    ],
    // Server-side: copies all properties, views, rows.
  },

  // ─────────────────────────────────────────────────────────────
  // Views (8)
  // ─────────────────────────────────────────────────────────────

  create_view: {
    α: "create",
    name: "Создать вид",
    target: "DatabaseView",
    confirmation: "form",
    parameters: [
      { name: "databaseId", type: "entityRef", entity: "Database", required: true },
      { name: "name", type: "text", required: true, label: "Название" },
      { name: "kind", type: "select", required: true, options: ["table", "board", "gallery", "list", "calendar", "timeline"] },
      { name: "position", type: "number", required: true },
    ],
    particles: {
      effects: [{
        α: "create", target: "DatabaseView",
        fields: {
          id: "{{auto}}",
          databaseId: "{{params.databaseId}}",
          name: "{{params.name}}",
          kind: "{{params.kind}}",
          position: "{{params.position}}",
          filtersJson: {},
        },
      }],
    },
  },

  rename_view: {
    α: "update",
    name: "Переименовать вид",
    target: "DatabaseView",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "DatabaseView", required: true },
      { name: "name", type: "text", required: true },
    ],
    particles: { effects: [{ α: "update", target: "DatabaseView", fields: { name: "{{params.name}}" } }] },
  },

  change_view_kind: {
    α: "replace",
    name: "Сменить тип вида",
    target: "DatabaseView.kind",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "DatabaseView", required: true },
      { name: "kind", type: "select", required: true, options: ["table", "board", "gallery", "list", "calendar", "timeline"] },
    ],
    particles: {
      effects: [{ α: "replace", target: "DatabaseView.kind", fields: { kind: "{{params.kind}}" } }],
    },
  },

  add_filter: {
    α: "update",
    name: "Добавить фильтр",
    target: "DatabaseView.filtersJson",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "DatabaseView", required: true },
      { name: "propertyId", type: "entityRef", entity: "Property", required: true },
      { name: "operator", type: "select", required: true, options: ["equals", "contains", "before", "after"] },
      { name: "value", type: "text", required: true },
    ],
    // Server-side merges into filtersJson
  },

  clear_filters: {
    α: "replace",
    name: "Очистить фильтры",
    target: "DatabaseView.filtersJson",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "DatabaseView", required: true }],
    particles: {
      effects: [{ α: "replace", target: "DatabaseView.filtersJson", fields: { filtersJson: {} } }],
    },
  },

  set_sort: {
    α: "replace",
    name: "Сортировка",
    target: "DatabaseView.sortByPropertyId",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "DatabaseView", required: true },
      { name: "sortByPropertyId", type: "entityRef", entity: "Property", required: true },
      { name: "sortDirection", type: "select", required: true, options: ["asc", "desc"] },
    ],
    particles: {
      effects: [{
        α: "replace", target: "DatabaseView.sortByPropertyId",
        fields: { sortByPropertyId: "{{params.sortByPropertyId}}", sortDirection: "{{params.sortDirection}}" },
      }],
    },
  },

  set_group_by: {
    α: "replace",
    name: "Группировка",
    target: "DatabaseView.groupByPropertyId",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "DatabaseView", required: true },
      { name: "groupByPropertyId", type: "entityRef", entity: "Property", required: true },
    ],
    particles: {
      effects: [{
        α: "replace", target: "DatabaseView.groupByPropertyId",
        fields: { groupByPropertyId: "{{params.groupByPropertyId}}" },
      }],
    },
  },

  set_default_view: {
    α: "replace",
    name: "Установить вид по умолчанию",
    target: "Database.defaultViewId",
    confirmation: "click",
    parameters: [
      { name: "databaseId", type: "entityRef", entity: "Database", required: true },
      { name: "viewId", type: "entityRef", entity: "DatabaseView", required: true },
    ],
    particles: {
      effects: [{
        α: "replace", target: "Database.defaultViewId",
        fields: { defaultViewId: "{{params.viewId}}" },
      }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Comments (5)
  // ─────────────────────────────────────────────────────────────

  add_comment_to_page: {
    α: "create",
    name: "Комментарий к странице",
    target: "Comment",
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "body", type: "textarea", required: true, label: "Комментарий" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Comment",
        fields: {
          id: "{{auto}}",
          pageId: "{{params.pageId}}",
          blockId: null,
          body: "{{params.body}}",
          authorId: "{{viewer.id}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  add_comment_to_block: {
    α: "create",
    name: "Комментарий к блоку",
    target: "Comment",
    confirmation: "form",
    parameters: [
      { name: "blockId", type: "entityRef", entity: "Block", required: true },
      { name: "body", type: "textarea", required: true, label: "Комментарий" },
    ],
    particles: {
      effects: [{
        α: "create", target: "Comment",
        fields: {
          id: "{{auto}}",
          pageId: null,
          blockId: "{{params.blockId}}",
          body: "{{params.body}}",
          authorId: "{{viewer.id}}",
          createdAt: "{{now}}",
        },
      }],
    },
  },

  reply_comment: {
    α: "create",
    name: "Ответить",
    target: "Comment",
    confirmation: "form",
    parameters: [
      { name: "parentCommentId", type: "entityRef", entity: "Comment", required: true },
      { name: "body", type: "textarea", required: true },
    ],
    // Server-side derives pageId/blockId from parent
  },

  resolve_comment: {
    α: "replace",
    name: "Решено",
    target: "Comment.resolvedAt",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Comment", required: true }],
    particles: {
      effects: [{ α: "replace", target: "Comment.resolvedAt", fields: { resolvedAt: "{{now}}" } }],
    },
  },

  delete_comment: {
    α: "remove",
    name: "Удалить комментарий",
    target: "Comment",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Comment", required: true }],
    particles: { effects: [{ α: "remove", target: "Comment", fields: {} }] },
  },

  // ─────────────────────────────────────────────────────────────
  // Permissions (3 — share уже выше)
  // ─────────────────────────────────────────────────────────────

  unshare_page: {
    α: "remove",
    name: "Отозвать доступ",
    target: "PagePermission",
    confirmation: "click",
    salience: "primary",
    context: { __irr: { point: "medium", reason: "Пользователь теряет доступ" } },
    parameters: [{ name: "id", type: "entityRef", entity: "PagePermission", required: true }],
    particles: { effects: [{ α: "remove", target: "PagePermission", fields: {} }] },
  },

  request_access: {
    α: "create",
    name: "Запросить доступ",
    target: "Comment", // surrogate — сообщаем владельцу через комментарий-mention
    confirmation: "form",
    parameters: [
      { name: "pageId", type: "entityRef", entity: "Page", required: true },
      { name: "message", type: "textarea", label: "Обоснование" },
    ],
    // Server side
  },

  // ─────────────────────────────────────────────────────────────
  // Search/Nav (3)
  // ─────────────────────────────────────────────────────────────

  search_workspace: {
    α: "read",
    name: "Поиск",
    target: "Page",
    confirmation: "form",
    parameters: [
      { name: "query", type: "text", required: true, label: "Запрос" },
      { name: "filterKind", type: "select", options: ["page", "database", "block", "all"], label: "Тип" },
    ],
    // Read-only — эффектов нет
  },

  open_recent: {
    α: "read",
    name: "Недавние",
    target: "Page",
    confirmation: "click",
    parameters: [],
    // No effect
  },

  pin_to_sidebar: {
    α: "update",
    name: "Закрепить в сайдбаре",
    target: "Page",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Page", required: true }],
    // Pinning — host-side preference (off-Φ); intent остаётся для derivation
  },

  // ─────────────────────────────────────────────────────────────
  // Agent (3)
  // ─────────────────────────────────────────────────────────────

  agent_create_page: {
    α: "create",
    name: "Агент: создать страницу",
    target: "Page",
    confirmation: "form",
    parameters: [
      { name: "workspaceId", type: "entityRef", entity: "Workspace", required: true },
      { name: "parentPageId", type: "entityRef", entity: "Page", label: "Родитель" },
      { name: "title", type: "text", required: true },
    ],
    // Server-side с preapproval check
  },

  agent_set_property: {
    α: "replace",
    name: "Агент: задать свойство",
    target: "PropertyValue",
    confirmation: "form",
    parameters: [
      { name: "rowId", type: "entityRef", entity: "DatabaseRow", required: true },
      { name: "propertyId", type: "entityRef", entity: "Property", required: true },
      { name: "valueJson", type: "json", required: true },
    ],
  },

  agent_summarize_page: {
    α: "read",
    name: "Агент: суммаризовать",
    target: "Page",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Page", required: true }],
  },
};
