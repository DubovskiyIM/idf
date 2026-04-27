/**
 * Онтология meta-домена — IDF-on-IDF, Level 1 (read-only observability).
 *
 * Предмет домена: сам формат IDF и его экосистема.
 * Сущности: Domain / Intent / Projection / Pattern / Witness / RRule /
 *           Adapter / Capability.
 * Роли: formatAuthor / domainAuthor / patternCurator / integrator.
 * Источник Φ: build-time snapshot (scripts/build-meta-snapshot.mjs)
 * из pattern-bank/, src/domains/*, idf-sdk/packages/*.
 *
 * Цель эксперимента — выяснить, где формат сломается при описании самого
 * себя, и выписать gap'ы в docs/sdk-improvements-backlog.md.
 *
 * Level 1 не имеет write-side: codegen-как-5-й-reader не выбран
 * (см. диалог 2026-04-26 о codegen ≠ reader).
 */

export const ONTOLOGY = {
  domain: "meta",
  features: {
    domainScope: "meta",
  },
  entities: {
    Domain: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        name: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Название",
        },
        title: { type: "text", label: "Заголовок UI" },
        intentCount: { type: "number", label: "Intents" },
        entityCount: { type: "number", label: "Entities" },
        projectionCount: { type: "number", label: "Projections" },
        roleCount: { type: "number", label: "Roles" },
        invariantCount: { type: "number", label: "Invariants" },
        ruleCount: { type: "number", label: "RRules" },
        adapter: {
          type: "select",
          options: ["mantine", "shadcn", "apple", "antd"],
          valueLabels: {
            mantine: "Mantine",
            shadcn: "shadcn/ui",
            apple: "Apple visionOS",
            antd: "AntD",
          },
          label: "UI-адаптер по умолчанию",
        },
        fieldTestNumber: { type: "number", label: "№ полевого теста" },
        domainScope: { type: "text", label: "domainScope" },
        snapshottedAt: {
          type: "datetime",
          fieldRole: "createdAt",
          label: "Срез",
        },
      },
    },

    Intent: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        domainId: {
          type: "entityRef",
          entity: "Domain",
          required: true,
          label: "Домен",
        },
        intentId: { type: "text", label: "intent id" },
        name: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Имя",
        },
        alpha: {
          type: "select",
          options: ["create", "update", "replace", "remove", "add"],
          label: "α",
        },
        target: { type: "text", label: "target" },
        confirmation: {
          type: "select",
          options: ["form", "click", "enter", "auto", "wizard"],
          label: "confirmation",
        },
        category: { type: "text", label: "Категория" },
        hasIrr: { type: "boolean", label: "__irr" },
        irrPoint: {
          type: "select",
          options: ["high", "medium", "low"],
          label: "Точка невозврата",
        },
      },
    },

    Projection: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        domainId: {
          type: "entityRef",
          entity: "Domain",
          required: true,
          label: "Домен",
        },
        projectionId: { type: "text", label: "projection id" },
        title: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Заголовок",
        },
        archetype: {
          type: "select",
          options: [
            "feed",
            "catalog",
            "detail",
            "form",
            "canvas",
            "dashboard",
            "wizard",
          ],
          label: "Архетип",
        },
        mainEntity: { type: "text", label: "mainEntity" },
        derived: { type: "boolean", label: "Derived" },
        forRoles: { type: "text", label: "forRoles (csv)" },
        witnessCount: { type: "number", label: "Witnesses" },
      },
    },

    Pattern: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        patternId: { type: "text", label: "pattern id" },
        name: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Имя",
        },
        status: {
          type: "select",
          options: ["stable", "candidate", "anti"],
          required: true,
          valueLabels: {
            stable: "Stable",
            candidate: "Candidate",
            anti: "Anti",
          },
        },
        axis: {
          type: "select",
          options: ["structural", "behavioral", "matching-only"],
          label: "Ось",
        },
        archetypeScope: {
          type: "select",
          options: ["catalog", "cross", "detail", "feed", "any"],
          label: "Архетип",
        },
        hasApply: { type: "boolean", label: "structure.apply" },
        version: { type: "number", label: "Версия" },
        bankPath: { type: "text", label: "Путь" },
        sourceProduct: { type: "text", label: "Source product" },
      },
    },

    Witness: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        domainId: { type: "entityRef", entity: "Domain", label: "Домен" },
        projectionId: {
          type: "entityRef",
          entity: "Projection",
          required: true,
        },
        archetype: {
          type: "select",
          options: ["feed", "catalog", "detail", "form", "canvas", "dashboard", "wizard"],
          label: "Архетип",
        },
        slotPath: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Слот",
        },
        basis: {
          type: "select",
          options: [
            "crystallize-rule",
            "polymorphic-variant",
            "temporal-section",
            "pattern-bank",
            "alphabetical-fallback",
            "authored",
            "declaration-order",
            "unknown",
          ],
          label: "Basis",
        },
        reliability: {
          type: "select",
          options: ["rule-based", "heuristic", "authorial", "unknown"],
          label: "Reliability",
        },
        patternId: { type: "text", label: "Pattern" },
        ruleId: { type: "text", label: "Crystallize-rule" },
        rationale: { type: "textarea", label: "Rationale" },
        origin: {
          type: "select",
          options: [
            "derived",
            "derived+enriched",
            "authored",
            "authored+enriched",
            null,
          ],
          label: "Origin",
        },
      },
    },

    RRule: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        domainId: { type: "entityRef", entity: "Domain", required: true },
        name: { type: "text", required: true, fieldRole: "primary" },
        kind: {
          type: "select",
          options: ["aggregation", "threshold", "schedule", "condition", "event"],
          label: "Kind",
        },
        trigger: { type: "text", label: "Trigger" },
      },
    },

    Adapter: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        packageName: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "npm-пакет",
        },
        version: { type: "text", label: "Версия" },
        license: { type: "text", label: "Лицензия" },
        style: { type: "text", label: "Стиль" },
        defaultFor: { type: "text", label: "Дефолт для (csv)" },
      },
    },

    Capability: {
      ownerField: null,
      fields: {
        id: { type: "text", fieldRole: "id" },
        adapterId: {
          type: "entityRef",
          entity: "Adapter",
          required: true,
        },
        namespace: {
          type: "select",
          options: [
            "chart",
            "statistic",
            "sparkline",
            "map",
            "interaction",
            "shell",
            "primitive",
          ],
          label: "Namespace",
        },
        key: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Capability",
        },
        supported: { type: "boolean", label: "Поддерживается" },
        variant: { type: "text", label: "Вариант" },
      },
    },

    // ── Level 2 soft-authoring (§13.0 решение б) ─────────────
    // Φ-events этой сущности применяются compiler'ом к
    // docs/sdk-improvements-backlog.md между маркерами
    // <!-- meta-compile: backlog-inbox --> ... <!-- /meta-compile -->.
    BacklogItem: {
      ownerField: "createdByUserId",
      fields: {
        id: { type: "text", fieldRole: "id" },
        section: {
          type: "select",
          options: ["P0", "P1", "P2", "research", "deferred"],
          required: true,
          valueLabels: {
            P0: "P0 (блокер)",
            P1: "P1 (важно)",
            P2: "P2 (nice-to-have)",
            research: "Research",
            deferred: "Deferred",
          },
        },
        title: {
          type: "text",
          required: true,
          fieldRole: "primary",
          label: "Заголовок",
        },
        description: { type: "textarea", label: "Описание" },
        sourceLink: { type: "url", label: "Источник (ref)" },
        affectedDomain: {
          type: "entityRef",
          entity: "Domain",
          label: "Затронутый домен",
        },
        status: {
          type: "select",
          options: ["open", "scheduled", "closed", "rejected"],
          required: true,
          valueLabels: {
            open: "Открыт",
            scheduled: "Запланирован",
            closed: "Закрыт",
            rejected: "Отклонён",
          },
        },
        createdByUserId: {
          type: "entityRef",
          entity: "User",
          label: "Автор",
        },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
        compiledAt: { type: "datetime", label: "Запатчено в файл" },
      },
    },
  },

  roles: {
    formatAuthor: {
      base: "admin",
      visibleFields: {
        Domain: ["*"],
        Intent: ["*"],
        Projection: ["*"],
        Pattern: ["*"],
        Witness: ["*"],
        RRule: ["*"],
        Adapter: ["*"],
        Capability: ["*"],
        BacklogItem: ["*"],
      },
      canExecute: [
        "add_backlog_item",
        "schedule_backlog_item",
        "close_backlog_item",
        "reject_backlog_item",
      ],
    },

    domainAuthor: {
      base: "viewer",
      visibleFields: {
        Domain: ["*"],
        Intent: ["*"],
        Projection: ["*"],
        Witness: ["*"],
        RRule: ["*"],
        BacklogItem: ["*"],
      },
      canExecute: ["add_backlog_item"],
    },

    patternCurator: {
      base: "viewer",
      visibleFields: {
        Pattern: ["*"],
        Witness: ["*"],
        Projection: ["id", "projectionId", "domainId", "archetype", "title"],
      },
      canExecute: [],
    },

    integrator: {
      base: "viewer",
      visibleFields: {
        Adapter: ["*"],
        Capability: ["*"],
        Pattern: ["id", "patternId", "name", "status", "archetypeScope"],
      },
      canExecute: [],
    },
  },

  invariants: [
    { kind: "referential", from: "Intent.domainId", to: "Domain.id", name: "intent_in_domain" },
    { kind: "referential", from: "Projection.domainId", to: "Domain.id", name: "projection_in_domain" },
    { kind: "referential", from: "RRule.domainId", to: "Domain.id", name: "rule_in_domain" },
    { kind: "referential", from: "Witness.projectionId", to: "Projection.id", name: "witness_on_projection" },
    { kind: "referential", from: "Witness.patternId", to: "Pattern.id", name: "witness_via_pattern" },
    { kind: "referential", from: "Capability.adapterId", to: "Adapter.id", name: "capability_of_adapter" },
    {
      kind: "expression",
      name: "stable_pattern_has_apply_or_matching_only",
      entity: "Pattern",
      predicate:
        "(row) => row.status !== 'stable' || row.hasApply === true || row.axis === 'matching-only'",
    },
    {
      kind: "transition",
      entity: "BacklogItem",
      field: "status",
      transitions: {
        open: ["scheduled", "closed", "rejected"],
        scheduled: ["closed", "open", "rejected"],
        rejected: ["open"],
      },
      name: "backlog_lifecycle",
    },
  ],

  rules: [],
};
