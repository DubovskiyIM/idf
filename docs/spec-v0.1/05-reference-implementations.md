# 5. Reference Implementations

Эта глава перечисляет reference-реализации спецификации v0.1. Reference-реализация — это код, который авторизовал формат: неоднозначности в спецификации разрешаются в её пользу, но поведение, не зафиксированное нормативно (§0.4), **не** становится нормативным просто потому, что оно есть в reference-коде.

Все reference-реализации опубликованы в публичном реестре npm.

## 5.1 Ядро

### `@intent-driven/core`

**Версия:** 0.7.0 · **License:** BUSL 1.1 · **Track:** — (не материализует, но обеспечивает семантику)

**Роль:** reference-парсер / кристаллизатор / anchoring gate / fold engine / composition algebra / invariants / materialization helpers (document, voice).

**Экспорты:**

- `crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, domain, opts?) → {projectionId: Artifact}` — основная функция кристаллизации;
- `fold(effects) → world` — свёртка Φ;
- `causalSort(effects) → effects[]` — топологическая сортировка;
- `checkComposition(a, b) → "ok" | "bottom" | "order"` — алгебра композиции;
- `checkAnchoring(intents, ontology, opts) → findings` — anchoring gate;
- `checkInvariants(world, ontology) → { ok, violations }` — runtime-проверка инвариантов;
- `filterWorldForRole(world, role, ontology, viewer) → filteredWorld` — viewer-scoped фильтрация;
- `materializeAsDocument(projection, world, viewer)` — document-материализация;
- `materializeAsVoice(projection, world, viewer, format)` — voice-материализация;
- `BASE_ROLES`, `getRolesByBase`, `auditOntologyRoles` — таксономия ролей;
- `inferFieldRole(field, ontology) → { role, reliability, basis }` — семантическая роль поля.

**Conformance class:** **L1** (по умолчанию). Реализует полный парсинг + семантику ядра. Не рендерит — track'и пусты.

### `@intent-driven/canvas-kit`

**Версия:** 0.2.0 · **License:** MIT · **Track:** — (вспомогательная библиотека)

**Роль:** SVG / canvas утилиты (`makeSvgScale`, `axisTicks`, `pointsToPath`, `heatmapColorScale`, `useTooltipPosition`, `useDraggablePoint`, `useZoomPan`, `clusterLayout`, `calendarGrid`) для написания domain-specific canvas-компонентов.

## 5.2 Pixel renderer

### `@intent-driven/renderer`

**Версия:** 0.4.0 · **License:** MIT · **Track:** `pixels`

**Роль:** ProjectionRendererV2 — принимает Artifact v2, выбирает соответствующий archetype-рендерер, распределяет slot-items через registered UI-адаптер.

**Покрытие:** все 7 архетипов (A4) · все 10 control-архетипов (C3) · 3 primitive-категории (atoms / containers / chart / map / IrreversibleBadge).

**Зависимости:** `@intent-driven/core@^0.7.0`, peer — один из адаптеров ниже.

**Conformance class:** **L3** для track `pixels` (адаптер-зависимо).

### `@intent-driven/adapter-mantine`

**Версия:** 1.1.0 · **License:** MIT · **Track:** `pixels`

**Стиль:** corporate / data-dense. Mantine 9.

**Capability surface:**
```json
{
  "primitive": {
    "chart":     { "chartTypes": ["line", "pie", "column"], "fallback": "svg" },
    "sparkline": { "fallback": "svg" },
    "statistic": false,
    "map":       { "fallback": "svg" }
  },
  "shell":  { "modal": true, "tabs": true },
  "button": { "primary": true, "secondary": true, "danger": true, "intent": true, "overflow": true }
}
```

### `@intent-driven/adapter-shadcn`

**Версия:** 1.1.1 · **License:** MIT · **Track:** `pixels`

**Стиль:** handcrafted / sketch / doodle. shadcn/ui + Tailwind 4.

### `@intent-driven/adapter-apple`

**Версия:** 1.1.1 · **License:** MIT · **Track:** `pixels`

**Стиль:** premium / visionOS-glass / Apple. SF Pro + frosted glass эстетика.

### `@intent-driven/adapter-antd`

**Версия:** 1.1.0 · **License:** MIT · **Track:** `pixels`

**Стиль:** enterprise-fintech / dashboard. Ant Design 5 + `@ant-design/plots`.

**Capability surface:**
```json
{
  "primitive": {
    "chart":     { "chartTypes": ["line", "pie", "column", "area"] },
    "sparkline": true,
    "statistic": true
  }
}
```

**Доказательство conformance:** четыре адаптера рендерят один и тот же Artifact v2 без изменений в `@intent-driven/renderer` или в доменах. Это первый живой пруф параллельной реализации одного формата.

## 5.3 Non-pixel materializers

Non-pixel материализаторы в v0.1 реализованы в host-прототипе `idf` (ещё не вынесены в отдельные SDK-пакеты — планируется SDK Phase 3 `@intent-driven/server`).

### Voice materializer

**Файл:** `server/schema/voiceMaterializer.cjs` (прототип `idf`, MIT)

**Endpoint:** `GET /api/voice/:domain/:projection?format=json|ssml|plain&as=role`

**Output форматы:**
- `json` — raw turns array (для voice-agent: Claude Voice / OpenAI realtime);
- `ssml` — SSML XML (для стандартных TTS-движков);
- `plain` — чистый текст (debug / IVR).

**Покрытие:** catalog / feed / detail / dashboard / wizard. Canvas → placeholder.

**Conformance class:** **L2** для track `voice` (архетипы A3 + A4 canvas как placeholder).

### Document materializer

**Файл:** `server/schema/documentMaterializer.cjs` (прототип `idf`, MIT)

**Endpoint:** `GET /api/document/:domain/:projection?format=html|json&as=role`

**Output:** document-граф (см. §3.5.4).

**Покрытие:** catalog / feed / detail / dashboard. Canvas и wizard → placeholder.

**Conformance class:** **L2** для track `document`.

### Agent-API materializer

**Файл:** `server/routes/agent.js` (прототип `idf`, MIT)

**Endpoints:** `GET /api/agent/:domain/schema`, `GET /api/agent/:domain/world`, `POST /api/agent/:domain/exec`.

**Покрытие:** все 9 доменов прототипа, JWT-auth, preapproval guard.

**Conformance class:** **L3** для track `agent-api` (полный whitelist canExecute + preapproval + ownership + m2m scope + relations в schema).

## 5.4 Tooling

### `@intent-driven/cli`

**Версия:** 1.0.4 · **License:** MIT

**Роль:** domain authoring tool. `npx @intent-driven/cli init <domain>` ведёт 5-шаговый LLM-диалог (Claude haiku/sonnet/opus) и генерирует каталог домена: `domain.js` (ontology + intents + projections), `seed.js`, smoke-test, `package.json`, `README.md`. Self-validation прогоняет `crystallizeV2` на собственный output.

Не является conformant implementation формата в смысле §3; это генератор входа, а не парсер/рендерер. Но его выход — legitimate input для любой conformant реализации.

## 5.5 Host-прототип

**Репозиторий:** `github.com/DubovskiyIM/idf`
**Публичное демо:** https://idf.intent-design.tech

**Роль:** интеграционный testbed — 9 доменов (booking / planning / workflow / messenger / sales / lifequest / reflect / invest / delivery), 572 интента, 119 проекций, Express-сервер с полным runtime (validator / fold / Rules Engine / scheduler / invariants / 4 материализации).

**Conformance class:** **L4** — L3 (реализация через `@intent-driven/renderer` + 4 адаптера) × 4 track'а (pixels + voice + agent-api + document).

Хост-прототип — **единственная** текущая L4-реализация. Независимые L2+ имплементации (на SwiftUI / Kotlin / Rust / Python) — открытое приглашение. Для перехода спецификации в статус Candidate Recommendation (см. §0.2) требуется минимум две независимые L2+ реализации помимо этого прототипа.

## 5.6 Лицензирование reference-реализаций

| Компонент | Лицензия |
|---|---|
| `@intent-driven/core` | BSL 1.1 (Change Date: через 4 года → MIT) |
| Все остальные SDK-пакеты | MIT |
| Host-прототип `idf` | MIT |
| Спецификация (этот документ) | CC BY 4.0 |

BSL 1.1 на ядре — защита от reimplement-and-compete до широкого распространения формата. После Change Date ядро перейдёт в MIT автоматически.

## 5.7 Независимые conformant implementations

Раздел зарезервирован. Сюда будут добавляться ссылки на независимые реализации по мере их появления.

Шаблон записи:

```
### [Implementation name]
- Репозиторий: ...
- Версия: ...
- Лицензия: ...
- Track'и: [...]
- Conformance class: ...
- Публичный test-report: ...
- Контакт: ...
```
