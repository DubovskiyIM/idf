# Gravitino UX pattern observations — running notes

**Назначение.** Накопительный файл для UI/UX паттернов, которые всплывают во время Gravitino dogfood sprint'а. После завершения каждой стадии — triage: кандидаты в pattern bank (`idf-sdk/packages/core/src/patterns/stable/`) через researcher-pipeline.

**Формат записи.**
```
### P-N: <краткое название>
**Стадия:** Stage X
**Источник:** Gravitino v2 WebUI / наш derived / авторский шаблон
**Наблюдение:** что именно делает UX (как, когда)
**Trigger:** какие signals ontology/intents делают этот паттерн уместным
**Structure:** что рендерится (primitive/slots)
**Evidence:** screenshot / docs link
**Counterexample:** где не подходит
**Related patterns:** из существующих 32 stable
```

---

## Паттерны

### P-1: Path-derived hierarchy (format-level)

**Стадия:** Stage 1 discovery / Stage 2 Task 0 (2026-04-22..23)
**Источник:** Gravitino REST API convention
**Наблюдение:** В path-based REST API (Gravitino, K8s, AWS REST, Stripe) иерархия ресурсов живёт в URL (`/metalakes/{m}/catalogs/{c}/schemas/{s}/tables/{t}`), а не в scalar FK полях сущностей. В ontology после importer-openapi@0.3.0 — catalog/schema/table **не имеют parent-ID**, pattern `hierarchy-tree-nav` не триггерится.
**Trigger:** Gravitino как raison d'être; но pattern applies ко всем path-hierarchical APIs.
**Structure:** не UI-pattern сам по себе, но **PRE-condition для hierarchy-tree-nav** — требует синтеза FK на importer уровне.
**Evidence:** Stage 2 Task 0 report (2026-04-23): `metalake_detail.slots.sidebar = []` — pattern не apply'ится на Gravitino потому что FK-chain отсутствует.
**Related patterns:** `hierarchy-tree-nav` (existing stable), R8 hub-absorption (crystallize).
**Follow-up:** SDK PR — importer-openapi@0.4.0 синтезирует path-derived FK (`Child.parentId: { kind:"foreignKey", references:"Parent" }`).

### P-2: Absolute-rooted hierarchy nav vs relative-rooted

**Стадия:** Stage 2 Task 1 (2026-04-23)
**Источник:** Gravitino v2 WebUI + Stage 2 discovery
**Наблюдение:** Классическая иерархическая навигация (Gravitino, AWS, K8s, Stripe) держит **одно и то же дерево на всех страницах** — корень всегда в глобальной root-сущности. Пользователь видит всю иерархию, знает где находится, может jump'ать. Наш текущий `hierarchy-tree-nav` pattern даёт **relative-rooted** tree — на `catalog_list` корень = Catalog, а не Metalake. Это визуально неверно для многостраничного workflow.
**Trigger:** projection с mainEntity участвующим в FK-цепочке, где есть absolute root ≥2 levels выше.
**Structure:** V2Shell-level tree state (не projection-level). Tree всегда стартует с absolute root; current projection получает highlight.
**Evidence:** Gravitino screenshots, AWS Console, K8s dashboard — single persistent tree.
**Counterexample:** Apps с flat navigation (twitter, messenger) — tree бессмысленна.
**Related patterns:** `hierarchy-tree-nav` (existing, relative-rooted) — возможно расширить флагом `rootEntity` или выделить в `absolute-hierarchy-nav` как separate pattern.
**Follow-up:** Stage 2 Task 4 (host V2Shell global tree state) или SDK extension.

### P-3: Auto-derived sections — title/entity inference

**Стадия:** Stage 2 Task 1 (2026-04-23)
**Источник:** Gravitino auto-pattern discovery
**Наблюдение:** Pattern `subcollections` auto-fire'ит на entity с back-FK и добавляет sections с `title: undefined, entity: undefined`. Правильно — title = plural-form entity-name (`Users`), entity = найденный child. Сейчас рендер покажет пустые заголовки + unknown-entity списки.
**Trigger:** detail-projection, auto-apply subcollections pattern, entity без authored subCollections hint.
**Structure:** pattern apply должен resolve'ить child-entity имя и строить title через plural-form heuristic.
**Evidence:** `arts.user_detail.slots.sections[0] = {title: undefined, entity: undefined, foreignKey: "userId"}`.
**Counterexample:** authored subCollections — пользователь задаёт title явно, нечего auto-infer.
**Related patterns:** `subcollections` в `packages/core/src/patterns/stable/detail/` — fix именно там.
**Follow-up:** SDK backlog — либо fix apply-функции, либо переместить subcollections в matching-only (без apply) и заставить авторов явно писать subCollections.

### P-?: (placeholder for next observation)

<!-- По мере работы в Stage 2-8 добавлять P-4, P-5, ... -->
