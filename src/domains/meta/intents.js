/**
 * Intents meta-домена.
 *
 * Level 2 (soft-authoring §13.0 решение «б»): Φ-effects пишутся в общий
 * журнал как обычные `confirmed` записи. Compiler `scripts/meta-compile.mjs`
 * читает Φ и эмиттит patch'и в .md/.json/.cjs между маркерами
 * `<!-- meta-compile: <id> -->`. Compiler — НЕ пятая материализация
 * (writer-of-source ≠ reader-of-format).
 *
 * Первая волна write-intents — только BacklogItem:
 *   add_backlog_item     — append-only inbox, idempotency через intent.id
 *   schedule_backlog_item — open → scheduled
 *   close_backlog_item    — * → closed
 *   reject_backlog_item   — * → rejected
 *
 * Будущие волны (когда compiler покроет .json/.cjs targets):
 *   promote_pattern_from_candidate_to_stable
 *   add_witness_review
 *   bump_ontology_version
 *   register_adapter_capability
 */

export const INTENTS = {
  add_backlog_item: {
    α: "create",
    name: "Добавить в backlog",
    target: "BacklogItem",
    confirmation: "form",
    parameters: [
      {
        name: "section",
        type: "select",
        options: ["P0", "P1", "P2", "research", "deferred"],
        required: true,
        label: "Приоритет",
      },
      { name: "title", type: "text", required: true, label: "Заголовок" },
      { name: "description", type: "textarea", label: "Описание" },
      { name: "sourceLink", type: "url", label: "Ref" },
      {
        name: "affectedDomain",
        type: "entityRef",
        entity: "Domain",
        label: "Затронутый домен",
      },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "BacklogItem",
          fields: {
            id: "{{auto}}",
            section: "{{params.section}}",
            title: "{{params.title}}",
            description: "{{params.description}}",
            sourceLink: "{{params.sourceLink}}",
            affectedDomain: "{{params.affectedDomain}}",
            status: "open",
            createdByUserId: "{{viewer.id}}",
            createdAt: "{{now}}",
          },
        },
      ],
    },
  },

  schedule_backlog_item: {
    α: "replace",
    name: "Запланировать",
    target: "BacklogItem.status",
    confirmation: "click",
    precondition: { "BacklogItem.status": ["open", "rejected"] },
    parameters: [
      {
        name: "id",
        type: "entityRef",
        entity: "BacklogItem",
        required: true,
      },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "BacklogItem.status",
          fields: { status: "scheduled" },
        },
      ],
    },
  },

  close_backlog_item: {
    α: "replace",
    name: "Закрыть",
    target: "BacklogItem.status",
    confirmation: "click",
    precondition: { "BacklogItem.status": ["open", "scheduled"] },
    parameters: [
      {
        name: "id",
        type: "entityRef",
        entity: "BacklogItem",
        required: true,
      },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "BacklogItem.status",
          fields: { status: "closed" },
        },
      ],
    },
  },

  reject_backlog_item: {
    α: "replace",
    name: "Отклонить",
    target: "BacklogItem.status",
    confirmation: "click",
    parameters: [
      {
        name: "id",
        type: "entityRef",
        entity: "BacklogItem",
        required: true,
      },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "BacklogItem.status",
          fields: { status: "rejected" },
        },
      ],
    },
  },

  // ── Pattern promotion (Level 2.1) ────────────────────────────
  // Compile target: pattern-bank/PROMOTIONS.md (новый файл) +
  // секция в backlog. Финальный SDK PR делает оператор по списку.

  request_pattern_promotion: {
    α: "create",
    name: "Запросить промоцию паттерна",
    target: "PatternPromotion",
    confirmation: "form",
    parameters: [
      {
        name: "candidateId",
        type: "entityRef",
        entity: "Pattern",
        required: true,
        label: "Candidate (status=candidate)",
      },
      {
        name: "targetArchetype",
        type: "select",
        options: ["catalog", "cross", "detail", "feed"],
        required: true,
        label: "Куда промоутить",
      },
      {
        name: "rationale",
        type: "textarea",
        required: true,
        label: "Обоснование (≥3 продукта / apply / falsification)",
      },
      {
        name: "falsificationFixtures",
        type: "textarea",
        label: "shouldMatch / shouldNotMatch",
      },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "PatternPromotion",
          fields: {
            id: "{{auto}}",
            candidateId: "{{params.candidateId}}",
            targetArchetype: "{{params.targetArchetype}}",
            rationale: "{{params.rationale}}",
            falsificationFixtures: "{{params.falsificationFixtures}}",
            status: "pending",
            requestedByUserId: "{{viewer.id}}",
            requestedAt: "{{now}}",
          },
        },
      ],
    },
  },

  approve_pattern_promotion: {
    α: "replace",
    name: "Одобрить",
    target: "PatternPromotion.status",
    confirmation: "click",
    precondition: { "PatternPromotion.status": ["pending", "rejected"] },
    parameters: [
      { name: "id", type: "entityRef", entity: "PatternPromotion", required: true },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "PatternPromotion.status",
          fields: { status: "approved" },
        },
      ],
    },
  },

  reject_pattern_promotion: {
    α: "replace",
    name: "Отклонить",
    target: "PatternPromotion.status",
    confirmation: "click",
    parameters: [
      { name: "id", type: "entityRef", entity: "PatternPromotion", required: true },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "PatternPromotion.status",
          fields: { status: "rejected" },
        },
      ],
    },
  },

  ship_pattern_promotion: {
    α: "replace",
    name: "Отгружено в SDK (с PR)",
    target: "PatternPromotion.status",
    confirmation: "form",
    precondition: { "PatternPromotion.status": ["approved"] },
    context: {
      __irr: {
        point: "high",
        reason: "После shipped паттерн считается частью SDK release; откат требует SDK-revert.",
      },
    },
    parameters: [
      { name: "id", type: "entityRef", entity: "PatternPromotion", required: true },
      { name: "sdkPrUrl", type: "url", required: true, label: "URL SDK PR'а" },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "PatternPromotion.status",
          fields: { status: "shipped" },
        },
        {
          α: "replace",
          target: "PatternPromotion.sdkPrUrl",
          fields: { sdkPrUrl: "{{params.sdkPrUrl}}" },
        },
      ],
    },
  },
};
