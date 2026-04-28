/**
 * Projections meta-домена.
 *
 * 6 projection'ов покрывают 4 роли:
 *   - domain_list / domain_detail        — formatAuthor / domainAuthor
 *   - pattern_bank_browser / pattern_detail — patternCurator + все
 *   - witness_review_queue                  — patternCurator
 *   - adapter_capability_matrix             — integrator
 *
 * Большинство projection'ов derived (catalog/detail). Custom только
 * adapter_capability_matrix (dashboard со специальной структурой).
 */

export const PROJECTIONS = {
  // Studio-shell projection — primary entry для /meta route. Layout двух
  // панелей (chat-history + tabbed spec-panel), повторяет визуальный
  // язык Fold Studio. Custom canvas, рендерится через registerCanvas.
  meta_studio: {
    id: "meta_studio",
    title: "Meta Studio",
    archetype: "canvas",
    mainEntity: "Domain",
    forRoles: ["formatAuthor", "domainAuthor", "patternCurator", "integrator"],
    witnesses: ["name", "title", "entityCount", "intentCount", "projectionCount"],
  },

  // Domain detail с reverse-associations (§13.7) — показывает intents /
  // projections / rrules / witnesses одного домена.
  domain_detail: {
    id: "domain_detail",
    title: "Домен",
    archetype: "detail",
    mainEntity: "Domain",
    idParam: "domainId",
    forRoles: ["formatAuthor", "domainAuthor"],
    witnesses: [
      "name",
      "title",
      "adapter",
      "fieldTestNumber",
      "entityCount",
      "roleCount",
      "intentCount",
      "projectionCount",
      "invariantCount",
      "ruleCount",
    ],
    slots: {
      hero: {
        kind: "card",
        fields: ["title", "adapter", "fieldTestNumber", "entityCount", "intentCount", "projectionCount"],
      },
    },
    subCollections: [
      { entity: "Intent", foreignKey: "domainId", title: "Intents" },
      { entity: "Projection", foreignKey: "domainId", title: "Projections" },
      { entity: "RRule", foreignKey: "domainId", title: "Reactive Rules" },
      { entity: "Witness", foreignKey: "domainId", title: "Witnesses" },
    ],
  },

  pattern_bank_browser: {
    id: "pattern_bank_browser",
    title: "Pattern Bank",
    archetype: "catalog",
    mainEntity: "Pattern",
    forRoles: ["formatAuthor", "domainAuthor", "patternCurator", "integrator"],
    witnesses: ["name", "status", "archetypeScope", "axis", "hasApply"],
    onItemClick: "pattern_detail",
    slots: {
      header: {
        kind: "facetFilter",
        field: "status",
        options: ["stable", "candidate", "anti"],
      },
    },
  },

  pattern_detail: {
    id: "pattern_detail",
    title: "Паттерн",
    archetype: "detail",
    mainEntity: "Pattern",
    idParam: "patternId",
    forRoles: ["formatAuthor", "domainAuthor", "patternCurator", "integrator"],
    witnesses: ["name", "status", "axis", "version", "hasApply", "bankPath"],
  },

  witness_review_queue: {
    id: "witness_review_queue",
    title: "Очередь witness'ов",
    archetype: "catalog",
    mainEntity: "Witness",
    forRoles: ["formatAuthor", "domainAuthor", "patternCurator"],
    witnesses: ["slotPath", "basis", "reliability", "patternId"],
    slots: {
      header: {
        kind: "facetFilter",
        field: "basis",
        options: [
          "declaration-order",
          "alphabetical-fallback",
          "pattern-bank",
          "explicit-salience",
          "derived",
        ],
      },
    },
  },

  promotion_queue: {
    id: "promotion_queue",
    title: "Очередь промоций паттернов",
    archetype: "catalog",
    mainEntity: "PatternPromotion",
    forRoles: ["formatAuthor", "patternCurator"],
    witnesses: ["candidateId", "targetArchetype", "status", "requestedAt"],
    onItemClick: "promotion_detail",
    slots: {
      header: {
        kind: "facetFilter",
        field: "status",
        options: ["pending", "approved", "rejected", "shipped"],
      },
      hero: { kind: "intent", intentId: "request_pattern_promotion" },
    },
  },

  promotion_detail: {
    id: "promotion_detail",
    title: "Промоция",
    archetype: "detail",
    mainEntity: "PatternPromotion",
    idParam: "promotionId",
    forRoles: ["formatAuthor", "patternCurator"],
    witnesses: [
      "candidateId",
      "targetArchetype",
      "rationale",
      "falsificationFixtures",
      "status",
      "sdkPrUrl",
      "requestedAt",
      "decidedAt",
    ],
    slots: {
      toolbar: {
        intents: [
          "approve_pattern_promotion",
          "reject_pattern_promotion",
          "ship_pattern_promotion",
        ],
      },
    },
  },

  backlog_inbox: {
    id: "backlog_inbox",
    title: "Backlog inbox",
    archetype: "catalog",
    mainEntity: "BacklogItem",
    forRoles: ["formatAuthor", "domainAuthor"],
    witnesses: ["title", "section", "status", "affectedDomain", "createdAt"],
    onItemClick: "backlog_item_detail",
    slots: {
      header: {
        kind: "facetFilter",
        field: "status",
        options: ["open", "scheduled", "closed", "rejected"],
      },
      hero: { kind: "intent", intentId: "add_backlog_item" },
    },
  },

  backlog_item_detail: {
    id: "backlog_item_detail",
    title: "Backlog item",
    archetype: "detail",
    mainEntity: "BacklogItem",
    idParam: "backlogItemId",
    forRoles: ["formatAuthor", "domainAuthor"],
    witnesses: [
      "title",
      "section",
      "status",
      "description",
      "sourceLink",
      "affectedDomain",
      "createdAt",
      "compiledAt",
    ],
    slots: {
      toolbar: {
        intents: [
          "schedule_backlog_item",
          "close_backlog_item",
          "reject_backlog_item",
        ],
      },
    },
  },

  adapter_capability_matrix: {
    id: "adapter_capability_matrix",
    title: "Adapter capability surface",
    archetype: "catalog",
    mainEntity: "Capability",
    forRoles: ["formatAuthor", "integrator"],
    witnesses: ["adapterId", "namespace", "key", "supported", "variant"],
    slots: {
      header: {
        kind: "facetFilter",
        field: "namespace",
        options: [
          "chart",
          "statistic",
          "sparkline",
          "map",
          "interaction",
          "shell",
          "primitive",
        ],
      },
    },
  },

  // ── Self-hosting fixed-point experiment (2026-04-28) ─────────
  // Work queue для LLM-агента: Intent'ы без salience — work item
  // kind=missing-salience. Catalog поверх Intent с filter в shape.
  // Дополнительные work-item kinds (missing-witness, meta-modification)
  // выводятся orchestrator'ом из Φ; они не имеют отдельной projection,
  // потому что witness-gap'ы — отрицание данных, не данные.
  meta_work_queue: {
    id: "meta_work_queue",
    title: "Meta work queue (experiment)",
    archetype: "catalog",
    mainEntity: "Intent",
    forRoles: ["formatAuthor"],
    witnesses: ["intentId", "domainId", "name", "alpha", "salience", "category"],
    slots: {
      header: {
        kind: "facetFilter",
        field: "salience",
        options: ["primary", "secondary", "tertiary"],
      },
      hero: { kind: "intent", intentId: "propose_intent_salience" },
    },
  },
};

// V2Shell контракт: ROOT_PROJECTIONS — flat array или array of {section, items}.
// Role-фильтрация делается через projection.forRoles, а не через map по роли.
// Sections группируют по семантике (см. notion fix 2026-04-26).
export const ROOT_PROJECTIONS = [
  {
    section: "Studio",
    items: ["meta_studio"],
  },
  {
    section: "Каталоги",
    items: ["domain_list", "intent_list", "projection_list", "rrule_list"],
  },
  {
    section: "Pattern Bank",
    items: ["pattern_bank_browser", "witness_review_queue", "promotion_queue"],
  },
  {
    section: "Адаптеры",
    items: ["adapter_list", "adapter_capability_matrix"],
  },
  {
    section: "Backlog (Level 2)",
    items: ["backlog_inbox"],
  },
  {
    section: "Experiment",
    items: ["meta_work_queue"],
  },
];
