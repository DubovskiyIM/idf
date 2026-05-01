# CLAUDE.md — Intent-Driven Frontend

## Язык общения

Все ответы, комментарии, документация и коммит-сообщения — **на русском языке**.

## Git-коммиты

**Никогда не добавляй Claude (или другого бота) в соавторы коммитов.** Никаких `Co-Authored-By: Claude ...` / `🤖 Generated with ...` трейлеров. Коммиты — от имени автора, без упоминания инструмента.

## Суть проекта

**IDF — формат описания приложения (уровень OpenAPI / JSON-LD), не фреймворк.** Артефакт v2 с онтологией, намерениями, проекциями и ролями — тип данных; адаптеры и материализаторы — *читатели* формата. LLM участвует в проектировании и кристаллизации, но **не в рантайме**. **Четыре равноправные материализации**: пиксели (4 UI-адаптера), голос (`/api/voice/*`), агентский API (`/api/agent/*`), документ (`/api/document/*`).

## Навигация

- **Манифест v2** (`docs/manifesto-v2.md`) — timeless-документ о формате IDF в 8 частях. Читай перед работой над ядром формата.
- **Имплементационный статус** (`docs/implementation-status.md`) — живой документ, обновляется вместе с кодом, **часто опережает CLAUDE.md**. Здесь актуальные счётчики доменов, тестов, версий пакетов SDK, open items, sprint-changelog.
- **SDK backlog** (`docs/sdk-improvements-backlog.md`) — gap'ы из полевых тестов, классифицированы P0/P1/P2.
- **Session backlog** (`docs/backlog.md`) — cross-cutting очередь между сессиями.
- **Ontology authoring checklist** (`~/WebstormProjects/idf-sdk/docs/ontology-authoring-checklist.md`) — 12 пунктов для host-автора. **Применяй проактивно** при работе с любой ontology (см. `feedback_ontology_completeness.md`).
- **Manifesto v2.1 (in-flight)** (`~/WebstormProjects/idf-manifest-v2.1/`) — drift-protection-spec, intent-salience-spec, debugging-derived-ui-spec.
- **Спецификация формата v0.1** (`~/WebstormProjects/idf-spec/`) — JSON Schema, conformance L1–L2, cross-stack-diff harness.
- **Cross-stack реализации** (`~/WebstormProjects/idf-{go,rust,swift}/`) — три независимые реализации против `idf-spec`.
- **Полевые тесты** (`docs/field-test-*.md`) — частичное покрытие numbering'а; freelance / compliance / keycloak / argocd / notion живут только в `implementation-status.md` + `sdk-improvements-backlog.md`.

> **Перед SDK-plan'ом**: `git fetch origin main` в `~/WebstormProjects/idf-sdk/` + `npm view @intent-driven/core version` — этот документ может быть позади.

## Архитектура

### Домены

**17 доменов / ~1260 намерений** в `src/domains/{booking,planning,workflow,messenger,sales,lifequest,reflect,invest,delivery,freelance,compliance,gravitino,keycloak,argocd,automation,notion,meta}/`, переключатель в `prototype.jsx`. Один движок кристаллизации, разные наборы определений. Точное количество намерений / сущностей / особенностей — в `docs/implementation-status.md` (раздел «Домены»).

`.worktrees/petstore-demo/` — demo-домен в отдельном worktree с HTTP-proxy effect builder.

### UI-адаптеры (§17)

| Адаптер | Стиль | Базовый домен |
|---|---|---|
| Mantine | Corporate / data-dense | booking, planning, workflow, messenger, sales |
| shadcn/ui (Doodle) | Handcrafted | lifequest |
| Apple visionOS-glass | Premium / minimal | reflect |
| AntD enterprise-fintech | Dashboard / Statistic | invest, delivery, compliance, keycloak, argocd, automation, notion |

Переключение в runtime через PrefsPanel ⚙. **Capability surface** (`adapter.capabilities` + `getCapability` / `supportsVariant`) даёт graceful fallback. Token Bridge — формальный CSS-vars contract. Runtime-компоненты **не импортируют UI-kit напрямую** — только через `getAdaptedComponent(kind, type)`.

### Структура

```
# Host (минимальный после Phase 2/3 SDK-extraction)
src/domains/<domain>/      # ontology, projections, effects per domain
src/studio/                # §27 authoring environment (Graph3D + Claude proxy)
src/runtime/                # DomainRuntime, V2Shell, PatternInspector, CrystallizeInspector

server/                     # Express :3001
  validator.js              # fold + invariant dispatch + recursive batch
  ruleEngine.js             # Reactive Rules (4 v1.5 extensions)
  timeEngine.js             # TimerQueue (min-heap) + hydrateFromWorld
  schema/*.cjs              # thin re-exports из SDK core (CJS-shim)
  routes/{agent,document,voice,patterns,studio,crystallize,effects,…}.js

scripts/                    # 40+: agent-smoke (75 шагов), audit-report (7 осей), pattern-researcher,
                            # derivation-diff, salience-suggestions, conformance-runner и т.д.

invest-ml/ :3003 · invest-fuzzy/ :3004 · market-data/ :3006 · external-calendar/ :3002
courier-location-feed · geocoder · payment-gateway · notification-gateway

# SDK monorepo: ~/WebstormProjects/idf-sdk/ (pnpm workspace, ~19 пакетов)
#   core, renderer, engine, host-contracts, canvas-kit, cli
#   adapter-{mantine,shadcn,apple,antd}, adapter-antd-blockeditor-tiptap
#   create-idf-app, importer-{postgres,openapi,prisma}, enricher-claude
#   effect-runner-http, auth, server
```

### Ядро

**Φ как source of truth** — мир = `fold(Φ_confirmed)`, не хранится. Жизненный цикл: `proposed → confirmed | rejected`. Δ session-scoped, промоция при confirm.

**Кристаллизатор v2** — 7 архетипов (feed/catalog/detail/form/canvas/dashboard/wizard), 6 слотов + composer. Control-архетипы: auto, composerEntry, formModal, confirmDialog, clickForm, filePicker, inlineSearch, customCapture, bulkWizard. Чистые функции без React.

**R8 Hub-absorption** — child-каталоги с FK на entity с detail-проекцией прокидываются как `hubSections[]` на hub-detail. Threshold ≥ 2 child'а. Author-override `projection.absorbed: false`.

**Shape-layer** — `timeline` / `directory` / `default` поверх catalog/feed. Date-witness sort, contact-fields, hero-create guard. Author-override `projection.shape`.

**Онтология (§14)** — типизированные поля с read/write matrix. `entity.kind`: `internal` / `reference` / `mirror` / `assignment` / `polymorphic` (с `discriminator` + `variants[]`). `ownerField` / `entity.owners: []` для multi-owner. `inferFieldRole` → семантические роли. Canonical type-map + auto field-mapping FE↔BE.

**Глобальные инварианты (§14)** — 6 kinds: `role-capability` / `referential` / `transition` / `cardinality` / `aggregate` / `expression` (row-level predicate с `(row, world, viewer, context)`). Handlers в `@intent-driven/core/invariants/*`, server re-export через `server/schema/invariantChecker.cjs`. На violation — rollback через `cascadeReject` + SSE `effect:rejected`. `invariant.where` для row-filter.

**Базовые роли (§5)** — `role.base: "owner" | "viewer" | "agent" | "observer" | "admin"`. Открытое множество прецедентов. Helpers в `server/schema/baseRoles.cjs`.

**Агентский слой (§17)** — `/api/agent/:domain/{schema,world,exec}`, JWT + `roles.agent.canExecute` + `visibleFields`. **Preapproval guard**: `roles.agent.preapproval` с предикатами (active / notExpired / maxAmount / csvInclude / dailySum).

**Document materialization** — `/api/document/:domain/:projection?format=html|json&as=role`. Превращает catalog/feed/detail/dashboard в structured document-граф.

**Voice materialization** — `/api/voice/:domain/:projection?format=json|ssml|plain`. Превращает projection в speech-script. Brevity rules (top-3 для catalog), money-readout.

**UX Pattern Layer (§16)** — двухосевая: **архетип** (структура) × **паттерн** (поведение). Signal Classifier выводит behavioral pattern через weighted scoring. **Pattern Bank** в `idf-sdk/packages/core/src/patterns/stable/{detail,catalog,cross,feed}/` — `trigger/structure/rationale` triple + falsification fixtures + `structure.apply(slots, context)`. Author-override `projection.patterns: { enabled, disabled }`. Researcher pipeline (`scripts/pattern-researcher.mjs` + domain-batches) извлекает кандидатов из реальных продуктов.

**Co-selection** — первая категория cross-projection state-sharing. `<CoSelectionProvider>` + `useCoSelection` / `useCoSelectionEnabled`. Adapter capability `interaction.externalSelection` гейтит активацию. Применение: `bidirectional-canvas-tree-selection`.

**Derivation X-ray (§27)** — слой над Pattern Bank: что дериввировано vs какой apply выполнится. `computeSlotAttribution` (deep-diff после apply) → `PatternPreviewOverlay` mode `xray` + `CrystallizeInspector` (`Cmd+Shift+D`) + `PatternInspector` (`Cmd+Shift+P`).

**Salience ladder** — `bySalienceDesc`: `salience desc → declarationOrder asc → alphabetical`. `declarationOrder` автоматически из `Object.entries(INTENTS)`. Witness-basis `declaration-order` — authorial signal.

**Reactive Rules Engine (§22)** — event-condition-action в `ontology.rules`. Extensions: aggregation / threshold / schedule / condition. Таблица `rule_state` per `(rule, user)`.

**Темпоральный scheduler (§4)** — system intents `schedule_timer(afterMs|atISO, target, revokeOn?)` + `revoke_timer`. `server/timeEngine.js` (TimerQueue min-heap по `firesAt`, hydrate из Φ при старте). Таймеры — обычные эффекты в Φ.

**Map-primitive (§16a)** — 4 layer kinds (marker / route / polygon / heatmap), SVG-fallback в `packages/renderer/src/primitives/map.jsx`. Adapter-delegation. Semantic roles `coordinate` / `address` / `zone`.

**Irreversibility (§23)** — `effect.context.__irr = { point, at, reason }`. Integrity-rule блокирует `α:"remove"` на сущности с past confirmed effect где `point === "high"`. Forward-correction через `α:"replace"` всегда разрешён. UI: `IrreversibleBadge` + `ConfirmDialog` (`__irr` / `confirmLabel` / tone).

**Reader-equivalence (§23 axiom 5, v2.1 spec)** — четыре материализации должны отдавать изоморфный information content на одном срезе Φ. Сейчас аксиома, не runtime check (Layer 3 detector в `drift-protection-spec.md`).

**Generic Effect Handler** — fallback в `buildEffects` применяет `intent.particles.effects`. Доля автоматически-обрабатываемых интентов растёт; custom `buildCustomEffects` сохраняется в доменах со сложной логикой.

### Запуск

```bash
npm run server            # :3001 Express (validator + routes + timeEngine)
npm run dev               # :5173 Vite
npm run dev:studio        # server + vite concurrent (для Studio)
npm run calendar          # :3002 external-calendar
npm run invest-ml         # :3003 (опц.)
npm run invest-fuzzy      # :3004 (опц.)
npm run market-data       # :3006 (опц.)
npm run courier-feed | geocoder | payment-gw | notify-gw  # delivery
npm test                  # vitest (host)
npm run agent-smoke       # 75-шаговый integration smoke
npm run audit-report      # unified report по всем доменам → docs/domain-audit.{md,json}
npm run conformance       # idf-spec runner (L1+L2 fixtures)
npm run build
```

## SDK

Монорепо `~/WebstormProjects/idf-sdk/` (pnpm workspace, tsup, vitest, changesets). Версии pin'ятся в host `package.json`; источник истины — `npm view @intent-driven/<pkg> version` и `idf-sdk/packages/*/package.json`. Полная таблица назначений — `docs/implementation-status.md`. **SDK развивается быстрее host**, поэтому release pipeline — changesets-bot → «Version Packages» PR → publish при merge.

Дополнительные npm-пакеты (вне idf-sdk monorepo): `@intent-driven/effect-sink`, `@intent-driven/llm-bridge`, `@intent-driven/llm-subprocess`.

Server/schema/*.cjs — **thin re-exports** из SDK core для CJS-совместимости (не дублируют логику).

## Стиль кода

- Файлы < 300 LOC; кристаллизатор v2 — чистые функции без React.
- Тёмная тема для системных панелей, светлая/тёмная для UI.
- Инструментальный стиль — среда авторства, не потребительский продукт.

## Границы реализации

**Полный список:** Часть VII манифеста v2 + open items в `docs/implementation-status.md`. Архивный манифест v1.12 (`docs/archive/manifesto-v1.12.md`) — исторический срез. Не опирайся на «оно есть, раз написано в §N» — валидируй через implementation-status.

Sprint-changelog (что закрыто в каком sprint'е) — там же. CLAUDE.md держит только текущие архитектурные инварианты, не журнал изменений.
