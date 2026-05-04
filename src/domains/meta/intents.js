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
          target: "BacklogItems",
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
      {
        // Curator-задача: когда несколько pattern'ов матчатся одного и того
        // же archetypeScope, weight определяет, кого Signal Classifier
        // выберет первым. Default 50 — neutral. Higher = stronger preference.
        name: "weight",
        type: "number",
        label: "Weight (0-100, default 50)",
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
            weight: "{{params.weight}}",
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

  // ── Self-hosting fixed-point experiment (2026-04-28) ─────────
  // Write-side intents для эксперимента, в котором LLM-агент propose'ит
  // изменения формата через те же intent'ы, что и человек. Все три
  // проходят invariants мета-домена; никакого specialized AI-pipeline.
  // См. idf-infra/docs/experiments/2026-04-28-self-hosting-fixed-point.md.

  propose_witness: {
    α: "create",
    name: "Propose witness",
    target: "Witness",
    confirmation: "form",
    parameters: [
      {
        name: "projectionId",
        type: "entityRef",
        entity: "Projection",
        required: true,
        label: "Projection",
      },
      {
        name: "slotPath",
        type: "text",
        required: true,
        label: "Слот (например, slots.body.items.title)",
      },
      {
        name: "basis",
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
        required: true,
        label: "Basis",
      },
      {
        name: "reliability",
        type: "select",
        options: ["rule-based", "heuristic", "authorial", "unknown"],
        required: true,
        label: "Reliability",
      },
      { name: "rationale", type: "textarea", label: "Rationale" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Witness",
          fields: {
            id: "{{auto}}",
            projectionId: "{{params.projectionId}}",
            slotPath: "{{params.slotPath}}",
            basis: "{{params.basis}}",
            reliability: "{{params.reliability}}",
            rationale: "{{params.rationale}}",
            origin: "authored",
          },
        },
      ],
    },
  },

  propose_intent_salience: {
    α: "replace",
    name: "Propose intent salience",
    target: "Intent.salience",
    confirmation: "form",
    parameters: [
      {
        name: "id",
        type: "entityRef",
        entity: "Intent",
        required: true,
        label: "Intent",
      },
      {
        name: "salience",
        type: "select",
        options: ["primary", "secondary", "tertiary"],
        required: true,
        label: "Salience",
      },
    ],
    particles: {
      effects: [
        {
          α: "replace",
          target: "Intent.salience",
          fields: { salience: "{{params.salience}}" },
        },
      ],
    },
  },

  // Meta-circular момент: агент создаёт новый intent внутри мета-домена.
  // После confirmed следующая итерация видит новый intent в allowed list.
  // __irr.medium — после ship'а compiler может материализовать в .js, и
  // forward-correction через α:replace всё равно разрешён.
  propose_meta_intent: {
    α: "create",
    name: "Propose meta-intent",
    target: "Intent",
    confirmation: "form",
    context: {
      __irr: {
        point: "medium",
        reason:
          "Расширение мета-домена меняет surface формата; rollback требует пересборки snapshot'а.",
      },
    },
    parameters: [
      {
        name: "intentId",
        type: "text",
        required: true,
        label: "Идентификатор (snake_case)",
      },
      {
        name: "name",
        type: "text",
        required: true,
        label: "Имя",
      },
      {
        name: "alpha",
        type: "select",
        options: ["create", "update", "replace", "remove", "add"],
        required: true,
        label: "α",
      },
      { name: "target", type: "text", required: true, label: "target" },
      {
        name: "confirmation",
        type: "select",
        options: ["form", "click", "enter", "auto", "wizard"],
        required: true,
        label: "Confirmation",
      },
      {
        name: "domainId",
        type: "entityRef",
        entity: "Domain",
        required: true,
        label: "Домен (meta для self-mod)",
      },
      { name: "rationale", type: "textarea", label: "Зачем" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Intent",
          fields: {
            id: "{{auto}}",
            intentId: "{{params.intentId}}",
            domainId: "{{params.domainId}}",
            name: "{{params.name}}",
            alpha: "{{params.alpha}}",
            target: "{{params.target}}",
            confirmation: "{{params.confirmation}}",
            category: "experiment-self-mod",
          },
        },
      ],
    },
  },

  // ── Level 2.2 changesets для idf-sdk ─────────────────────────
  // Φ-events Changeset compiler пишет в idf-sdk/.changeset/<slug>-<id>.md.
  // Замыкает release pipeline без ручного edit'а .changeset.
  request_changeset: {
    α: "create",
    name: "Запросить changeset",
    target: "Changeset",
    confirmation: "form",
    parameters: [
      {
        name: "slug",
        type: "text",
        required: true,
        label: "Slug (kebab-case, для имени файла)",
      },
      {
        name: "summary",
        type: "textarea",
        required: true,
        label: "Описание (release notes)",
      },
      {
        name: "packages",
        type: "textarea",
        required: true,
        label: 'JSON: [{"name":"@intent-driven/core","bump":"patch"}, …]',
      },
      {
        name: "relatedPromotionId",
        type: "entityRef",
        entity: "PatternPromotion",
        label: "Связанная промоция",
      },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Changeset",
          fields: {
            id: "{{auto}}",
            slug: "{{params.slug}}",
            summary: "{{params.summary}}",
            packages: "{{params.packages}}",
            relatedPromotionId: "{{params.relatedPromotionId}}",
            status: "pending",
            createdByUserId: "{{viewer.id}}",
            createdAt: "{{now}}",
          },
        },
      ],
    },
  },
};
