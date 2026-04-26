# Session Backlog — Deferred Items, Insights, Observations

**Назначение.** Отдельная очередь задач, инсайтов и находок, отложенных между сессиями. В отличие от `sdk-improvements-backlog.md` (специфичен для SDK и дискавери freelance'а), этот файл — cross-cutting: всё, что всплыло при работе, но не попало в текущий PR.

**Структура.**

- **§0 SaaS packaging (M1.2→M1.6)** — shippable path к первому paying PM. **Критический путь.** Всё, что блокирует упаковку для первых клиентов.
- **§1 Format / SDK deferred implementation** — format maturity, идёт параллельно, не блокирует первых клиентов.
- **§2 Architectural research / insights** — design-research для v2.1 манифеста.
- **§3 Cross-cutting observations** — наблюдения, не привязанные к workstream.

**Критерий разделения.** Если item блокирует деплой первого PM — §0. Если item улучшает format expressiveness без impact на PM end-user — §1-2.

**Контракт.**

- При завершении сессии — пройтись по «что хотел сделать но отложил» и записать сюда.
- При старте новой сессии — проверить backlog перед planning'ом.
- Пункты с датой находки, коротким контекстом, предлагаемым action'ом.
- Когда пункт взят в работу — удалить из backlog'а и перевести в плановый workstream.
- Если пункт устарел (решён параллельно, отменён решением) — удалить, не оставлять как «исторический».

---

## 0. SaaS packaging — путь к первому paying PM

**Источник истины:** `docs/superpowers/specs/2026-04-21-pm-autonomy-roadmap-design.md` (Variant D, 6 мес план).
**Текущая фаза:** M1.1 закрыт (2026-04-21), M1.2 начинается. План на месяц — `~/.claude/plans/deep-humming-nova.md`.

### 0.1 M1.1 tail (закрыть в первые 1-2 дня)

**A1. Resend wire-up в production (`idf-auth`).**
**Контекст:** Сейчас `EMAIL_DEV_MODE=true` на VPS — magic-link уходит в `docker compose logs`. Для реальных PM нужен Resend с DNS verification для `intent-design.tech`.
**Action:** User создаёт Resend account + DNS-records; я ставлю `RESEND_API_KEY` + `EMAIL_DEV_MODE=false` в `/opt/idf-auth/.env`, redeploy.
**Blocker:** user (API key).

**A2. Re-deploy runtime с full V2Shell bundle.**
**Контекст:** commit `72703b2` в idf-runtime содержит собранный V2Shell (6.3 MB) в `static/`, но prod пока отдаёт placeholder index.html (`94a89cf`).
**Action:** `docker buildx build --platform linux/amd64` → scp на VPS → docker load + tag → docker compose up -d в `/opt/idf-runtime/demo/`.

**A3. ANTHROPIC_API_KEY в control plane.**
**Контекст:** Без ключа SSE authoring session падает на `createClaude` init.
**Action:** user → `ANTHROPIC_API_KEY=sk-ant-...` → `/opt/idf-studio/.env` + restart.
**Blocker:** user (API key).

**A4. Cross-plane E2E smoke.**
**Action:** signup incognito → login → create project → deploy demo tenant → открыть iframe, убедиться что V2Shell отдаёт 4-channel UI.
**Dep:** A1-A3.

**A5. Verify daily backup cron.**
**Контекст:** `/etc/cron.daily/idf-backup` создан 2026-04-21, rotation 14 дней. Надо убедиться что `/var/backups/idf/` реально наполняется.
**Action:** ssh → `bash /etc/cron.daily/idf-backup` → `ls -la /var/backups/idf/` → assert ≥3 файла (auth / studio / runtime-demo).

**A6. Auto-nginx/certbot helper в orchestrator.**
**Контекст:** `/opt/idf-runtime/register-tenant.sh` на VPS работает полу-автоматически. Сейчас deploy flow оставляет nginx/certbot на user'е.
**Action:** `idf-studio/server/src/vps/vps-client.ts::createTenant` вызывает `register-tenant.sh <slug> <port>` через docker-exec или ssh. Первая итерация: keep manual fallback для первых 3-5 tenant'ов.

### 0.2 M1.2 (месяц 1, следующий спринт): Studio as control plane

**B1. Port 7-state authoring machine из `.worktrees/pm-demo/` в multi-tenant studio.**
Состояния: `landing → describe → entities → intents → roles → projections → rules → preview → commit`.
Место: `idf-studio/server/src/sessions/*` + `idf-studio/web/src/pages/project-detail.tsx`.

**B2. System prompts из pm-demo в `idf-studio/server/src/sessions/prompts.ts`** (cache-friendly, skeleton уже есть).

**B3. Turn-log first-class:** append-only `sessions.turns[]` persist в Postgres, resume через GET `/api/sessions/:id`.

**B4. Rollback to turn N UI.**

**B5. Live 4-channel preview panel:** pixels (iframe) / voice (audio `?format=audio`) / document (HTML) / agent (JSON). Debounce 300ms.

**C1. Dry-run validator:** `foldWorld` на sample fixtures до push'а в data plane. Блокирует deploy при ошибке.

**C2. Integrity check ↔ studio UI diff:** если `/admin/reload` вернул rejected effects — показать diff в Studio, не просто 500.

**C3. Deploy history tab** — читает `deploys` table.

**C4. Snapshot Φ кнопка в studio UI** (использует `/admin/snapshot` skeleton из runtime commit `482e8bb`).

### 0.3 M1.3 (месяц 2): Data safety

- Change classifier safe/caution/breaking в deploy preview UI.
- Rename как first-class op (`domain.json.renames: [{entity, from, to}]`, idempotent JSONB update).
- Φ snapshot / restore UI.
- Audit log viewer с фильтрами (actor/entity/time-range/intent).
- Per-field diff между deploy'ами.

### 0.4 M1.4 (месяц 3): Governance & team

- Team tab: invite UI, role assignment, revocation, agent tokens (long-lived JWT с preapproval limits, copy-once UX).
- Rejected effects monitor.
- «Explain why» rejection modal с suggested actions.
- Export audit package (ZIP: domain.json + snapshots + rejected + members + optional Φ JSONL).

### 0.5 M1.5 (месяц 4, RISKY — 60% frontend effort): Direct-manipulation editors

- Role matrix editor (entities × roles, checkbox read/write/canExecute).
- Projection palette (Pattern Bank user-facing, toggle enabled/disabled с live preview).
- Rules builder no-code (drag-drop предикаты, schedule/threshold/aggregation).
- Polish Graph3D editing mode (уже есть в Studio §27, нужен user-facing wrapper).

**Degradable:** если timeline жмёт — сдвигать в M1.7, оставить LLM-only authoring в M1.

### 0.6 M1.6 (месяц 5-6): Handoff + beta launch

- Export tarball builder: `my-domain.tar.gz` с README / package.json / domain.json / extensions.ts-stub / Dockerfile / docker-compose.yml / Φ snapshot.
- CLI dev-mode (`idf dev`, `idf test`, `idf publish` deferred в M2).
- `domain.extensions.ts` typed interface (`DomainExtensions<T>` генерит TS-типы из domain.json).
- Landing + pricing page + minimal Stripe (14-day trial, paid-only).
- Beta cohort 3-5 PM → первый paying customer.

### 0.7 Operational (continuous)

- **Sentry** free tier на auth/runtime/studio (3 environments). Email alert на unhandled rejection.
- **S3 off-site backup** (сейчас только local `/var/backups/idf/` на VPS — single point of failure).
- **Security audit:** CSRF, cookie flags (Secure/HttpOnly/SameSite), rate-limit tuning, CORS policies.
- **PG migrate runner → drizzle migrator** (все 3 плана имеют не-идемпотентный runner; второй прогон упадёт).
- **Resend deliverability metrics** после wire-up (bounce rate, DMARC alignment).
- **Port allocation race** в studio orchestrator (`allocatePort` без mutex, два параллельных deploy'я → collision).
- **Persistent `hostPort` column в `tenants`** (сейчас port reuse из deploys history — хрупко).
- **`docs/legal/dpa-template.pdf`** — минимальный processor-controller DPA для beta PM.
- **`docs/ops/backup-recovery.md`** — runbook восстановления tenant из backup.
- **Daily cron `/etc/cron.daily/idf-backup`** — healthcheck alert если за 24h не было нового файла.

### 0.8 Open decisions (до beta)

- **Product name.** «IDF» не маркетится. Варианты из roadmap: Folio / Crystallizer / Phi / Fold / Tacit.
- **Licensing.** Studio/control plane — BSL или closed-source? Рекомендация roadmap: commercial SaaS поверх BSL SDK (Sentry/GitLab модель).
- **LLM cost absorption.** M1 — в SaaS price; M2 — transactional billing.
- **Freemium vs paid-only.** Roadmap рекомендует paid-only с 14-day trial.
- **Ownership transfer в M1.** Manual через support email; automated в M2.
- **Product demos.** M1: golden domain (Client Onboarding Tracker) + 2 templates (retro, project tasks). Vertical library — M2.

---

## 1. Deferred implementation

Задачи, где scope / timing вытеснил их из текущего PR.

### 1.2 Composite `groupBy` в `cardinality`

**Дата:** 2026-04-20
**Контекст:** «Один активный Response на пару (executorId, taskId)» — сейчас enforce'ится в host `buildCustomEffects`.
**Action:** `groupBy: ["executorId", "taskId"]` — массив, handler конкатенирует в ключ группы.
**Owner:** `@intent-driven/core/invariants/cardinality.js`
**Связано:** `docs/sdk-improvements-backlog.md` §1.3

### 1.3 `__domain` провенанс в Φ (auto-discriminator)

**Дата:** 2026-04-20
**Контекст:** `lifequest.tasks` и `freelance.tasks` делят SQL table. SDK invariant'ы без discriminator пересекаются. В Cluster A — решаем через `invariant.where` (author responsibility). Long-term нужен автоматический `__domain` provenance.
**Action:** Host server пишет `effect.context.__domain` в Φ при confirm. SDK fold подхватывает как row field. Invariants used as `where: "__domain === 'freelance'"`.
**Owner:** Host `server/routes/effects.js` + SDK `fold.js`
**Связано:** `docs/sdk-improvements-backlog.md` §1.4 (partial fix in Cluster A PR)

### ✅ 1.4 Antd adapter patches — Cluster B (четыре P0 бага)

**Дата:** 2026-04-20. **Закрытие:** 2026-04-20 в adapter-antd@1.2.0 (2.1 label/children, 2.2 DateTime withTime, 2.3 fieldRole price, 2.4 maxLength/pattern). Host workarounds удалены.
**Связано:** `docs/sdk-improvements-backlog.md` §2.1-2.4 (all ✅)

### ✅ 1.5 `PrimaryCTAList` для multi-param phase-transitions

**Дата:** 2026-04-20. **Закрытие:** idf-sdk PR #50 — `wrapByConfirmation` → overlay-form для phase-transitions с параметрами. Host `irreversibility:"high"` workaround снят.
**Связано:** `docs/sdk-improvements-backlog.md` §3.1 (✅)

### 1.6 `IrreversibleBadge` auto-placement

**Дата:** 2026-04-20
**Контекст:** Primitive создан в SDK renderer, но не инжектится автоматически. Домены с `__irr:{high}` (invest/delivery/freelance) не показывают badge.
**Action:**
- `buildDetailBody` добавляет `irreversibleBadge` node в header-row для mainEntity с `__irr`
- `ConfirmDialog` рендерит badge + причину из `__irr.reason` если `spec.irreversibility === "high"`
- ConfirmDialog `confirmLabel` configurable (вместо фиксированного «Удалить»)
**Owner:** `@intent-driven/core` + `@intent-driven/renderer`
**Связано:** `docs/sdk-improvements-backlog.md` §3.3

### 1.7 Pattern Bank: hero-create.apply — blocked

**Дата:** 2026-04-20
**Контекст:** При попытке добавить apply к hero-create выяснилось: логика hero slot assignment уже в `assignToSlotsCatalog.js` как crystallize-rule. Pattern-bank apply был бы duplicate.
**Insight:** Правильное решение — **migrate** hero слот из crystallize-pipeline в pattern-bank. Это refactor, не additive feature. Отделяет origin-rules (R1–R8) от behavioral patterns.
**Action:** Brainstorm полноценного migration workstream:
- Какие R-правила в `assignToSlots*.js` концептуально являются patterns?
- Как преподнести refactor без breaking существующих доменов?
- Cost vs benefit (сейчас hero работает — refactor ради чистоты архитектуры)
**Owner:** `@intent-driven/core/crystallize_v2/` + `@intent-driven/core/patterns/`
**Связано:** Open items v1.12 — «Pattern Bank: structure.apply для оставшихся 17 stable паттернов»

### ~~1.8~~ Remaining matching-only patterns — structure.apply

**Дата:** 2026-04-20. **Почти закрыт 2026-04-22:** из 17 matching-only осталось **2** (`global-command-palette`, `keyboard-property-popover`). Batch'и применены через idf-sdk PR #154 (`optimistic-replace-with-undo.apply`) + #177 (`catalog-action-cta` и др.). Из 17 stable → 32 stable → 30 apply.
**Остающиеся 2:** оба — cross-cutting UI-affordance (shortcut-handling), apply не semantic-driven. By design matching-only (witness-of-crystallization).
**Owner:** `@intent-driven/core/patterns/stable/` (closed для этого трека)

### 1.9 Domain audit findings — baseline 2026-04-20 (187 findings)

**Дата:** 2026-04-20
**Контекст:** `node scripts/audit-report.mjs` сгенерировал baseline (`docs/domain-audit.md` + `.json`). 0 error, 103 warning, 84 info. Ключевые clusters:
**Actions (по убыванию импакта):**
- **Salience coverage ≈0%** во всех 10 доменах (55 idiom findings). Intent-salience v2.1 ratify (backlog §2.3 manifest) остаётся — но также нужна **massовая аннотация в доменах**. Sales (225 intents, 1%), messenger (100, 0%), invest (61, 0%), lifequest (56, 2%). Можно начать с primary actions в sales/messenger.
- **Override-coefficient 1.0** во всех 10 доменах (derivation findings). `deriveProjections` не вызывается в crystallize pipeline → R1–R8 witnesses не добавляются. Blocker от `debugging-derived-ui-spec.md` baseline 2026-04-20 остаётся — решение через `ontology.features.autoDerive` opt-in.
- **Test coverage gap** — 8 из 10 доменов не имеют domain-local `.test.js`. Freelance лидирует (6 files), остальные 0-1. Priority: добавить интеграционные тесты для invest (61 intent, самый сложный), sales (225), lifequest (56).
- **Cross-domain collisions** — 42 shared entity-names. Legit (User везде) + некоторые warning ("Task" — lifequest + freelance; "Category" — sales + freelance). Нужен namespacing либо явное declarative allowlist.
- **Format findings (45)** — legacy fields string-array в некоторых доменах (`entity.fields: ["a", "b"]` vs object-shape), FK-поля не типизированные как entityRef.
**Owner:** Per-domain стабилизация (следующие сессии), не single-PR scope.
**Regen:** `npm run audit-report` (idempotent, commits report в docs/).

### 1.11 Invest Phase 3 — custom-id feeds → composeProjections rename

**Дата:** 2026-04-20
**Контекст:** После PR #83 invest authored-проекций: 23 → 17. Оставшиеся 17 включают 10 custom-id feed'ов (`portfolios_root`, `goals_root`, `watchlists_root`, `recommendations_inbox`, `alerts_feed`, `transactions_history`, `advisor_clients`, `assets_catalog`, `rules_list`, `market_trends`), на которые ссылается `ROOT_PROJECTIONS` как навигация.

Derivation даёт им канонические имена (`portfolio_list`, `goal_list` и т.д.), но UI нужны осмысленные ids для URL-маршрутов и табов. Прямой removal = breaking UI.

**Action:** Workstream после V2Shell smart-merge:
1. SDK добавляет `composeProjections(derived, authored, { renames: { portfolio_list: "portfolios_root" } })` — rename semantic без изменения derived metadata.
2. `src/domains/invest/projections.js` использует `OVERRIDES` + `RENAMES` + `EXTRA` паттерн вместо плоского `PROJECTIONS`.
3. `ROOT_PROJECTIONS` остаётся стабильным.
4. Derivation-coefficient invest: 0.44 → 0.05-0.10 (остаются только dashboards/wizards/canvas, которые реально custom).

**Blocker:** V2Shell.jsx сейчас принимает `domain.PROJECTIONS` как flat dict. Refactor требует либо (a) domain экспортирует function `getProjections(derived)` и V2Shell вызывает после derive, либо (b) SDK экспортирует `composeProjections` с renames и V2Shell использует явно.

**Owner:** host V2Shell + `@intent-driven/core/crystallize_v2/composeProjections.js` + `src/domains/invest/projections.js`
**Связано:** PR #83 (6 invest detail derived), этот PR (smart-merge сохраняет `derivedBy`), backlog §2.3 (deriveProjections в production)

### 1.10 Studio integration: audit report viewer

**Дата:** 2026-04-20
**Контекст:** `docs/domain-audit.json` имеет structured schema (axes + perDomain + summary). Текущий consumer — human через markdown.
**Action:** Studio tab «Audit» — UI над JSON-report'ом. Severity badges per domain, per-axis filter, drill-down per finding. Либо fixture-driven (consume committed JSON), либо live через server endpoint `/api/studio/audit`.
**Owner:** host + SDK renderer
**Depends on:** stable schema `domain-audit.json` (этот PR даёт baseline)

### 1.12 enricher-claude — structured_output wire-format регрессия

**Дата:** 2026-04-22 (Gravitino dogfood Stage 1 Task 3).
**Контекст:** `enricher-claude@0.2.0` вызывает `claude -p --output-format json` и читает `wrapper.result ?? wrapper.content ?? stdout` (`~/WebstormProjects/idf-sdk/packages/enricher-claude/src/subprocess.js:51`). Claude CLI 2.1.117 изменил wire-format: структурированный JSON теперь в `wrapper.structured_output`, а `wrapper.result` — пустая строка. Enricher падает с `Structured response не JSON: ` (пустой stdin в extractJson).

**Action:** Добавить fallback в `subprocess.js`:
```js
if (wrapper.structured_output && typeof wrapper.structured_output === "object") {
  return wrapper.structured_output;
}
```
Bump `@intent-driven/enricher-claude` → `0.2.1`. После release — переиграть enrich на Gravitino imported.js идемпотентно (pre-enrich snapshot уже зафиксирован в `.fixtures/imported.pre-enrich.js`).

**Owner:** `~/WebstormProjects/idf-sdk/packages/enricher-claude/`
**Блокирует:** enrichment layer scaffold-пути (Этап 2). Importer работает без него, но ontology остаётся literal (~200 DTO envelope'ов не коллапсируются, роли/valueLabels/labels не добавляются).
**Severity:** P1 — scaffold-путь в v0.2 формально closed (4 releases), но для real-world OpenAPI (Gravitino) критичен для UX.
**Workaround на Stage 1:** продолжаем на pre-enrich ontology (120 intents / 218 entities достаточно для baseline render). Дополнительные enricher-gap'ы см. session-observation ниже.

**Memory sync:** запись `feedback_claude_subprocess_over_sdk` (встроенные Claude-агенты = subprocess к локальному `claude` CLI) остаётся корректной по подходу; регрессия — на wire-format уровне, не архитектурном. Запись `project_m1_2_authoring_port_progress` (Blocker smoke: Anthropic $0 credit) — **неверная гипотеза**: credit тут ни при чём, OAuth keychain subprocess работает без billing; реальный root cause — wire-format.

### 1.13 Gravitino dogfood-спринт — tracker

**Дата начала:** 2026-04-22. **Source:** локальный spec `docs/superpowers/specs/2026-04-22-gravitino-dogfood-design.md` (8 стадий, horizontal-slice).

**Цель:** довести SDK + AntD-адаптер до уровня, на котором derived UI Apache Gravitino metadata-catalog (12 модулей) рендерится как «золотое» demo. Horizontal slice по capability (не per-модуль Gravitino). Каждая стадия — draft PR, не мёрджим до финального approve в конце спринта.

**Контуры dogfood:** (a) scaffold-путь Этап 1-3 на реальном enterprise OpenAPI, (b) SDK/adapter polish для enterprise-UX.

**Stages.**

| Stage | Capability | PR | Статус |
|-------|-----------|----|----|
| 1 | Bootstrap + baseline render + gap-каталог | [idf#105](https://github.com/DubovskiyIM/idf/pull/105) | draft, 14+ commits |
| 2 | Deep tree nav + breadcrumbs | [idf#105](https://github.com/DubovskiyIM/idf/pull/105) + seed demo | done ✓ (SDK #190/#192/#193 merged + V2Shell entity-aware labels + demo seed) |
| 3 | Composite / nested types | [idf#105](https://github.com/DubovskiyIM/idf/pull/105) + SDK #196 + #198 | done ✓ (SchemaEditor primitive + field.primitive hint merged + host annotation Table.columns) |
| 4 | Advanced data-grid | SDK #200 | done SDK ✓ (DataGrid primitive merged/renderer@0.31.0); host-integration для catalog-projections отложен |
| 5 | Permission matrix | SDK #202 | done ✓ (merged renderer@0.32.0 + host annotation Role.securableObjects active) |
| 6 | Wizard dynamics + test-connection | SDK #204 | in-progress (Wizard primitive open PR) |
| 7 | Property popover + associations | SDK #206 | in-progress (PropertyPopover + ChipList open PR; host annotations ready) |
| 8 | Polish + demo | — | pending |

**SDK PRs от Gravitino dogfood:**

| PR | Контент | Статус |
|----|---------|--------|
| [idf-sdk#186](https://github.com/DubovskiyIM/idf-sdk/pull/186) | enricher-claude@0.2.1: structured_output wire-format | merged ✓ |
| [idf-sdk#188](https://github.com/DubovskiyIM/idf-sdk/pull/188) | importer-openapi@0.5.0: path-derived FK synthesis | merged ✓ |
| [idf-sdk#190](https://github.com/DubovskiyIM/idf-sdk/pull/190) | renderer@0.29.0: Breadcrumbs primitive | merged ✓ |
| [idf-sdk#192](https://github.com/DubovskiyIM/idf-sdk/pull/192) | core@0.52.1: subcollections.apply render-ready shape (G14) | merged ✓ |
| [idf-sdk#193](https://github.com/DubovskiyIM/idf-sdk/pull/193) | adapter-antd@1.5.0: Breadcrumb capability | merged ✓ |
| [idf-sdk#196](https://github.com/DubovskiyIM/idf-sdk/pull/196) | renderer@0.30.0: SchemaEditor primitive (Stage 3) | merged ✓ |
| [idf-sdk#198](https://github.com/DubovskiyIM/idf-sdk/pull/198) | core@0.53.0: field.primitive declarative hint | merged ✓ |
| [idf-sdk#200](https://github.com/DubovskiyIM/idf-sdk/pull/200) | renderer@0.31.0: DataGrid primitive (Stage 4) | merged ✓ |
| [idf-sdk#202](https://github.com/DubovskiyIM/idf-sdk/pull/202) | renderer@0.32.0: PermissionMatrix primitive (Stage 5) | merged ✓ |
| [idf-sdk#204](https://github.com/DubovskiyIM/idf-sdk/pull/204) | renderer: Wizard primitive + test-connection (Stage 6) | open |
| [idf-sdk#206](https://github.com/DubovskiyIM/idf-sdk/pull/206) | renderer: PropertyPopover + ChipList primitives (Stage 7) | open |

**Gap-каталог:** `docs/gravitino-gaps.md`. **Закрыто:** G1 (tree-nav pattern apply); **G14** (subcollections render-ready) — ждёт merge SDK#192 + host bump. **Open:** G13 (TreeNav runtime-mode) — deferred в отдельный sprint. G15/G16/G17/G11/G2/G3/G12 — в SDK backlog / Stage 8 polish.

**UX pattern bank кандидаты** (`docs/gravitino-ux-patterns-notes.md`): P-1 path-derived hierarchy, P-2 absolute-rooted hierarchy nav, P-3 auto-sections title inference.

---

## 2. Architectural research / insights

Философские находки, на которые стоит вернуться.

### 2.1 Reader-policy formalization — content-set abstraction

**Дата:** 2026-04-20
**Контекст:** `drift-protection-spec.md` ввёл reader-equivalence как §23 аксиому 5. Но формальное определение `content-set` (абстракция, над которой сверяются reader'ы) — open question.
**Action:** Отдельный design `reader-equivalence-protocol.md` когда появится differential-test harness. Определить: text content + structure + available-actions? Или только «какие сущности viewer может видеть»?
**Owner:** `idf-manifest-v2.1/docs/design/`

### 2.2 Per-domain override-coefficient thresholds

**Дата:** 2026-04-20
**Контекст:** Baseline 2026-04-20 показал: `invest` — 1.00 authored, `sales` — 0.61. Invest концептуально CRUD-heavy, возможно норма. Нужны per-domain expected ranges.
**Action:** Empirically определить на 10 доменах: для каждого archetype-mix указать ожидаемый coefficient. Добавить в `drift-protection-spec.md` как reference данные.
**Owner:** `idf-manifest-v2.1/docs/design/drift-protection-spec.md`

### 2.3 deriveProjections в production — gap или feature

**Дата:** 2026-04-20
**Контекст:** Baseline debugging-derived-ui-spec: 88.5% проекций authored, `deriveProjections` не вызывается ни host, ни SDK pipeline. Три интерпретации (gap / feature / mixed via `ontology.features.autoDerive`).
**Action:** Decision-point после CrystallizeInspector + near-miss witnesses — когда ясно, какая interpretation правильная. Не форсировать.
**Owner:** `@intent-driven/core/crystallize_v2/` + host

### 2.4 Cross-stack differential test harness

**Дата:** 2026-04-20
**Контекст:** `drift-protection-spec` Detector 1 формализован, но harness нет. idf-go/idf-rust/idf-swift работают на `idf-spec/fixtures/` изолированно, не diff'ятся друг против друга.
**Action:** CI в каждом cross-stack repo запускает conformance + differential `fold(Φ)` output на shared fixtures. Требует coordination across 4 repos.
**Owner:** `idf-spec/` + 4 implementations
**Связано:** Манифест §26 «Нормативная спека» + «Второй reference implementation»

### 2.5 Salience declaration-order → numeric sub-ranks

**Дата:** 2026-04-20
**Контекст:** Declaration-order ladder (SDK #88 + #90) довёл alpha-fb witnesses до 0 во всех 10 доменах. Open direction из manifesto §26 — **numeric salience для fine-ranking внутри одного tier** (e.g. несколько primary intents требуют явного ordering). Сейчас поверх discrete labels `{primary|secondary|tertiary|utility}` работает declaration-order; numeric (100, 110, 120) даёт автору explicit fine-rank без reorder.
**Action:** Design в `idf-manifest-v2.1` — примеры use cases, heuristics для computed numeric из particles, migration path от labels → numbers. Implementation — уже поддерживается в SDK (computeSalience принимает numbers).
**Owner:** `idf-manifest-v2.1/docs/design/` + SDK core documentation

### 2.6 Pattern bank promotion heuristics — computed defaults

**Дата:** 2026-04-20
**Контекст:** При нехватке explicit salience, computed fallback в `salience.js` даёт 80/70/60/40/30/10 на основе effect shape. Но не покрывает все cases (например: phase-transition с `revokeOn` → больший salience? intent с `preapproval` → меньший visibility?). Эти правила — implicit heuristics, накапливаются в SDK без формальной спеки.
**Action:** Собрать все правила computed в § design-spec; задокументировать «когда computed mispredict'ает» на реальных доменах (можно через audit tool — detection pattern).
**Owner:** `idf-manifest-v2.1/docs/design/intent-salience-spec.md` extension

### 2.7 Manifesto ↔ code drift как first-class metric

**Дата:** 2026-04-20
**Контекст:** Сегодняшняя ревизия `manifesto-v2.md` vs `implementation-status.md` vs реальный код показала: манифест §26 говорил «Цель довести alpha-fb до 0» как aspiration, а код уже это достиг. Implementation-status отставал на 2+ версии SDK. README — на 4 домена. Это sample of §24 methodological note в действии.
**Observation:** Нужен auto-link между manifest claim и concrete state. Один из подходов — manifest теги `[impl-status: ...]` с regex-probe from implementation-status. Drift-protection detector-0. Но это инструментальный слой, не blocking.
**Action:** Deferred — требует design о semantic-tag format.
**Owner:** `idf-manifest-v2.1/docs/design/` (будущий `manifest-drift-linking-spec.md`)

### 2.8 Φ schema-versioning + ontology evolution log + reader gap policy ⚠️ P0-architecture

**Дата:** 2026-04-26 (внешний review)
**Severity:** **P0 для архитектуры формата.** Закрывать **до первого production pilot'а с Φ ≥ 10k эффектов и ≥ 6 месяцев истории**, пока цена не выросла квадратично с числом доменов и линейно с возрастом каждого Φ.

**Контекст.** Φ — append-only лог `confirmed` эффектов, записанных в терминах **текущей** онтологии (ссылки на entity/field/role/invariants). Когда онтология эволюционирует (новое поле, ужесточённый enum, split entity, ужесточённая роль) — старые эффекты остаются, но `fold(Φ)` интерпретирует их через новую схему. Схему, в которой эффект был эмиттен, **сейчас никто не помнит**: ни эффект (нет `schemaVersion` в context), ни ontology (нет evolution log).

**Полу-ответы, которые есть:**
- `spec.renames` (studio PR #28) — declarative переименования entity/field. Idempotent JSONB update. Покрывает только renames на одну транзакцию.
- Breaking-commit gate (studio #26) — превентивная блокировка deploy'я, ломающего legacy data. Не миграция, а отказ.
- Φ snapshot/restore (studio #27) — даёт «откатимся к pre-deploy», не «прочтём legacy в новой схеме».
- `effect.context.actor` + `materializeAuditLog` — provenance события, не схемы.

**Чего нет:**
- `effect.context.schemaVersion` — эффект не помнит свою схему.
- `ontology.upcasts: [{ fromHash, toHash, fn }]` — функции миграции legacy effect → new schema. Должно быть first-class artifact в формате.
- Φ-аналог для самой онтологии (append-only лог evolution с upcasters). Сейчас domain.json коммитится в `projects.domainJson` как plain JSONB.
- **Reader gap policy** — каждый из 4 reader'ов (pixels / voice / agent / document) сейчас graceful'ничает legacy gap (missing field, unknown enum value) **по-своему**. Это **формально нарушает reader-equivalence (§23 axiom 5)**.

**Четыре сценария боли (внешний review):**

| Сценарий | Сейчас |
|---|---|
| Новое поле `task.priority` | `fold` возвращает `undefined`. Pixels рендерят пусто, voice промолчит, agent JSON отдаёт без ключа, document — «—». Reader-equivalence ломается. |
| Enum сжался `open\|done` → `draft\|active\|done\|archived` | Старый row с `status:"open"`. Транзишн-инвариант проверялся на confirm, не пере-валидируется. `assignToSlotsCatalog` встречает unknown в `valueLabels` → crash в renderer (был в практике). |
| `task` → `task` + `subtask` (split entity) | Никак. Старые `task.created` остаются в старом entity; новые subtask'и в новом. Совмещения нет. |
| Роль `viewer` ужесточилась | Эффекты в Φ не пере-валидируются (audit trail). Но `filterWorldForRole` фильтрует на чтении по **текущей** ontology — viewer перестаёт видеть свою историю. |

**Action (минимальный план):**
1. `effect.context.schemaVersion = <hash domain.json>` — append-only лог онтологий по hash'у; эффект помнит свою. Backward compatible (zero migration через JSON).
2. `ontology.upcasts: [{ fromHash, toHash, fn }]` first-class. `fold` становится `fold(upcast(Φ, currentSchema))` — формула меняется, но честно. Upcasters — code, design-time, тестируемые. **Жёсткий запрет runtime-LLM в upcast** (соблазн «LLM прочитает legacy» = смерть детерминизма).
3. **Reader gap policy** в core: каждый reader декларирует strategy для missing/legacy (`hidden | omit | placeholder | error`) — частью контракта reader-equivalence. Пятый detector в `drift-protection-spec.md`.

**Кросс-связи:**
- `idf-manifest-v2.1/docs/design/drift-protection-spec.md` — Layer 3 (reader-equivalence) дополняется Layer 4 (legacy-data-equivalence).
- §1.3 (`__domain` provenance) — параллельный schema-tagging вопрос.
- Manifest v2.1 — добавить главу «Эволюция онтологии» в Часть III (Алгебра).

**Owner:** `@intent-driven/core` (fold/upcast) + `@intent-driven/engine` (lifecycle) + manifest v2.1.
**Источник:** External design review 2026-04-26 (`docs/design/2026-04-26-phi-schema-versioning-spec.md`).

### 2.9 Provenance дизайна (LLM design-time → ontology lineage)

**Дата:** 2026-04-26 (внешний review)
**Severity:** **Полу-gap.** Pattern bank witnesses + anchoring дают derivation lineage; design-provenance в `domain.json` отсутствует. Закрывается append-only полями, не ломает `fold`. Retrofit на legacy intents — ad-hoc, но не катастрофа. Для compliance/healthcare аудитов — must.

**Что есть:** Pattern bank `witness.basis/reliability`, anchoring witness-of-proof, `effect.context.actor`, `materializeAuditLog`, studio `sessions.turns[]` (Postgres append-only лог chat-сессии).

**Чего нет:**
- В самом `domain.json` — `intent.provenance: { authoredBy, llmModel, llmHash, acceptedAt, sessionId }`. Сейчас provenance **снаружи** формата (в studio.sessions Postgres), а для compliance должно быть **внутри** — иначе экспорт `domain.json.tar.gz` теряет lineage.
- `pattern.promotedFrom: [{ domain, witness, sessionId }]` — pattern bank lineage. Дал бы эмпирический ответ на вопрос «сходится ли pattern bank на разумном размере».

**Action:** Дизайн-спека о shape `intent.provenance` + `invariant.provenance` + `pattern.promotedFrom`. Append-only поля в format'е, populate'ятся studio orchestrator'ом при accept/promote.

**Owner:** `@intent-driven/core` + studio sessions writer + manifest v2.1.

### 2.10 Format extensibility — формальный x-namespace + federation Φ

**Дата:** 2026-04-26 (внешний review)
**Severity:** **Стратегический.** Базовая extensibility есть (open base-roles `owner/viewer/agent/observer/admin` как «открытое множество прецедентов», `ontology.features.*` flag-namespace). Формального `x-` namespace в духе OpenAPI extensions — нет. Federation Φ (cross-tenant agent flows) — даже не на roadmap'е.

**Контекст.** IDF описывает приложение целиком (не интерфейс к существующему как OpenAPI / JSON-LD). Это значит, что в момент когда первый enterprise pilot упрётся в ограничение (org hierarchy не ложится на 5 base roles, делегация / имперсонация, временные пермиссии) — он должен иметь формальный путь расширения core, не ломая readers.

**Action:**
- Зафиксировать `x-<namespace>` соглашение для extension fields (на уровне `domain.x-acme.*` и `intent.x-acme.*`), readers игнорируют unknown `x-` keys.
- Federation Φ — отдельный design в manifest v2.1 (cross-tenant intent-push, cryptographic effect signing, multi-Φ fold).

**Owner:** manifest v2.1 + future SDK extension surface.

### 2.11 Consumer-side tooling — социальный layer формата

**Дата:** 2026-04-26 (внешний review)
**Severity:** **Слабая зона.** Все текущие tools (Studio Graph3D, PatternInspector, derivation-diff CLI) — для **авторов**. У OpenAPI вирусность дала Swagger UI как бесплатный onboarding для consumer'ов. У IDF аналога нет.

**Чего нет:**
- Public domain explorer — упасть на чужой `domain.json`, увидеть schema/projections/intents без deploy.
- Domain diff tool для consumer'а (есть для self в studio).
- Embed-snippet (`<idf-embed src="example.json" projection="task_list">`) для блогов/статей.
- Codegen для consumer'а — TS-типы из чужого `domain.json` для интеграции.
- Domain marketplace (есть «Domain marketplace pitch» как M2 — это pitch, не реализация).

**Action:** Не блокирующее, но влияет на adoption-curve. Когда первые 3-5 production tenant'ов работают — возможный dev-relations workstream.

**Owner:** SDK packaging + сайт fold.software.

### 2.12 Sheaf-формулировка целостности — формализация ядра (вторичное)

**Дата:** 2026-04-26 (внешний review, второе письмо)
**Категория:** Формализация ядра.
**Severity:** **Вторичное.** Не на критическом пути M1.x; не блокирует первого production pilot'а. Operationally полезные подзадачи (§2.12a, §2.12b) — отдельные P1, делать в обычном потоке. Полная sheaf-теоретическая формализация требует математика и не должна предшествовать имплементации §2.8 (Φ schema-versioning) и §2.9 (provenance дизайна) — те **на критическом пути**.

**Тезис.** Целостность IDF-домена можно переформулировать **не как набор инвариантов, которые мы проверяем**, а как **математическое свойство домена**, для которого инварианты — приближение. Структурно: роли образуют решётку (poset); `viewerWorld(role) = filterWorldForRole(world, role)` — это restriction map; presheaf на ролях даёт sheaf при выполнении аксиомы склейки. H⁰ = глобальные сечения, H¹ = препятствия к склейке. Это **переворот рамки** статуса формата: «формат с эвристическим валидатором» → «формат с математически определимым понятием корректности».

**Что в IDF уже есть как **presheaf без названия**:**

| Элемент sheaf | В IDF |
|---|---|
| База (poset) | 5 base roles (`owner / viewer / agent / observer / admin`) — открытое множество прецедентов |
| Данные на роли | `viewerWorld(role) = filterWorldForRole(world, role, ontology)` |
| Restriction maps | `filterWorldForRole` — фильтрация world'а под роль |
| Покрытие (cover) | Set of roles — пока не формализовано |
| Sheaf-аксиома | Не проверяется |

**Что верно (сильные стороны формулировки):**

1. Класс багов «agent зависит от поля, которое viewer должен одобрить, но не видит» — **реален**. Compliance-домен с SoD-инвариантами (`reviewer ≠ approver ≠ controlOwner`) ловит подобное на confirm; но если `intent.precondition` ссылается на поле, недоступное роли, которая может intent execute'ить, **никакая локальная проверка не ловит**. Это глобальное препятствие (нарушение H¹).
2. Композиция доменов через restriction maps на пересечении онтологий — **натуральный язык** для проблемы, которую сейчас решаем ad-hoc через `__domain` provenance (§1.3). Formal: домены склеиваются, если restriction maps на пересечении согласованы и H¹ объединённого sheaf'а равен нулю.
3. Иерархия warning'ов получает **природу**: H⁰-нарушения (поле невидимо для всех ролей, хотя должно быть), H¹-нарушения (попарная согласованность без глобальной), локальные. Это **операционно полезно** даже без формальной когомологии — даёт классификацию `domain-audit.json` findings по природе препятствия.

**Где натяжки (слабые места):**

1. **Решётка ролей не такая регулярная**, как предполагает sheaf-формулировка. У нас:
   - `owner` владеет своими row'ами через `ownerField`
   - `agent` может **execute** intents, которые `owner` не может (preapproved orders с budget guard)
   - `observer` — read-only audit с `materializeAuditLog`
   - `admin` — row-override, видит всё
   
   `agent ⊆ owner` по visible-set'ам, но `agent ⊄ owner` по execute-set'ам. Это **две решётки** (read-poset × execute-poset), и они не совпадают. Sheaf нужен над парой со специальной структурой — усложняет когомологию вдвое.

2. **H¹ для конечного poset из 5 элементов вычисляется тривиально** (rank kernel - rank image на cochain complex). Гротендиковские topologies / sites / sheaves of categories Spivak'а — **аппарат для бесконечного / непрерывного**, у нас 5 ролей. Формализм полезен **как язык классификации**, не как computational tool.

3. **Cosheaf-Φ — спекулятивно.** Φ — единый append-only лог, не разделённый по ролям. Эффект от admin'а — не «расширение» эффекта от viewer'а; они независимые. Inclusion-структуры нет. **Что работает двойственно:** для каждой роли r определить `Φ_r` = эффекты, видимые этой ролью, и доказать `restrict_r ∘ fold = fold ∘ filter_r` (filter и fold коммутируют). Это **sheaf-морфизм между Φ-уровнем и world-уровнем**, не cosheaf.

4. **«Почему именно 5 ролей»** — sheaf не даёт обоснования (его критерий «достаточно богатой / простой» выполняется при любом разумном выборе). Реальное обоснование 5 ролей — эмпирическое (из 13 полевых тестов хватало). Sheaf даёт ответ на другой вопрос: «как формально проверить, что выбор не имеет patological holes».

**Самое ценное в формулировке** — **переформулировка статуса формата**: «целостность — математическое свойство, инварианты — аппроксимация». Это в духе IDF («формат, не фреймворк»). Сейчас audit-report выдаёт 187 findings плоским списком — каждое своей природы. Классификация warnings по природе препятствия (locally-visible / pairwise-inconsistent / globally-unrealizable) — **операционно полезно**, даже без формальной когомологии. Drift-protection-spec уже движется в эту сторону (3 detector'а как layers).

**Cross-связи:**

- §2.8 (Φ schema-versioning) — sheaf над **движущейся** базой (онтология эволюционирует → решётка ролей тоже). Возможно ближе к stack'ам, чем sheaves. Парное направление.
- §2.10 (federation Φ) — cross-domain composition как sheaf на пересечении.
- `idf-manifest-v2.1/docs/design/drift-protection-spec.md` — H-классификация как новый layer detector'а.

**Action:** Не делать sheaf-теорию IDF целиком. Зафиксировать как architectural research direction; разделить на:
- **§2.12a (P1)** — `role.extends: [otherRole]` как formal poset + monotonic linter в `audit-report.mjs` (отдельная P1-task ниже).
- **§2.12b (P1)** — static cross-role precondition analyzer (8-я ось в `audit-report.mjs`, отдельная P1-task ниже).
- **§2.12c (deferred)** — полная sheaf-формализация с математиком; design-spec stub в `docs/design/2026-04-26-sheaf-formulation-spec.md`.

**Owner:** `@intent-driven/core/baseRoles` + `audit-report.mjs` + manifest v2.1 (Часть III, Алгебра — раздел «Целостность как когомология»).

**Источник:** External design review 2026-04-26 (второе письмо после §2.8).

### 2.12a Formal `role.extends` poset + monotonic restriction linter (P1)

**Дата:** 2026-04-26
**Severity:** P1, операционная подзадача §2.12.

**Что сделать.** В onto schema разрешить `role.extends: ["otherRole"]` (массив). Linter в `scripts/audit-report.mjs` (новая ось «role-monotonicity») проверяет: если `roleA.extends` содержит `roleB`, то `visibleFields(roleA) ⊇ visibleFields(roleB)` для каждого entity. Нарушение — warning «role inheritance broken».

**Почему сейчас:** Закрывает 70% value sheaf-формулировки без когомологии. Полиномиальный pass, ловит реальный класс багов (admin случайно теряет visibility поля, которое viewer видит).

**Owner:** `@intent-driven/core/baseRoles.js` + `scripts/audit-report.mjs`.

### 2.12b Static cross-role precondition analyzer (P1)

**Дата:** 2026-04-26
**Severity:** P1, операционная подзадача §2.12.

**Что сделать.** Новая ось в `audit-report.mjs` («cross-role-precondition»). Для каждого `intent.precondition` (включая dotted-path вида `Order.status === "paid"`) проверить, что все referenced поля доступны **всем ролям из `intent.permittedFor` (или ролям с этим intent в `canExecute`)**. Если роль может execute, но не может read поле в precondition — emit warning «precondition refers to invisible field».

**Почему сейчас:** Ловит ровно тот класс багов, который sheaf-формулировка называет H¹-нарушением, простым cross-reference анализом. Не требует когомологии.

**Owner:** `scripts/audit-report.mjs` + `@intent-driven/core/conditionParser.js` (для парсинга precondition expressions).

### 2.13 Эргономические законы как формальные предсказания над артефактом — операционное

**Дата:** 2026-04-26 (внешний review, седьмое письмо)
**Категория:** Операционное (не «формализация ядра» как §2.12).
**Severity:** **Вторичное.** Не на критическом пути M1.x; не блокирует первого production pilot'а. Но **сильнее** трёх предыдущих формализационных кандидатов (термодинамика / Information Bottleneck / variational principle) тем, что **computable from static artifact без production telemetry** — что было общим blocker'ом тех направлений.

**Тезис.** В отличие от §2.12 (sheaf — алгебраический язык для уже-делаемого), §2.13 не reframes существующее, а добавляет **внешнюю науку** с собственными количественными законами:

| Закон / модель | Формула | Применение к IDF |
|---|---|---|
| **Fitts** (1954) | `MT = a + b · log₂(D/W + 1)` | Min target size, distance-aware placement |
| **Hick-Hyman** (1953) | `RT = a + b · log₂(N+1)` | Choice overload в slot'ах с большим N |
| **Cowan** (2001, обновлённый Miller 7±2) | working memory ≈ 4 chunks | Лимит на одновременные visual groups |
| **Cognitive Load Theory** (Sweller 1988+) | intrinsic / extraneous / germane | Минимизация extraneous load = минимизация UI noise |
| **GOMS** (Card-Moran-Newell 1983) | predicted task time из operator-sequence | Task completion time из artifact'а до рендера |

**Что верно (сильные стороны):**
1. Computable from static artifact — **закрывает gap** §2.13/§2.14/§2.15 (отклонённых формализационных кандидатов), которым требовалась production telemetry / ground truth / measurable cognitive load.
2. Reference solid — Card/Moran/Newell 1983, CogTool (Bonnie John 2004+), 50+ лет экспериментальной валидации Fitts.
3. Industry gap real — Vercel v0, Claude artifacts, GitHub Copilot не выдают «expected task completion time» как predict для output. У нас **детерминированный артефакт** — GOMS-анализ реализуем.
4. Operational extracts (P2-P3) реализуемы **сейчас**, без производственных данных и математика.

**Где натяжки:**
1. Fitts/Hick — для **motor/choice tasks**, не для всего UI. Reading comprehension (Just&Carpenter), visual search (Treisman) — другие модели. Эргономика — не один аппарат, а несколько.
2. GOMS prediction accuracy ≈ 20-40% — для **comparing alternatives** и **screening gross violations**, не fine-grained ranking.
3. Computing GOMS требует task script (последовательность user actions) — у нас есть intent declaration, но реальная sequence зависит от **adapter rendering**. То есть GOMS-прогон — `(intent × adapter × ontology) → time`, не `intent → time`. Реализуемо, но non-trivial.
4. Working memory 4±1 — applies to **task chunking** и **transitions между screens**, не «items на экране» (catalog с 30 cards user не «удерживает» — он скан'ит).

**Cross-связи:**
- §2.12 (sheaf) — даёт class of cross-role bugs. §2.13 даёт **другой class**: gross UI violations (too many choices, working memory overload, target size). Дополняют друг друга.
- §2.14 IB / §2.15 variational (отклонены) — общий blocker «нет ground truth». §2.13 закрывает: эргономика даёт apriori predictive model.
- `idf-manifest-v2.1` — возможный новый абзац в Часть IV (Четыре читателя): ergonomic prediction как часть pixel-reader contract.

**Action:** Не делать «эргономическую теорию IDF» полностью. Разделить на:
- **§2.13a (P2)** — Fitts target-size axis в `audit-report.mjs` + `adapter.capabilities` declaration (отдельная подзадача ниже).
- **§2.13b (P2)** — Hick-Hyman / Miller working-memory axis в `audit-report.mjs` (отдельная подзадача ниже).
- **§2.13c (deferred research-grade)** — GOMS-prediction для adapter benchmarking — реальный operational вклад в industry, реализуемо после первого production tenant'а с usage logs для validation.

**Owner:** `scripts/audit-report.mjs` + `adapter.capabilities` декларация + manifest v2.1 (Часть IV).
**Источник:** External design review 2026-04-26 (седьмое письмо после §2.12/§2.13/§2.14/§2.15 — седьмой рассмотрен, четыре приняты в backlog, три отклонены).

### 2.13a Fitts target-size axis в audit-report (P2)

**Дата:** 2026-04-26
**Severity:** P2, операционная подзадача §2.13.

**Что сделать.** В `adapter.capabilities` (renderer/src/adapters/registry.js) добавить declared constants:
- `minTargetSize: { width: 44, height: 44 }` (WCAG 2.5.5 baseline для AA)
- `density: "compact" | "comfortable"` (info для density-aware placement)

В `scripts/audit-report.mjs` — новая ось «target-size»:
- Для каждого `pattern.structure.apply`, генерирующего clickable element — проверить, что rendered target satisfies `adapter.capabilities.minTargetSize`.
- Warning «target below WCAG AA» для violations.

**Почему сейчас:** Реализуется без change в crystallize logic. Просто declarative + lint. Закрывает реальный класс a11y-багов.

**Owner:** `@intent-driven/renderer/adapters/registry.js` + `scripts/audit-report.mjs`.

### 2.13b Working-memory axis (Hick-Hyman / Miller / Cowan) в audit-report (P2)

**Дата:** 2026-04-26
**Severity:** P2, операционная подзадача §2.13.

**Что сделать.** Новая ось «working-memory» в `audit-report.mjs`. Три проверки:

1. **Choice overload (Hick-Hyman):** если slot имеет N items с N > 7 — warning «choice overload, рассмотри faceted-filter-panel или paginate».
2. **Top-level navigation (Cowan):** если `ROOT_PROJECTIONS` для роли > 4 distinct visual groups — warning «working-memory overload at top level, рассмотри group или hub-absorption».
3. **Form complexity:** если `archetype: "form"` или `wizard step` имеет > 7 visible fields одновременно — warning «form complexity, рассмотри tabbedForm или wizard split».

**Почему сейчас:** Полиномиальный pass (counting). Не требует GOMS-симуляции, дополняет существующий R8 hub-absorption (который уже снимает «много flat tabs»).

**Owner:** `scripts/audit-report.mjs`.

---

### 2.14 IR-stages — типизированные границы внутри `crystallize_v2` (research)

**Дата:** 2026-04-26
**Severity:** P2 research, depends on §2.8 closeout. Параллельное §2.12 (sheaf) и §2.13 (ergonomic) направление: формализация уже существующего, не выдуманное расширение.

**Контекст.** Внешний reviewer 2026-04-26 (8-е письмо) предложил пересобрать `crystallize` из «магической функции» в MLIR-style лестницу IR. Зацепка резонирует частично: лестница **де-факто существует** в коде (`assignToSlots*` → `deriveShape`/`absorbHubChildren` → `slots.*` → `applyStructuralPatterns` → adapter codegen), но без типизированных границ между ступенями и без property-based тестов per-level. Witness trail (`artifact.witnesses[]`) уже даёт «аннотацию через уровни», но не верифицируется отдельно от соседей.

**Что предлагается** (light-touch, без MLIR-инфраструктуры):

1. **Назвать существующие стадии явно.** В `crystallize_v2/index.js` extract'нуть фазы 1-3a-3b-3c-3d с возвратом промежуточных артефактов: `semanticArtifact` (intent → slot/anchored), `structuralArtifact` (+ shape + hubAbsorption), `layoutArtifact` (slots уложены, без adapter), `patternedArtifact` (после apply). Сейчас pipeline inline, snapshot per-stage не фиксируется.
2. **Расширить witness contract.** К существующему `basis: "structural-rule" | "pattern-bank" | "declaration-order" | ...` добавить `stage: "semantic" | "structural" | "layout" | "pattern"`. Аддитивно, breaking ничего.
3. **Property-tests per stage** (новый `packages/core/src/__tests__/per-stage-properties/`):
   - **semantic-conservation** — `every intent ∈ output.slots ∪ artifact.anchorRejections` (никакой intent не пропал тихо)
   - **structural-reachability** — `forall intent: navGraph.distance(root, intent) ≤ K` (любое действие достижимо через ≤N кликов)
   - **pattern-idempotency** — `apply(apply(slots)) == apply(slots)` (повторное применение не меняет результат)
   - **reader-equivalence per stage** — semantic-уровень даёт изоморфный information content для 4 reader'ов; layout — точка где материализации расходятся.
4. **`explainCrystallize()` отдаёт per-stage tree**, не плоский список. Это уже планировалось в §28 v2.1 («Debugging derived UI»); здесь финализируется shape результата.
5. **MLIR — как референс, не как dependency.** Никакого `tablegen` / `dialect` / `lowering` в коде формата. Внутренний ADR через 6 mo: «нужна ли реальная typed-IR-инфраструктура».

**Что НЕ делается** (натяжки от MLIR-аналогии):
- Layout IR с Fitts's-Law предикатами — у нас семантические слоты, не геометрия. Геометрия делегирована в адаптеры через `adapter.capabilities`. Ergonomic-предикаты (Fitts/Hick-Hyman/Cowan) живут на адаптерном уровне через §2.13a/b axis'ы, не внутри IR-stages.
- «4 адаптера = 4 codegen-backend'а одного UI» — неверно. Voice / agent-API / document — другие read-проекции Φ через материализаторы, не lowering targets pixels-IR.
- Полный typed-dialect framework — over-engineering под текущий объём (≤ 10 авторов формата).

**Польза.**
- **Diff-able артефакты per-stage** — самый сильный аргумент. Сейчас `derivation-diff.mjs` показывает только final-vs-final. С stages — автор видит, какая ступень провалилась, не «перегенерировал, всё стало другое».
- **Property-tests заменяют convention-by-invariant.** Сейчас «ни один intent не пропал» — invariant-by-convention, теста нет.
- **Pattern Bank как rewrite-rules с pre/post-condition'ами на patterned-IR** — композиционность (порядок применения) и falsification-fixtures на промежуточном представлении.
- **§28 «Debugging derived UI» (v2.1)** — естественно расщепляется на per-stage, witness-`stage` поле даёт structured drill-down вместо flat-списка witnesses.
- **Drift-protection (manifest v2.1, 3 detector layers)** — Layer 1 conformance-drift на `patternedArtifact`, Layer 3 reader-equivalence на `semanticArtifact`. Detector'ы становятся реализуемы поэтапно, не «всё сразу».

**Зависимости / порядок.**
- **§2.8 первым.** Φ schema-versioning ставит лестницу на двигающуюся базу — без неё IR-stages работают только на «срезе во времени» одной онтологии. Сделать stages раньше = переделывать после.
- **manifest v2.1 finalize вторым.** §28 (Debugging derived UI) как глава Части V уже формулирует witness-`basis`; IR-stages добавляет `stage`-поле и пишется как новая глава §29 в Часть III или §28.bis.
- **Параллель к §2.12 (sheaf) и §2.13 (ergonomic).** Sheaf — горизонтальная композиция (cross-role). Ergonomic — apriori behavioral predictions поверх final artifact'а. IR-stages — вертикальная композиция (внутри одной crystallize-проходки). Не пересекаются, дополняют.

**Зафиксировано:**
- `docs/design/2026-04-26-ir-stages-spec.md` (~280 LOC, design-spec)
- PR (этот) — backlog item + spec, stacked поверх #131 (§2.8) → #132 (§2.12) → #133 (§2.13)

**Owner:** `@intent-driven/core/crystallize_v2/*` (extract stages, witness `stage`-поле) + manifest v2.1 (новая глава §29 в Часть III или §28.bis в Часть V) + `idf-spec` (опционально L2/L3 conformance — «artifact MUST/MAY expose per-stage snapshots»).

**Когда закрывать.** После §2.8 closeout, до публикации manifest v2.1. Реализационная стоимость — 3-4 SDK PR'а (extract + witness + property-tests + explainCrystallize tree-shape), без breaking changes.

**Метрика успеха.**
- `derivation-diff` показывает per-stage delta для любых двух ontology-версий
- ≥ 4 property-tests прогоняются per-stage в SDK CI (semantic-conservation + structural-reachability + pattern-idempotency + reader-equivalence-semantic)
- `explainCrystallize()` возвращает tree-shape, не flat-список witnesses
- Drift-protection Layer 3 reader-equivalence runtime-check реализован поверх `semanticArtifact` (а не пытается это делать на final output)

**Cross-связи:**
- §2.8 (Φ schema-versioning) — IR-stages работает на срезе, schema-versioning даёт upcasters между срезами; stages × срезы = matrix свойств для проверки
- §2.12 (sheaf) — IR-stages вертикальная, sheaf горизонтальная; independent
- §2.13 (ergonomic laws) — IR-stages про инвариантность переходов, ergonomic про behavioral predictions; разные оси
- `idf-manifest-v2.1/docs/design/debugging-derived-ui-spec.md` — §28 уже содержит witness `basis`, IR-stages добавляет `stage` как ортогональную ось
- `idf-manifest-v2.1/docs/design/drift-protection-spec.md` — три detector layer'а становятся per-stage detector'ами, реализуются поэтапно

---

## 3. Cross-cutting observations

Наблюдения, не привязанные к одному workstream'у.

### 3.1 `CLAUDE.md` в `.gitignore`

**Дата:** 2026-04-20
**Контекст:** `docs/superpowers/`, `CLAUDE.md` — все в `.gitignore`. Они local-only. Backlog — нет (чтобы был shared across sessions и визбли во всех worktree'ях).
**Observation:** Backlog файл должен быть **committed**, в отличие от CLAUDE.md. Иначе новая сессия в чистом worktree не увидит.

### 3.2 Changeset bot vs manual version bumps

**Дата:** 2026-04-20
**Контекст:** X-ray PR — changeset сработал на SDK, но когда main успел выпустить 0.22.0 до моего merge, collision. Ручной rebump до 0.23.0 решил.
**Observation:** При параллельной работе двух агентов над SDK — rebase conflicts нормальны. Changeset bot не знает про pending PRs. Нужно держать в уме при coordination.

### 3.3 `.worktrees/` scoping — один воркфлоу, один worktree

**Дата:** 2026-04-20
**Контекст:** За сегодняшнюю сессию создано 4+ worktree'ев (derivation-xray в idf + idf-sdk, drift-protection в manifest, session-backlog в idf). Изоляция помогает.
**Observation:** Конвенция: один worktree = один coherent PR workstream. Cleanup через `git worktree remove` после merge.

### 1.X Renderer-support для новых filter-форматов (R7b / R10 / R11 v2)

**Дата:** 2026-04-20
**Контекст:** SDK правила R7b (multi-owner disjunction), R10 (m2m-via scope), R11 v2 (owner-scoped temporal feed) выводят structured-filter поля новых форм:
- `{ kind: "disjunction", fields: [...], op, value }` — R7b
- `{ kind: "m2m-via", via, viewerField, joinField, localField, ... }` — R10
- `{ field, op: "=", value: "me.id" }` + `sort: "-<ts>"` — R11 v2

`List` primitive сейчас интерпретирует только простой `evalCondition` string-filter.
Новые форматы игнорируются → projection генерируется, но в UI не фильтруется.
**Action:** обновить `@intent-driven/renderer/primitives/containers.jsx::List` (и аналоги в ArchetypeDetail) чтобы распознавать `filter.kind` и применять соответствующую логику.
**Owner:** `@intent-driven/renderer` + adapter (возможно server-side `filterWorldForRole` уже знает эту семантику — shared helper).
**Связано:** SDK PR'ы #73, #64 (merged), #84 (open).

### 1.Y Renderer-support для singleton-detail без idParam (R3b)

**Дата:** 2026-04-20
**Контекст:** R3b генерирует `my_<entity>_detail` без idParam + `singleton: true`. Сейчас `ArchetypeDetail` требует routeParams[idParam]. Для singleton нужно fallback на `world[entity].find(e => e[ownerField] === viewer.id)`.
**Action:** `ArchetypeDetail` читает `projection.singleton`, resolve target через ownerField+viewer.
**Owner:** `@intent-driven/renderer/archetypes/ArchetypeDetail.jsx`
**Связано:** SDK PR #76 (merged), idf#60 (merged).

### 1.Z R11b — multi-owner disjunction feed (future)

**Дата:** 2026-04-20
**Контекст:** R11 v2 поддерживает только single-string `ownerField`. Array ownerField (multi-owner) — не триггерит `my_*_feed`. Аналог R7b для temporal streams. Пока не было реального domain case, но будет: shared-stream с множественными ownership (e.g. `Notification.recipientIds`).
**Action:** extend R11 witness builder `disjunction` mode по образцу `witnessR7bMultiOwnerFilter`.
**Owner:** `@intent-driven/core/crystallize_v2/`

### 1.W Near-miss witnesses для R11/R11 v2

**Дата:** 2026-04-20
**Контекст:** `collectNearMissWitnesses` покрывает R3/R1b/R7/R10. Не покрывает R11 (entity с `createdAt` полем, но без `temporal:true`).
**Action:** heuristic — если entity имеет field с суффиксом `-At` или fieldRole `datetime`, но без `temporal` флага — emit near-miss с suggestion добавить `temporal:true`.
**Owner:** `@intent-driven/core/crystallize_v2/nearMissWitnesses.js`

## 2. Architectural insights (не задачи, а наблюдения)

### 2.5 R-rule evolution — deep-fix effect

**Дата:** 2026-04-20
**Контекст:** R7 v2 (relax precondition R1→R3 fallback) — **7-строчный patch** закрыл 8 uncovered cases across 4 доменов. R9 (cross-entity composite, 45 LOC + 16 тестов) — 0 cases до filter refinement.
**Observation:** **audit existing rules for internal coupling перед добавлением новых**. Implicit design-constraints (R7 требует R1) пряли большие impact pockets. Surfaces через один домен (freelance.Deal), но latent impact был скрыт в sales/invest/delivery тоже.
**Template:** при добавлении нового R-правила — проверять, есть ли pre-existing правило с precondition, которое избыточно для semantic'а (как R1 catalog для R7 был избыточен — нужен только для witnesses, не для фильтра).

### 2.6 Classifier heuristic filter-presence bit

**Дата:** 2026-04-20
**Контекст:** `uncovered-classification.mjs` heuristic match по `!!authored.filter === !!derived.filter` — бинарный filter-presence. Блокирует rename когда filter semantics совпадают но format отличается (R11 public vs authored owner-scoped).
**Observation:** Heuristic достаточен для первичной классификации, но не для fine-grained Δ measurement. Будущие finding'и могут скрываться за "derived не matched из-за filter mismatch" — проверять прямо через probe script, не полагаться только на classifier.

### 2.7 R-rule roadmap finalized — 13 правил

**Дата:** 2026-04-20
**Контекст:** Debugging-derived-ui workstream завершён. Итог: 13 правил деривации (R1, R1b, R2, R3, R3b, R4, R6, R7 v2, R7b, R8, R9, R10, R11 v2) + composeProjections + explainCrystallize + resolveCompositions + near-miss witnesses + CrystallizeInspector (§27 host).

**Metrics финальные:**
- Baseline: U = 24 (21%) при 88.5% authored.
- После всех правил + ontology audit + R11 v2 activation: **U = 11 (9.5%)** (predicted).
- Realization: **100% от spec-predicted -13**.
- Остающиеся 11 — **genuine edge cases** (admin-only, 3-level composite, cross-role scope, complex OR filter, специфические patterns без universal rule).

**Observation:** Format подошёл к natural ceiling R-правил. Следующие 5% gap (от 9.5% до 5%) потребуют либо очень узкие rules (diminishing returns), либо пересмотр фундаментальных допущений (composable filter DSL). Не urgent.

---

## History — completed items

*(здесь накапливаются пункты, которые были закрыты; для истории и чтобы видно прогресс. По достижении большого объёма — архивировать в `docs/archive/backlog-YYYY-MM.md`.)*

### ✅ Cross-role precondition analyzer — operational extract sheaf-формулировки

**Дата:** 2026-04-26. **Контекст:** Sheaf-формулировка целостности (PR #132 stacked, застряла в feature-branch — содержимое не на main, поэтому open §2.12 не существует здесь). Operational extract — статический cross-reference analyzer, ловит класс H¹-нарушений простым полиномиальным pass'ом без когомологии.

**Что сделано:**
- `scripts/lib/cross-role-precondition.mjs` — модуль с `extractPreconditionFieldRefs` / `rolesThatCanExecute` / `isFieldVisibleToRole` / `auditCrossRolePrecondition`. Поддерживает обе формы precondition: object `{Entity.field: [vals]}` и string-expression.
- `scripts/audit-report.mjs` — новая axis «crossRolePrecondition» в orchestration; import функции из lib/.
- `scripts/lib/cross-role-precondition.test.mjs` — 19 unit-тестов (4 helper + 9 integration с synthetic ontologies, включая negative fixtures).

**Алгоритм:**
```
∀ intent ∈ ontology.intents:
  preconditionFields = parse(intent.precondition)
  ∀ role: intent ∈ role.canExecute:
    ∀ {entity, field} ∈ preconditionFields:
      if !isFieldVisibleToRole(role, entity, field):
        emit warning «role X executes intent, но не видит entity.field в precondition»
```

**Bypass:** `role.base === "admin"` (row-override), `visibleFields[Entity] = ["*"]`.

**Skip cases:** entity не в ontology, field не существует — другие axes ловят.

**Baseline (2026-04-26):** на текущих 14 доменах — **0 findings** (только automation имеет preconditions, и все референсы visible для exec-ролей). Ось работает на регрессионную защиту: будущие preconditions (compliance / sales / freelance / новый workflow editor) автоматически проверяются.

**Backlog item:** §2.12b sheaf-formulation-spec.md operational P1 task.

**Дата начала:** 2026-04-20. **Дата закрытия:** 2026-04-20.
**Контекст:** Freelance `Deal.customerId !== Deal.executorId` нельзя было выразить простым kind'ом.
**Закрытие:** параллельный агент добавил handler `expression` на origin/main (core@0.32.0, single-arg `(row)`). В рамках 13-го полевого теста (compliance/SOX ICFR) расширен до `(row, world, viewer, context)` — PR idf-sdk#96, затем PR idf-sdk#98 (`materializeAuditLog` + `buildAuditContext`) → core@0.33.0. Использовано в compliance-домене как 5 expression-invariants (SoD reviewer/approver/CFO + dynamic threshold approvals + cycle-close guard). Backward-compat сохранён: старые single-arg predicate'ы продолжают работать.

### ✅ 13-й полевой тест — compliance-домен (SOX ICFR)

**Дата:** 2026-04-20. **Merge:** PR idf#86.
**Scope:** 10 сущностей, 6 ролей, 15 invariants (5 expression-kind), 7 rules (все 4 v1.5 ext), 38 intents (5 с `__irr:high`), 20 projections. Первый домен, задействующий все 5 behavioral patterns signal-classifier'а. Reuse AntD enterprise-fintech адаптер.
**Выходные artifact'ы:** dev-route `/compliance`, 31 domain-local тест, 799/799 host tests pass. SDK bumps 0.31.2 → 0.33.0 (PR idf-sdk#96 + #98).
**Spec:** `docs/superpowers/specs/2026-04-20-compliance-domain-design.md` (local). **Investor pitch:** `docs/superpowers/specs/2026-04-20-compliance-investor-pitch.md` (local).
**Открытые follow-up'ы (новые backlog-items):** polymorphic Evidence.attachedTo (sparse-columns в MVP); computed ownerField для Attestation через Control FK; `role.scope: {kind: "expression"}` support в filterWorldForRole; audit-log pagination; CFO как 6-й base role `sponsor`/`attestor` — отдельный design.
