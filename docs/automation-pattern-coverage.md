# Automation Pattern Coverage — research vs existing stable

**Дата:** 2026-04-26
**Источники:**
- Existing stable: `~/WebstormProjects/idf-sdk/packages/core/src/patterns/stable/` (37 patterns на 2026-04-25)
- Research output: `pattern-bank/candidate/automation-research-2026-04-26.json` (11 candidate'ов)

---

## Сопоставление research → stable

| Pattern (research) | Архетип | Existing stable? | Notes |
|---|---|---|---|
| `node-palette-categorized-drag-to-canvas` | canvas | NEW | catalog/`hero-create` похож по семантике (creator-affordance), но drag-to-canvas — другой interaction model |
| `side-attached-node-config-drawer` | canvas | NEW | detail/`footer-inline-setter` — соседний по идее (inline editing), но drawer — другая UI pattern |
| `node-pinned-sample-data-for-partial-replay` | canvas | NEW | детально — отсутствует в stable; partial-replay не покрыт никаким существующим |
| `live-execution-coloring-on-canvas` | canvas | NEW | требует SSE/streaming — не покрыто |
| `step-inspector-with-input-output-bundle-diff` | detail | partial — `subcollections` overlap | subcollections даёт child list, но input/output diff с bundle-traversal — отдельный паттерн |
| `cross-step-output-reference-mapper` | form | NEW | кросс-шаговая ссылка output → input в form — нет аналога |
| `centralized-credential-vault-with-picker` | cross | NEW | partial overlap с `m2m-attach-dialog` (picker semantics), но vault-side — отдельный |
| `run-history-grid-with-rerun-and-clear` | catalog | partial — `catalog-default-datagrid` + `bulk-action-toolbar` overlap | datagrid + bulk toolbar дают 70% паттерна; rerun-context требует execution-aware action |
| `manual-trigger-with-parameterized-input-dialog` | form | NEW | вариант hero-create + parameter form, но trigger semantic отличается |
| `error-branch-attached-to-node` | canvas | NEW | нет аналога canvas-патернов в stable вообще (cross-projection canvas pattern в bidirectional-tree-selection — другой) |
| `template-marketplace-with-fork` | catalog | partial — `catalog-default-datagrid` + `discriminator-wizard` | wizard для template-fork-в-instance — overlap, но marketplace context отдельный |

**Итоги:**
- Полностью новые candidate'ы: **7** (не аналогов в stable)
- Partial overlap: **4** (composable из существующих, но specific affordance отсутствует)

## Promotion roadmap (recommended)

После human review — promote в `idf-sdk/packages/core/src/patterns/candidate/`. Каждый отдельный sub-project (требует расширения trigger.kind taxonomy и/или новых renderer primitives).

**Высокий приоритет** (cross-domain reuse, не только automation):
1. `centralized-credential-vault-with-picker` — applicable к invest (broker credentials), keycloak (IdP secrets), argocd (cluster auth)
2. `run-history-grid-with-rerun-and-clear` — applicable к Temporal Workflows, Airflow DAGs, любой execution-tracking домен
3. `step-inspector-with-input-output-bundle-diff` — applicable к compliance audit step, workflow editor, debug viewers

**Средний приоритет** (canvas-specific, narrow scope):
4. `node-palette-categorized-drag-to-canvas` — Selfai workflow editor + future automation domains
5. `side-attached-node-config-drawer` — same scope
6. `error-branch-attached-to-node` — distinguished от generic conditional pattern
7. `live-execution-coloring-on-canvas` — требует SSE infra

**Deferred** (require infra):
8. `live-execution-coloring-on-canvas` — SSE/stream contract в core
9. `node-pinned-sample-data-for-partial-replay` — pinning state-management
10. `template-marketplace-with-fork` — marketplace UX requires backend
11. `cross-step-output-reference-mapper` — schema-aware referencing (типизированный schema chain)

## Что не нашёл research

Sub-agent осознанно не включал паттерны, которые не отличают canvas-editor от generic CRUD:
- Standard form (есть `hero-create`)
- Standard list filter (есть `faceted-filter-panel`)
- Standard CRUD destructive (есть `irreversible-confirm`)

Это правильное поведение — research отбирает **convergent evolution** в trois+ автомation-platform, не reframing existing.
