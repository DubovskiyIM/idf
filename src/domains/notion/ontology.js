/**
 * Онтология notion-домена — block-based knowledge management в духе Notion.
 *
 * 18-й полевой тест IDF (после Automation 17-го).
 *
 * Стресс-тесты:
 *   - **self-referential hierarchy** — Page.parentPageId → Page (страницы-дерево)
 *   - **polymorphic entity** — Block через core@0.74 polymorphic API
 *     (15 типов блоков: paragraph / heading / list / todo / code / image / ...)
 *   - **multi-view database** — DatabaseView с kind = table/board/gallery/calendar/timeline
 *   - **permission inheritance** — PagePermission с наследованием от parentPage и Workspace
 *   - **property-engine** — Property + PropertyValue (KV) для гибких schemas
 *
 * Lineage: AntD enterprise (invest → compliance → keycloak → argocd → automation → notion).
 */

export const ONTOLOGY = {
  domain: "notion",
  features: {
    domainScope: "notion",
    structureApply: true,
  },
  entities: {
    User: {
      ownerField: "id",
      fields: {
        id: { type: "text" },
        email: { type: "email", label: "Email" },
        name: { type: "text", required: true, fieldRole: "primary", label: "Имя" },
        avatarUrl: { type: "url", label: "Аватар" },
      },
    },

    Workspace: {
      ownerField: "ownerId",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, fieldRole: "primary", label: "Название" },
        ownerId: { type: "entityRef", entity: "User", required: true, label: "Владелец" },
        plan: {
          type: "select",
          options: ["free", "team", "enterprise"],
          required: true,
          valueLabels: { free: "Free", team: "Team", enterprise: "Enterprise" },
          label: "План",
        },
        defaultPermissionLevel: {
          type: "select",
          options: ["edit", "comment", "view", "none"],
          valueLabels: { edit: "Редактировать", comment: "Комментировать", view: "Просмотр", none: "Нет доступа" },
          label: "Доступ по умолчанию",
        },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
      },
    },

    WorkspaceMember: {
      kind: "assignment",
      fields: {
        id: { type: "text" },
        userId: { type: "entityRef", entity: "User", required: true },
        workspaceId: { type: "entityRef", entity: "Workspace", required: true },
        role: {
          type: "select",
          options: ["workspaceOwner", "editor", "commenter", "viewer", "guest"],
          required: true,
          valueLabels: {
            workspaceOwner: "Владелец",
            editor: "Редактор",
            commenter: "Комментатор",
            viewer: "Зритель",
            guest: "Гость",
          },
          label: "Роль",
          fieldRole: "primary",
        },
        invitedAt: { type: "datetime", fieldRole: "createdAt" },
      },
      role: { scope: "workspaceId" },
    },

    Page: {
      ownerField: null, // ownership через workspaceId, computed
      temporal: true,
      fields: {
        id: { type: "text" },
        workspaceId: { type: "entityRef", entity: "Workspace", required: true },
        parentPageId: { type: "entityRef", entity: "Page", label: "Родительская страница" },
        title: { type: "text", required: true, fieldRole: "primary", label: "Заголовок" },
        icon: { type: "text", label: "Иконка" }, // emoji or url:foo
        coverImageUrl: { type: "url", label: "Обложка" },
        position: { type: "number", label: "Порядок", fieldRole: "sort" },
        archivedAt: { type: "datetime", label: "Архив" },
        createdById: { type: "entityRef", entity: "User", label: "Создал" },
        lastEditedById: { type: "entityRef", entity: "User", label: "Изменил" },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
        updatedAt: { type: "datetime", fieldRole: "updatedAt" },
      },
    },

    Block: {
      kind: "polymorphic",
      discriminator: "kind",
      fields: {
        id: { type: "text" },
        pageId: { type: "entityRef", entity: "Page", required: true },
        position: { type: "number", required: true, label: "Порядок", fieldRole: "sort" },
        parentBlockId: { type: "entityRef", entity: "Block", label: "Родительский блок" }, // для indent
        createdAt: { type: "datetime", fieldRole: "createdAt" },
      },
      variants: {
        paragraph: {
          label: "Параграф",
          fields: {
            text: { type: "textarea", required: true, label: "Текст" },
          },
        },
        heading_1: {
          label: "Заголовок H1",
          fields: { text: { type: "text", required: true, label: "Заголовок" } },
        },
        heading_2: {
          label: "Заголовок H2",
          fields: { text: { type: "text", required: true, label: "Заголовок" } },
        },
        heading_3: {
          label: "Заголовок H3",
          fields: { text: { type: "text", required: true, label: "Заголовок" } },
        },
        bulleted_list: {
          label: "Маркированный список",
          fields: { text: { type: "textarea", required: true, label: "Текст" } },
        },
        numbered_list: {
          label: "Нумерованный список",
          fields: { text: { type: "textarea", required: true, label: "Текст" } },
        },
        todo: {
          label: "Задача",
          fields: {
            text: { type: "textarea", required: true, label: "Задача" },
            checked: { type: "boolean", label: "Выполнено" },
          },
        },
        toggle: {
          label: "Сворачиваемый блок",
          fields: {
            text: { type: "text", required: true, label: "Заголовок" },
            collapsed: { type: "boolean", label: "Свёрнут" },
          },
        },
        quote: {
          label: "Цитата",
          fields: { text: { type: "textarea", required: true, label: "Цитата" } },
        },
        callout: {
          label: "Сноска",
          fields: {
            text: { type: "textarea", required: true, label: "Текст" },
            emoji: { type: "text", label: "Emoji" },
            color: {
              type: "select",
              options: ["default", "blue", "yellow", "green", "red", "purple"],
              valueLabels: {
                default: "Серый", blue: "Синий", yellow: "Жёлтый",
                green: "Зелёный", red: "Красный", purple: "Фиолетовый",
              },
              label: "Цвет",
            },
          },
        },
        code: {
          label: "Код",
          fields: {
            text: { type: "textarea", required: true, label: "Код" },
            language: {
              type: "select",
              options: ["plaintext", "javascript", "typescript", "python", "go", "rust", "sql", "bash", "json", "yaml", "markdown"],
              valueLabels: {
                plaintext: "Plain", javascript: "JavaScript", typescript: "TypeScript",
                python: "Python", go: "Go", rust: "Rust", sql: "SQL",
                bash: "Bash", json: "JSON", yaml: "YAML", markdown: "Markdown",
              },
              label: "Язык",
            },
          },
        },
        divider: {
          label: "Разделитель",
          fields: {},
        },
        image: {
          label: "Изображение",
          fields: {
            src: { type: "url", required: true, label: "Источник" },
            caption: { type: "text", label: "Подпись" },
          },
        },
        embed: {
          label: "Встраивание",
          fields: {
            url: { type: "url", required: true, label: "URL" },
            provider: {
              type: "select",
              options: ["youtube", "figma", "loom", "miro", "other"],
              valueLabels: { youtube: "YouTube", figma: "Figma", loom: "Loom", miro: "Miro", other: "Другое" },
              label: "Провайдер",
            },
          },
        },
        database_inline: {
          label: "Встроенная БД",
          fields: {
            databaseId: { type: "entityRef", entity: "Database", required: true, label: "База" },
            viewId: { type: "entityRef", entity: "DatabaseView", label: "Вид (опц.)" },
          },
        },
      },
    },

    Database: {
      ownerField: null,
      fields: {
        id: { type: "text" },
        workspaceId: { type: "entityRef", entity: "Workspace", required: true },
        parentPageId: { type: "entityRef", entity: "Page", label: "Родительская страница" },
        title: { type: "text", required: true, fieldRole: "primary", label: "Название" },
        defaultViewId: { type: "entityRef", entity: "DatabaseView", label: "Вид по умолчанию" },
        archivedAt: { type: "datetime", label: "Архив" },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
      },
    },

    DatabaseView: {
      fields: {
        id: { type: "text" },
        databaseId: { type: "entityRef", entity: "Database", required: true },
        name: { type: "text", required: true, fieldRole: "primary", label: "Название вида" },
        kind: {
          type: "select",
          options: ["table", "board", "gallery", "list", "calendar", "timeline"],
          required: true,
          valueLabels: {
            table: "Таблица",
            board: "Канбан",
            gallery: "Галерея",
            list: "Список",
            calendar: "Календарь",
            timeline: "Таймлайн",
          },
          label: "Тип",
        },
        groupByPropertyId: { type: "entityRef", entity: "Property", label: "Группировка по" },
        sortByPropertyId: { type: "entityRef", entity: "Property", label: "Сортировка по" },
        sortDirection: {
          type: "select",
          options: ["asc", "desc"],
          valueLabels: { asc: "По возрастанию", desc: "По убыванию" },
          label: "Направление",
        },
        filtersJson: { type: "json", label: "Фильтры" },
        position: { type: "number", label: "Порядок", fieldRole: "sort" },
      },
    },

    Property: {
      fields: {
        id: { type: "text" },
        databaseId: { type: "entityRef", entity: "Database", required: true },
        name: { type: "text", required: true, fieldRole: "primary", label: "Название" },
        kind: {
          type: "select",
          options: [
            "text", "number", "select", "multi_select", "date", "person",
            "checkbox", "url", "email", "phone", "relation",
          ],
          required: true,
          valueLabels: {
            text: "Текст", number: "Число", select: "Выбор", multi_select: "Мульти-выбор",
            date: "Дата", person: "Человек", checkbox: "Чекбокс", url: "URL",
            email: "Email", phone: "Телефон", relation: "Связь",
          },
          label: "Тип",
        },
        optionsJson: { type: "json", label: "Варианты" }, // для select/multi_select
        relationToDatabaseId: { type: "entityRef", entity: "Database", label: "Связь с БД" }, // для relation
        position: { type: "number", label: "Порядок", fieldRole: "sort" },
      },
    },

    DatabaseRow: {
      fields: {
        id: { type: "text" },
        databaseId: { type: "entityRef", entity: "Database", required: true },
        pageId: { type: "entityRef", entity: "Page", required: true }, // row IS-A page
        position: { type: "number", label: "Порядок", fieldRole: "sort" },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
      },
    },

    PropertyValue: {
      kind: "assignment",
      fields: {
        id: { type: "text" },
        rowId: { type: "entityRef", entity: "DatabaseRow", required: true },
        propertyId: { type: "entityRef", entity: "Property", required: true },
        valueJson: { type: "json", label: "Значение" }, // полиморфный по property.kind
      },
      role: { scope: "rowId" },
    },

    Comment: {
      ownerField: "authorId",
      temporal: true,
      fields: {
        id: { type: "text" },
        pageId: { type: "entityRef", entity: "Page", label: "Страница" }, // sparse: либо pageId, либо blockId
        blockId: { type: "entityRef", entity: "Block", label: "Блок" },
        body: { type: "textarea", required: true, fieldRole: "primary", label: "Комментарий" },
        authorId: { type: "entityRef", entity: "User", required: true, label: "Автор" },
        parentCommentId: { type: "entityRef", entity: "Comment", label: "Родительский" }, // для thread
        resolvedAt: { type: "datetime", label: "Решено" },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
      },
    },

    PagePermission: {
      kind: "assignment",
      fields: {
        id: { type: "text" },
        pageId: { type: "entityRef", entity: "Page", required: true },
        userId: { type: "entityRef", entity: "User", required: true },
        level: {
          type: "select",
          options: ["edit", "comment", "view", "none"],
          required: true,
          valueLabels: { edit: "Редактировать", comment: "Комментировать", view: "Просмотр", none: "Нет доступа" },
          label: "Уровень",
          fieldRole: "primary",
        },
        grantedAt: { type: "datetime", fieldRole: "createdAt" },
        grantedById: { type: "entityRef", entity: "User", label: "Кем выдано" },
      },
      role: { scope: "pageId" },
    },
  },

  roles: {
    workspaceOwner: {
      base: "owner",
      visibleFields: {
        Workspace: ["*"],
        WorkspaceMember: ["*"],
        Page: ["*"],
        Block: ["*"],
        Database: ["*"],
        DatabaseView: ["*"],
        Property: ["*"],
        DatabaseRow: ["*"],
        PropertyValue: ["*"],
        Comment: ["*"],
        PagePermission: ["*"],
        User: ["id", "name", "email", "avatarUrl"],
      },
      canExecute: [
        // Workspace
        "create_workspace", "rename_workspace", "set_workspace_default_permission",
        "invite_member", "revoke_member", "change_member_role",
        // Pages
        "create_page", "create_subpage", "rename_page", "set_page_icon",
        "set_cover_image", "move_page", "duplicate_page",
        "archive_page", "unarchive_page",
        // Blocks
        "add_block", "update_block_content", "change_block_kind",
        "reorder_blocks", "indent_block", "outdent_block", "delete_block",
        "convert_to_database", "add_image_block", "add_code_block",
        "embed_link", "add_callout_block",
        // Databases
        "create_database", "add_property", "rename_property",
        "change_property_kind", "delete_property",
        "add_database_row", "set_property_value", "bulk_set_property",
        "archive_database", "duplicate_database",
        // Views
        "create_view", "rename_view", "change_view_kind",
        "add_filter", "clear_filters", "set_sort", "set_group_by",
        "set_default_view",
        // Comments
        "add_comment_to_page", "add_comment_to_block", "reply_comment",
        "resolve_comment", "delete_comment",
        // Permissions
        "share_page", "unshare_page", "request_access",
        // Search/Nav
        "search_workspace", "open_recent", "pin_to_sidebar",
      ],
    },

    editor: {
      base: "owner",
      visibleFields: {
        Workspace: ["id", "name", "plan"],
        WorkspaceMember: ["id", "userId", "role", "invitedAt"],
        Page: ["*"],
        Block: ["*"],
        Database: ["*"],
        DatabaseView: ["*"],
        Property: ["*"],
        DatabaseRow: ["*"],
        PropertyValue: ["*"],
        Comment: ["*"],
        PagePermission: ["id", "pageId", "userId", "level"],
        User: ["id", "name", "email", "avatarUrl"],
      },
      canExecute: [
        // Pages
        "create_page", "create_subpage", "rename_page", "set_page_icon",
        "set_cover_image", "move_page", "duplicate_page", "archive_page", "unarchive_page",
        // Blocks
        "add_block", "update_block_content", "change_block_kind",
        "reorder_blocks", "indent_block", "outdent_block", "delete_block",
        "convert_to_database", "add_image_block", "add_code_block",
        "embed_link", "add_callout_block",
        // Databases
        "create_database", "add_property", "rename_property",
        "change_property_kind", "delete_property",
        "add_database_row", "set_property_value", "bulk_set_property",
        "duplicate_database",
        // Views
        "create_view", "rename_view", "change_view_kind",
        "add_filter", "clear_filters", "set_sort", "set_group_by",
        "set_default_view",
        // Comments
        "add_comment_to_page", "add_comment_to_block", "reply_comment",
        "resolve_comment", "delete_comment",
        // Permissions (limited)
        "share_page", "request_access",
        // Search/Nav
        "search_workspace", "open_recent", "pin_to_sidebar",
      ],
    },

    commenter: {
      base: "viewer",
      visibleFields: {
        Workspace: ["id", "name"],
        Page: ["id", "workspaceId", "parentPageId", "title", "icon", "coverImageUrl", "position", "archivedAt"],
        Block: ["*"],
        Database: ["id", "title", "parentPageId"],
        DatabaseView: ["id", "databaseId", "name", "kind"],
        Property: ["id", "databaseId", "name", "kind"],
        DatabaseRow: ["id", "databaseId", "pageId"],
        PropertyValue: ["id", "rowId", "propertyId", "valueJson"],
        Comment: ["*"],
        PagePermission: ["id", "pageId", "userId", "level"],
        User: ["id", "name", "avatarUrl"],
      },
      canExecute: [
        "add_comment_to_page", "add_comment_to_block", "reply_comment",
        "resolve_comment",
        "search_workspace", "open_recent",
      ],
    },

    viewer: {
      base: "viewer",
      visibleFields: {
        Workspace: ["id", "name"],
        Page: ["id", "workspaceId", "parentPageId", "title", "icon"],
        Block: ["*"],
        Database: ["id", "title"],
        DatabaseView: ["id", "databaseId", "name", "kind"],
        Property: ["id", "databaseId", "name", "kind"],
        DatabaseRow: ["id", "databaseId", "pageId"],
        PropertyValue: ["id", "rowId", "propertyId", "valueJson"],
        Comment: ["id", "pageId", "blockId", "body", "authorId", "createdAt"],
        User: ["id", "name", "avatarUrl"],
      },
      canExecute: ["search_workspace", "open_recent"],
    },

    agent: {
      base: "agent",
      canExecute: [
        "agent_create_page",
        "agent_set_property",
        "agent_summarize_page",
      ],
      preapproval: {
        entity: "WorkspaceMember",
        ownerField: "userId",
        checks: [
          { kind: "active", field: "role", expectIn: ["editor", "workspaceOwner"] },
        ],
        requiredFor: ["agent_create_page", "agent_set_property"],
      },
      visibleFields: {
        Workspace: ["id", "name"],
        Page: ["id", "workspaceId", "parentPageId", "title", "createdById"],
        Block: ["*"],
        Database: ["id", "title"],
        Property: ["id", "databaseId", "name", "kind"],
        DatabaseRow: ["*"],
        PropertyValue: ["*"],
      },
    },
  },

  invariants: [
    // Referential FK
    { kind: "referential", from: "WorkspaceMember.userId", to: "User.id", name: "member_user" },
    { kind: "referential", from: "WorkspaceMember.workspaceId", to: "Workspace.id", name: "member_workspace" },
    { kind: "referential", from: "Page.workspaceId", to: "Workspace.id", name: "page_workspace" },
    { kind: "referential", from: "Page.parentPageId", to: "Page.id", name: "page_parent" },
    { kind: "referential", from: "Page.createdById", to: "User.id", name: "page_created_by" },
    { kind: "referential", from: "Block.pageId", to: "Page.id", name: "block_page" },
    { kind: "referential", from: "Block.parentBlockId", to: "Block.id", name: "block_parent" },
    { kind: "referential", from: "Database.workspaceId", to: "Workspace.id", name: "db_workspace" },
    { kind: "referential", from: "Database.parentPageId", to: "Page.id", name: "db_parent_page" },
    { kind: "referential", from: "DatabaseView.databaseId", to: "Database.id", name: "view_database" },
    { kind: "referential", from: "Property.databaseId", to: "Database.id", name: "property_database" },
    { kind: "referential", from: "DatabaseRow.databaseId", to: "Database.id", name: "row_database" },
    { kind: "referential", from: "DatabaseRow.pageId", to: "Page.id", name: "row_page" },
    { kind: "referential", from: "PropertyValue.rowId", to: "DatabaseRow.id", name: "pv_row" },
    { kind: "referential", from: "PropertyValue.propertyId", to: "Property.id", name: "pv_property" },
    { kind: "referential", from: "Comment.authorId", to: "User.id", name: "comment_author" },
    { kind: "referential", from: "Comment.parentCommentId", to: "Comment.id", name: "comment_parent" },
    { kind: "referential", from: "PagePermission.pageId", to: "Page.id", name: "perm_page" },
    { kind: "referential", from: "PagePermission.userId", to: "User.id", name: "perm_user" },

    // Cardinality — уникальность пары (userId, workspaceId) в WorkspaceMember
    {
      kind: "cardinality",
      name: "one_membership_per_user_workspace",
      entity: "WorkspaceMember",
      groupBy: ["userId", "workspaceId"],
      max: 1,
    },
    // Уникальность (userId, pageId) в PagePermission
    {
      kind: "cardinality",
      name: "one_permission_per_user_page",
      entity: "PagePermission",
      groupBy: ["userId", "pageId"],
      max: 1,
    },
    // Уникальность (rowId, propertyId) в PropertyValue
    {
      kind: "cardinality",
      name: "one_value_per_row_property",
      entity: "PropertyValue",
      groupBy: ["rowId", "propertyId"],
      max: 1,
    },
    // Уникальность (databaseId, position) для DatabaseView
    {
      kind: "cardinality",
      name: "unique_view_position",
      entity: "DatabaseView",
      groupBy: ["databaseId", "position"],
      max: 1,
    },

    // Transition — Page.archivedAt forward-only (восстановление только workspaceOwner)
    {
      kind: "expression",
      name: "page_unarchive_only_by_owner",
      entity: "Page",
      // unarchive (was non-null → becomes null) — недопустим как обычное обновление;
      // workspaceOwner делает через специальный intent (unarchive_page),
      // который проходит invariant-check за счёт viewer.role === 'workspaceOwner'.
      predicate:
        "(row, _world, viewer, ctx) => !(ctx?.previousArchivedAt && !row.archivedAt && viewer?.role !== 'workspaceOwner')",
    },

    // Expression — Comment должен иметь либо pageId, либо blockId (sparse FK)
    {
      kind: "expression",
      name: "comment_target_required",
      entity: "Comment",
      predicate: "row => !!row.pageId || !!row.blockId",
    },
    // Expression — Comment не может быть прикреплён к обоим
    {
      kind: "expression",
      name: "comment_target_exclusive",
      entity: "Comment",
      predicate: "row => !(row.pageId && row.blockId)",
    },
    // Expression — page нельзя сделать своим же предком (cycle prevention)
    {
      kind: "expression",
      name: "page_no_self_parent",
      entity: "Page",
      predicate: "row => row.parentPageId !== row.id",
    },
    // Expression — Block.kind ∈ enum (защита от мусорных kind'ов из import)
    {
      kind: "expression",
      name: "block_kind_known",
      entity: "Block",
      predicate:
        "row => ['paragraph','heading_1','heading_2','heading_3','bulleted_list','numbered_list','todo','toggle','quote','callout','code','divider','image','embed','database_inline'].includes(row.kind)",
    },
    // Expression — comment body length 1..10000
    {
      kind: "expression",
      name: "comment_body_length",
      entity: "Comment",
      predicate: "row => typeof row.body === 'string' && row.body.length >= 1 && row.body.length <= 10000",
    },
    // Expression — DatabaseView с kind=board требует groupByPropertyId
    {
      kind: "expression",
      name: "board_view_requires_groupby",
      entity: "DatabaseView",
      predicate: "row => row.kind !== 'board' || !!row.groupByPropertyId",
    },
  ],

  rules: [
    {
      name: "auto_unarchive_recent_restore",
      trigger: "page.archived",
      schedule: { after: "30d", revokeOn: "page.unarchived" },
      effect: { kind: "log", message: "Page hard-delete grace period ended" },
    },
    {
      name: "notify_on_resolved_comment",
      trigger: "comment.resolved",
      effect: { kind: "log", message: "Comment thread resolved" },
    },
  ],
};
