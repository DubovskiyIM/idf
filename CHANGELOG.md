# Changelog

## 2026-04-17 — v1.11 Consolidation release (manifest↔code honesty)

**Consolidation release без field test. Docs-only, нет SDK bump.**

### Added

- **§27 Authoring environment** (новая секция манифеста) — Studio v0.1 формально классифицирована как authoring tooling (не materialization). Контракт: input-side артефакта (author → source files), development-time граница, НЕ эмитит Φ effects. Параллель §19 для runtime-границы.
- **§4 string-DSL → honest border** — `evaluateScheduleV2` parser перенесён из claimed в §23 future enhancement. Object-form в `ontology.rules[].schedule` документирована как current reality.
- **§23 два новых пункта:** foldDrafts commit-vs-invariant corner case; §4 DSL deferred.
- **§26 «Что закрыто в v1.11»** + два новых insights:
  - Authoring vs materialization asymmetry (§27 first concept-разделение по направлению data flow)
  - «Subsystem as system-intents» возведено в architectural guideline (scheduler + Rules Engine + irreversibility)

### Changed

- **CLAUDE.md** — §4 описание scheduler, упоминание studio в структуре, 27 разделов.

### Honest borders (deferred)

- Rules Engine aggregation counter не-atomic при batch-effect → v1.12+
- foldDrafts commit-race test coverage + explicit semantics → v1.12+
- Studio formal write-API contract + source versioning → v1.12+

### Key insight

v1.11 — пятая consolidation-валидация подряд разного типа: v1.4-1.6 domain-driven (field tests), v1.7 infrastructure-driven (SDK + scheduler + deploy), v1.8-1.10 §15 additive-циклы, v1.11 docs-honesty (manifest ↔ code alignment). Четыре разных вида валидности, парадигма остаётся фальсифицируемой.

## 2026-04-16 — v1.9 Witness-of-proof filling (§15 zazor #2 закрыт)

**§15 zazor #2 закрыт — witness-of-proof заполняется каждым механизмом анкеринга**

### Added (SDK `@intent-driven/core@0.6.0`)

- **`reliability` taxonomy** — `"structural" | "rule-based" | "heuristic"` заполняется в findings:
  - `structural` — прямая decidable привязка (direct entity match) или exhaustive exhaustion (MISS с исчерпанными проверками)
  - `rule-based` — derivation через объявленное правило (computePlural, type-based semantic roles, ontology.invariants)
  - `heuristic` — name-convention без формального правила
- **`witness.basis`** — описание механизма вывода: `"direct entity name match"` / `"plural resolution via computePlural"` / `"name substring: 'price'"` / `"explicit ontology declaration"` / `"exhausted: direct lookup, plural rule, systemCollections — no match"`
- **`checkAnchoring`** — заполняет reliability/witness.basis для всех findings (entity / effect.target / field / witness / condition)
- **`computeAlgebraWithEvidence`** — добавлен `reliability` alias над существующим `classification` (`structural` → `structural`, `heuristic-lifecycle` → `heuristic`) + `witness.basis`
- **`inferFieldRole`** — **internal breaking**: возвращает `{role, reliability, basis}` вместо `string`. 4 consumer-site в crystallize_v2 мигрированы (assignToSlotsDetail, formGrouping, assignToSlotsCatalog × 2). External consumers: `const r = inferFieldRole(...)` → `const r = inferFieldRole(...)?.role`.

### Added (prototype runtime)

- **`effect.context.__witness` convention** — runtime «witness-of-action»: каждый derived effect декларирует свою causal basis. Первое применение:
  - **Scheduler** (`server/timeEngine.js`) — `fireDue` пишет `__witness` в fire- и revoke_timer-effects: `basis: "timer 'X' fired"`, включая `firedAt`/`guardEvaluatedTrue`/`causedByTimer`
  - **Rules Engine** (`server/ruleEngine.js`) — `buildActionEffect` принимает `ruleId` и пишет `__witness.basis: "rule 'X' fired"`, `example: "action: Y"`
  - **Invariant checker** (`server/routes/effects.js`) — `effect:rejected` SSE payload содержит `__witness.basis: "invariant kind='X' violated"`
- **`scripts/audit-anchoring.mjs`** — группировка errors по reliability: structural / rule-based / heuristic / unknown. Показывает witness.basis в выводе
- **Peer-dep bump:** `@intent-driven/core` 0.5.1 → 0.6.0

### Tests

- **+6 unit-тестов** в SDK (`@intent-driven/core`) на reliability/witness в checkAnchoring + intentAlgebra + inferFieldRole
- **+1 integration test** в `server/timeEngine.test.js` на `__witness` в fire + revoke_timer
- **+1 assertion** в `server/ruleEngine.test.js` — `__witness.basis` с ruleId
- SDK: 288 passed (+6). Прототип: 452 passed.

### Honest borders (v1.10+)

- **`witness.counterexample`** — системный counterexample-search (falsifiability) — поле зарезервировано, не заполняется
- **Linter-enforcement witness filling** — convention, не enforced. Legacy findings/producers без reliability/basis
- **Zazor #3 (heuristic-once → implication rule)** — tractable через reliability-labeling, но требует counting storage + author review UI + pattern-synthesis

### Key insight

**Reliability расширяет capability surface family** (§26 v1.6 #2). Четвёртый член: `entity.kind` / `role.scope` / `adapter.capabilities` / **`reliability`**. Эпистемическая capability, complementary к структурной. Heuristic-match перестаёт быть молчаливой адаптацией (§19) — явно маркирован.

**Zazor #2 ↔ zazor #3 bridge**: reliability-labeling делает promotion механизм tractable. `{intent, anchor, basis}` tuple с `reliability: "heuristic"` — счётчик-кандидат для promotion в ontology rules.

### Documentation

- **§15 манифеста** — новый абзац про witness-of-action convention, обновлён witness-of-proof callout (реализовано/остаётся)
- **§23** — zazor #2 отмечен закрытым
- **§26** — новая секция «Что закрыто в v1.9» + открытые задачи v1.9
- Spec: `docs/superpowers/specs/2026-04-16-witness-of-proof-design.md`
- Plan: `docs/superpowers/plans/2026-04-16-witness-of-proof.md`
- PR: `feat/witness-of-proof` (merged)

---

## 2026-04-16 — v1.8 Binary anchoring gate (§15 zazor #1 закрыт)

**§15 «Анкеринг либо успешен, либо требует вмешательства» теперь enforceable**

### Added (SDK `@intent-driven/core@0.5.1`)

- **`checkAnchoring(INTENTS, ONTOLOGY)`** — отдельная функция, извлечена из `checkIntegrity` rule #6. Возвращает `{errors, warnings, infos, passed}` с Finding-shape `{rule, level, intent, particle, message, detail, reliability?, witness?}`. Reliability/witness — зарезервированы (заполняются v1.9).
- **`AnchoringError`** — new error class с `findings` и `domainId`. Выбрасывается `crystallizeV2` в strict-режиме.
- **Классификация частиц:**
  - **Конструктивные** (`entities`, `effect.target` base, `creates`) → severity `error` → блок crystallize в strict
  - **Описательные** (`effect.target.field`, `witnesses`, `conditions`) → `warning` / `info` → не блокируют
- **Gate в `crystallizeV2`** через `opts.anchoring: "strict" | "soft"`:
  - Default — **`"soft"`** (не breaking для существующих потребителей)
  - `"strict"` — throw AnchoringError при `errors > 0`
- **`ontology.systemCollections: string[]`** — декларация коллекций без доменной сущности (`drafts`, `users`, `scheduledTimers`). Подавляет anchoring errors для этих коллекций. **НЕ** расширение `entity.kind` (системные коллекции не entities).
- **`computePlural`-зеркало** (fix 0.5.1) — plural-резолюция согласована с `buildTypeMap` в fold.js: `activities → activity` (y→ies), `addresses → address` (s→ses), `items → item`. Найдено полевым аудитом после 0.5.0.

### Added (CLI `@intent-driven/cli@1.0.2`)

- `validate.js` catch-ает `AnchoringError` отдельно, печатает findings с actionable detail в stderr

### Added (prototype)

- **`scripts/audit-anchoring.mjs`** — прогон checkAnchoring на всех 9 доменах, отчёт по группам
- **`booking.ontology.js`** — добавлен `systemCollections: ["drafts"]` (session-scoped черновики)
- **Conformance tests** `spec/conformance/level-3/anchor-*.json` — severity=error + blocking flag для anchor-001 (was warning); новый anchor-004 (два structural misses)
- **Peer-dep bump:** `@intent-driven/core` 0.4.0 → 0.5.1

### Audit results (все 9 доменов после plural-fix)

- **workflow**, **delivery** — 0 errors ✓ (strict-ready)
- **booking** 10, **planning** 2, **lifequest** 4, **reflect** 2, **invest** 5, **messenger** 31, **sales** 68
- **Итого: 122 structural misses** — real ontology gaps, где intent'ы эмитят effects на коллекции без соответствующих сущностей. Prototype держит ontology under-declared, полагаясь на Generic Effect Handler (§22 v1.4). Strict-режим это вскрыл.

### Honest borders (после v1.8)

- **Phase 3 (strict default)** — **deferred**. Требует ontology-completion sprint для 122 gap'ов. Переключение `DEFAULT_ANCHORING_MODE = "strict"` — после per-domain миграции.
- **Witness-of-proof структура (zazor #2)** — finding-shape зарезервирован (`reliability`, `witness`), заполнение — v1.9 (закрыто отдельным циклом)
- **Heuristic-once → implication rule (zazor #3)** — аспирационно, остаётся open

### Tests

- SDK: 277 passed (+10 новых для checkAnchoring + errors + gate)
- Прототип: 426 passed

### Documentation

- **§15 манифеста** — переписан: конструктивные/описательные частицы, бинарность конструктивных, мягкость описательных, §14 как runtime-арм §15 (одна модель на двух временах)
- **§23** — анкеринг gate отмечен как partially closed (witness-of-proof оставлен open)
- **§26** — секция «Что закрыто в v1.8» + ontology-completion sprint как честная граница
- Spec: `docs/superpowers/specs/2026-04-16-anchoring-binary-design.md`
- Plan: `docs/superpowers/plans/2026-04-16-anchoring-binary.md`
- PR: `feat/binary-anchoring` (merged)

---

## 2026-04-16 — Studio v0.1 (авторская среда)

- Новое: `@intent-driven/studio` — браузерная среда для авторства доменов IDF
- 3D force-граф (`react-force-graph-3d`): entities + intents + roles + projections + particle-edges, вращаемый/зумируемый
- Warnings анкеринга визуально (жёлтый halo / красное свечение), коллекция `server/studio/anchoringCheck.js` детектирует unanchored effect/witness
- Встроенный чат с Claude через subprocess `claude --print --output-format stream-json`, SSE-стрим. Префиллы из Inspector для «fix with Claude»
- «Новый домен» flow — скелет создаётся через API + опциональный prefill агента для первичной кристаллизации
- Docker: `./scripts/studio-up.sh` → http://localhost:4000/studio.html + `docker exec idf-studio bash` даёт залогиненный `claude` (через mount `~/.claude:ro`)
- Spec: `docs/superpowers/specs/2026-04-16-idf-studio-design.md`
- Plan: `docs/superpowers/plans/2026-04-16-idf-studio.md`
- Ветка: `feat/studio-v0.1`

## v1.6.2 — 2026-04-14 (post-release)

**Voice materialization prototype — §1 четыре материализации фактически реализованы**

### Added

- **`server/schema/voiceMaterializer.cjs`** — generic функция превращает любую проекцию в speech-script:
  - Структура: `{ title, meta, turns: [{role, text, items?}], footer }`
  - Роли turn'ов: `system` (контекст для LLM/intro), `assistant` (что озвучить), `prompts` (что ожидаем услышать)
  - Поддержка всех 5 архетипов: catalog (top-3 + count), feed (newest first), detail (witness facts + sub-collection note), dashboard (multi-section), wizard (current step + session note), canvas (placeholder)
- **`server/routes/voice.js`** — `GET /api/voice/:domain/:projection`:
  - Auth: JWT, viewer из токена, role через `?as=`
  - Format negotiation: `?format=json|ssml|plain` или Accept header
  - Реиспользует `filterWorldForRole` — voice viewer-scoped
- **Три output формата:**
  - **`json`** — structured turns для voice-agent (Claude Voice, OpenAI realtime)
  - **`ssml`** — XML с `<speak>`, `<prosody>`, `<break>` для TTS-движков (Amazon Polly, Google TTS, Yandex SpeechKit)
  - **`plain`** — текст с маркерами `[role]` для debug / phone-IVR baseline
- **Brevity heuristics для voice:**
  - `TOP_ITEMS = 3` для catalog/feed → "и ещё N" для остатка
  - Money читается человечески: `2_500_000` → "2.5 миллионов рублей"
  - Percentage: `27` → "27 процентов"
  - Timestamp: relative date format на русском
  - Intent prompts: top-5 из `roles[role].canExecute`
- **Russian field labels** — domain-agnostic dict (name → "название", totalValue → "стоимость", и т.д.)
- **Numerical agreement** — `speakCount` склоняет правильно ("один элемент" / "2 элемента" / "5 элементов")

### Tests

- **17 unit-тестов** в `server/schema/voiceMaterializer.test.js`:
  - catalog: count + top-3 + brevity + money speaking + empty fallback
  - detail: title + facts + sub-collection note + missing id
  - feed: count + summary first items
  - wizard: первый шаг + system hint про session
  - intent prompts: extract из ontology + brevity (max 5)
  - SSML: валидный XML + escape + locale
  - plain: маркеры ролей + prompts с дефисами
- **3 smoke-шага** (72-74) → итого **74 шага**:
  - 72: voice json + meta.materialization === "voice"
  - 73: SSML по Accept header
  - 74: plain text с маркерами

### Documentation

- **Манифест §1 / §17** — voice больше не honest border. Таблица §1: voice реализован.
- **§26** — voice убран из open items, остаётся как production-extension (integration с Claude Voice / SpeechKit, turn-by-turn sessions).
- **CHANGELOG** — v1.6.2 entry

### Metrics

- **371 unit-тестов** (было 355, +16)
- **74-шаговый agent-smoke** (было 71, +3)
- **24 test files**
- 4-я материализация §1 фактически реализована (оставалась последней open border release v1.6)

### Why now

§25 roadmap «voice prototype» был next-priority. С этим закрытием §1 «pixels · voice · agent-API · document» — все 4 материализации работают через `/api/{voice|document|agent}/*` + UI-pixels. Главный тезис парадигмы (§2: «UI — пересечение проекций и намерений; pixels/voice/agent-API/document — равноправные материализации») теперь полностью проверяем на коде.

---

## v1.6.1 — 2026-04-14 (post-release)

**Унифицированные базовые роли — §5 таксономия (owner / viewer / agent / observer)**

### Added

- **`server/schema/baseRoles.cjs`** — вокабуляр базовых ролей + helpers:
  - `BASE_ROLES` — frozen `["owner", "viewer", "agent", "observer"]`
  - `validateBase(roleDef)` — проверка корректности
  - `getRolesByBase(ontology, base)` — cross-domain поиск ролей
  - `isAgentRole` / `isObserverRole` / `isOwnerRole` — семантические helpers
  - `auditOntologyRoles(ontology)` — валидация + observer-invariant check
- **`role.base` аннотации** во всех 8 доменах:
  - booking: owner (client, specialist), agent
  - planning: agent
  - workflow: agent
  - messenger: owner (self), viewer (contact), agent
  - sales: owner (buyer, seller), agent (moderator, agent)
  - lifequest: agent
  - reflect: agent
  - invest: owner (investor, advisor), agent, observer
- **Манифест v1.6 §5** — новый раздел «Таксономия базовых ролей» с таблицей, мотивацией и snapshot'ом распределения

### Rationale

Восемь доменов прототипа — восемь разных ролевых моделей. Общий словарь нужен для:
1. Cross-domain инструментов (agent-smoke, audit, document export) — работают по классу, не имени
2. SDK defaults — domain authoring CLI знает, что owner = ownerField + CRUD, agent = canExecute + preapproval, observer = empty canExecute + full visibility
3. Узнавание паттерна автором нового домена
4. Observer-invariant enforcement через `auditOntologyRoles`

### Design

`role.base` — **метаданная**, не override. Domain сохраняет свои `canExecute` / `visibleFields` / `scope` / `preapproval`. Несовпадение — lint-warning, не runtime-ошибка. Backcompat: роли без `base` продолжают работать (игнорируются helpers).

### Tests

- **26 unit-тестов** в `server/schema/baseRoles.test.js`:
  - Валидация вокабуляра + helpers
  - Cross-domain integration: все 8 доменов имеют valid base
  - Snapshot распределения ролей per-domain
  - Observer-invariant проверка
- **355 unit-тестов** суммарно (было 329, +26)

### Documentation

- **Манифест §5** — таблица + snapshot + мотивация + реализация
- **CLAUDE.md** — секция «Базовые роли» в Ядре

---

## v1.6.0 — 2026-04-14

**10-й полевой тест: invest (fintech / personal investing) + AntD-адаптер + закрытие 6 §26 open items**

### Added — Домен invest

- **Домен `invest`** — personal investing + робо-эдвайзер:
  - 46 интентов, 20 проекций, 12 сущностей (User, Portfolio, Position, Asset, Transaction, Goal, RiskProfile, Recommendation, Alert, Watchlist, MarketSignal, Assignment, AgentPreapproval)
  - 4 роли: investor / advisor / agent / observer
  - 7 правил Rules Engine — **все 4 v1.5 extension в одном домене** (aggregation × 2, threshold × 1, schedule × 2, condition × 2)
  - 3 custom canvas: AllocationPieCanvas, MarketLineCanvas, AdvisorReviewCanvas
  - 2 wizard: risk_questionnaire (4 шага), portfolio_onboarding (3 шага)
  - Seed ~60 эффектов: 3 портфеля, 10 позиций, 14 сделок, 3 цели, 4 рекомендации, 4 alerts, 2 watchlist, 5 market signals, 3 демо-клиента

### Added — Четвёртый UI-адаптер AntD

- **AntD enterprise-fintech адаптер** — `src/runtime/renderer/adapters/antd/`:
  - parameter / button / shell / primitive (+ chart / sparkline / statistic) / icon
  - `@ant-design/plots` для chart (Line / Pie / Column / Area)
  - `@ant-design/icons` для 70+ emoji mapping
  - `Statistic` с trend-стрелкой для финансовых метрик
  - ConfigProvider + русская локаль + dark-algorithm
  - InputNumber с money/percentage форматтерами (prefix ₽, suffix %)
  - PrefsPanel получил 4-й segment
  - Дефолт для invest-домена через DOMAIN_ADAPTERS

### Added — Закрытия §26 (6 items одним циклом)

- **§26.1 Many-to-many ownership (§5, §17)** → `role.scope` в `server/schema/filterWorld.cjs`:
  ```js
  scope: { X: { via, viewerField, joinField, localField, statusAllowed? } }
  ```
  Приоритет: `role.scope > entity.kind:"reference" > entity.ownerField > none`. Backcompat 100%. 10+ unit-тестов.
- **§26.2 Preapproval guard (§17)** → `server/schema/preapprovalGuard.cjs`:
  - 5 типов предикатов: `active` / `notExpired` / `maxAmount` / `csvInclude` / `dailySum` (с фильтрацией по initiator)
  - Hook в `agent.js::exec` перед `buildEffects` → 403 `preapproval_denied` с structured details
  - 16 unit-тестов: whitelist, owner-изоляция, вчерашние / user-initiated не считаются в daily
- **§26.3 Document materialization (§1, §17)** → `server/schema/documentMaterializer.cjs` + `server/routes/document.js`:
  - Generic функция для catalog/feed/detail/dashboard → structured document-граф
  - `GET /api/document/:domain/:projection?format=html|json&as=role`
  - HTML print-ready + JSON для агентов/пайплайнов
  - Переиспользует `filterWorldForRole` — document viewer-scoped через те же role.scope/ownerField/kind
  - 15 unit-тестов: catalog с filter, detail + sub-collections, dashboard embedded, money-форматирование, HTML-escape
  - §1 расширен до 4 базовых материализаций: pixels / voice / agent-API / document
- **§26.4+26.6 Capability surface адаптера (§16a, §17)** → `adapter.capabilities`:
  - Декларативная surface: `{ kind: { type: descriptor } }`, descriptor = true/false/{chartTypes}/…
  - `getCapability(kind, type)` и `supportsVariant(kind, type, variantKey, variant)` helpers
  - null = unknown → assume supported (backcompat)
  - Chart-primitive: console.warn + SVG-fallback при mismatch
  - 7 unit-тестов
- **§26.5 Reference entities (§14)** → `entity.kind: "reference"`:
  - Справочные данные (Asset, MarketSignal) видны всем; ownership не применяется
  - Visibility через `role.visibleFields` остаётся
  - 2 unit-теста

### Added — Chart-primitive как новая категория (§16a)

- `src/runtime/renderer/primitives/chart.jsx` — первый primitive вне text/image/container:
  - Декларативный spec `{ type: "chart", chartType, data, xField, yField, seriesField, height }`
  - SVG-fallback (Line + Pie) для адаптеров без chart-реализации
  - Adapter-delegation через `getAdaptedComponent("primitive", "chart")` + capability check
  - `Sparkline` для mini-графиков в cardSpec

### Added — ArchetypeWizard source.inline

- `source.inline: [...]` — статические опции без сидинга в Φ (приоритет над `source.collection`)
- Используется в risk_questionnaire, portfolio_onboarding
- Общее улучшение для всех доменов

### Added — Внешние ML-сервисы

- `invest-ml/` :3003 — мок market signals (price/volume/sentiment), push каждые 30с
- `invest-fuzzy/` :3004 — fuzzy risk scoring для экзотических активов, push каждые 60с
- `market-data/` :3006 — price tick feed, обновления каждые 15с
- Все пушат foreign-эффекты через `POST /api/effects/seed`

### Added — Agent smoke тест (71 шаг)

- +7 invest шагов (59-65): schema / world / propose_rebalance / flag_anomaly / fetch_signal / buy_asset-403
- +3 preapproval шага (66-68): success / maxAmount reject / csvInclude reject
- +3 document шага (69-71): JSON, HTML, 404 на unknown projection

### Added — Новые поля-роли (§14)

- `money` — с currency-форматом
- `percentage` — 0–100 с суффиксом %
- `trend` — up/down/flat (Statistic в AntD)
- `ticker` — моноширинный (финансовые тикеры)

### Added — Advisor UI + Regulator report

- `AdvisorReviewCanvas` — many-to-many dashboard клиентов: selector, P&L (Statistic), allocation (Pie), risk profile, рекомендации
- 6 advisor intents: assign_client / unassign / pause / resume / create_recommendation_for_client / send_client_message
- `RegulatorReportCanvas` — print-ready HTML с аудит-трейлом (causal chain, initiator colors)
- Кнопка «📄 Server-side document» → открывает `/api/document/invest/transactions_history?as=observer`

### Changed

- **CLAUDE.md** — манифест v1.6 reference, 8 доменов в таблице, 4 адаптера с capability
- **README.md** — 8 доменов, 527 интентов
- **Манифест** → `docs/manifesto-v1.6.md` (1141 → ~1280 строк)
- **`server/schema/filterWorld.cjs`** — приоритет row-filter: `role.scope > entity.kind > ownerField`
- **`server/routes/agent.js`** — preapproval hook
- **`server/index.js`** — смонтирован document-router
- **`src/standalone.jsx`** — POST typemap включает projections, 4-й адаптер в UI_KITS
- **`src/runtime/renderer/adapters/registry.js`** — `getCapability`/`supportsVariant`
- **`src/runtime/renderer/primitives/index.js`** — chart + sparkline в реестре

### Fixed

- **nav-граф ambiguity**: catalog клик по Transaction уводил в Portfolio (entities overlap). Добавлены detail-проекции для всех mainEntity + сужены entities.
- **feed requires composer**: transactions/recommendations/alerts заменены на catalog (нет creator-intent'ов для composer).
- **pre-existing test**: `server/schema/userRegisterEffect.test.js` → `@intent-driven/core` импорт

### Metrics

- **329 unit-тестов ядра** (было 279 в начале field-test 10, +50 закрытий)
- **71-шаговый agent-smoke** (было 58, +13)
- **527 интентов** в 8 доменах (было 481 в 7)
- **4 UI-адаптера** (было 3)
- **20 проекций** в invest + 2 wizard
- Build ок

### Honest Border (v1.6 new)

- **§1 Voice** — контракт есть, реализации нет (v1.7+)
- **§4 Темпоральный scheduler** — polling вместо dedicated timer
- **Composite entities** — union-типы не формализованы в `entity.kind`
- **Server-rendered PDF** — documentMaterializer отдаёт HTML, PDF через puppeteer — extension
- **Adapter capability mismatch** — новый primitive kind (chart в v1.6) не нотифицирует существующие адаптеры

### Documentation

- `docs/manifesto-v1.6.md` — обновлённый манифест с новыми разделами §5 m2m, §14 entity.kind, §17 preapproval + document, §22 v1.5 extensions, §26 revision
- `docs/field-test-10.md` — полевой тест invest с полной постмортем
- `docs/superpowers/plans/2026-04-14-field-test-10-fintech.md` — план реализации

---

## v1.5.0 — 2026-04-14

**9-й полевой тест: reflect (дневник эмоций по Yale RULER)**

### Added

- **Домен `reflect`** — дневник эмоций с Mood Meter (Marc Brackett, Yale RULER):
  - 47 интентов, 13 проекций, 10 сущностей
  - 6 custom canvas (~1300 LOC): MoodMeterCanvas (2D-input), TimelineCanvas, CalendarHeatmapCanvas, MoodTrendsCanvas, ActivityCorrelationCanvas, MoodMeterClusterCanvas
  - 25 эмоций по 4 квадрантам Mood Meter (Energy × Pleasantness)
  - 12 seed-активностей, гипотезы, инсайты, теги
- **Apple visionOS-glass адаптер** — третий UI-kit (после Mantine + shadcn-doodle):
  - Frosted glass карточки, SF Pro Display / Inter, iOS blue accent
  - Окончательная валидация §17 «адаптивного слоя»
- **Reactive Rules Engine extensions** (§22):
  - `aggregation: { everyN }` — counter-based firing per-user
  - `threshold: { lookback, field, condition }` — predicate over last N entries (DSL: all_equal/equals/gt/lt)
  - `schedule: "weekly:sun:HH:MM" | "daily:HH:MM"` — cron-like server timer
  - `condition: "<expr>"` — JS expression evaluator (whitelisted Math)
  - Новая таблица `rule_state` (counter, last_fired_at) per (rule, user)
- **Token Bridge contract** (§17) — формальный CSS-vars между адаптером и domain code
- **Custom Canvas registry** (§16a) — formalized: `registerCanvas(projectionId, Component)`
- **Server-side aggregation** как третий тип intent — intent читает world и эмитит meta-effect
- **`/reflect`** route, добавлен в standalone и prototype

### Changed

- **README.md, CLAUDE.md** — обновлены метрики и описание
- **541 unit-тест** (было 500, +41 новых)
- **38 файлов тестов** (было 36)
- **58-шаговый agent-smoke** (было 50, +8 reflect)
- **481 интент** в 7 доменах (было 434 в 6)
- **3 UI-адаптера** (было 2)

### Honest Border

- §21 — analytical UI (charts/heatmaps/2D inputs) **inherent требуют** custom canvas (~1300 LOC в reflect, ~1500 LOC в lifequest). Это не недостаток, а формализованная граница.

### Documentation

- `docs/manifesto-v1.5.md` — обновлённый манифест
- `docs/superpowers/specs/2026-04-14-reflect-domain-design.md` — спек reflect
- `docs/superpowers/plans/2026-04-14-reflect-implementation.md` — план реализации (27 задач, 6 фаз)
- `docs/superpowers/specs/2026-04-14-reflect-postmortem.md` — анализ паттернов и инсайтов

---

## v1.4 — 2026-04-14

**Ревизия манифест↔код v1.3 + 8-й полевой тест: lifequest (цели + привычки)**

### Added

- **Домен `lifequest`** — боевой домен (цели + привычки + геймификация):
  - 56 интентов, 11 проекций, 10 сущностей
  - 6 custom canvas (~1500 LOC): TodayCanvas, WeekProgressCanvas, CalendarCanvas, RadarChart (point_a), VisionBoardCanvas, дашборды
  - shadcn/ui (Doodle) адаптер — второй UI-kit
  - Mobile-first: BottomTabs для < 768px
- **Wizard — 7-й архетип** (§16a) — многошаговый guided flow (booking_wizard)
- **Reactive Rules Engine** документирован (§22) — event-condition-action основа
- **Секционированная навигация** (§16a) — `ROOT_PROJECTIONS` с секциями
- **Personal layer §17** — usePersonalPrefs + PrefsPanel (density/fontSize/iconMode/uiKit)
- **475 unit-тестов** (было 372)

### Changed

- **Манифест v1.4** — аспирационная категория §26 впервые пуста
- 7 архетипов вместо 6

---

## v1.3 — 2026-04-13

**Agent layer для всех 5 доменов + LLM enrichment + Personal layer**

### Added

- Agent layer для всех 5 доменов (workflow + messenger добавлены к booking/planning/sales)
- Декларативные политики кворума (`closeWhen` / `absentVote`)
- LLM enrichment pass (Claude API)
- TypeScript типы ядра (`src/types/idf.d.ts`)
- ErrorBoundary для graceful degradation
- CI через GitHub Actions
- Composer reply mode + SubCollection inline-edit
- Agent-smoke 42 шага
- Deploy config (Dockerfile + fly.toml)

---

## v1.2 — 2026-04-13

**8-й полевой тест: sales (аукцион)**

### Added

- Домен `sales` — 226 намерений, 10 сущностей, 4 роли (buyer/seller/moderator/agent)
- Auto-close по кворуму (`checkQuorum`)
- Agent layer для sales
- Canvas + Dashboard архетипы (5-й и 6-й)
- M5: удаление legacy v1 (-2111 LOC)
- auth_users → Φ через `_user_register` dual-write
- Семантические роли полей → выводимая карточка (cardSpec) + секционированная форма

---

## v1.1 — 2026-04-11

**7-й полевой тест: messenger + M1/M2 (архетипы и слоты)**

### Added

- Домен `messenger` — 100 намерений в 7 категориях
- Формальная схема артефакта v2 с архетипами/слотами
- M1: Feed архетип
- M2: Catalog + Detail + навигационный граф
- Универсальная серверная валидация
- Единый пайплайн приёма эффектов

---

## v1.0 — 2026-04-XX

**Базовая парадигма: 3 домена + 23 раздела манифеста**

### Initial

- Домены: booking (20), planning (17), workflow (15) = 52 намерения
- Φ как source of truth, fold(Φ_confirmed) = world
- Жизненный цикл proposed → confirmed | rejected
- Черновики Δ, TTL-эффекты
- Граница с зеркальными сущностями (booking ↔ external calendar)
- Кристаллизация v1 (LLM-driven)
- Визуальный язык (2 темы × 3 варианта)
- Овеrlay(I) для многофазных намерений
