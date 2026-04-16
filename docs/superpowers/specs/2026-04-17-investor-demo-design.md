# Investor Demo — One Artifact, Four Worlds

**Дата:** 2026-04-17
**Цель:** Подготовка вау-демо для ангельского инвестора (Казахстан, нефтяной бизнес, IT-опыт, венчурный бэкграунд, связь с Fonte Capital / МФЦА)
**Формат:** Live-демо + эксперимент + HTML-презентация

---

## Контекст инвестора

- Ангел с крупным нефтяным бизнесом в Казахстане
- IT-бизнес, опыт венчурных инвестиций (и потери, и иксы)
- Связан с Fonte Capital — управляющая инвестиционная компания в МФЦА (первый Bitcoin ETF в ЦА, Solana ETF со стейкингом, 6+ фондов)
- Ценит: конкретику («покажи, не расскажи»), defensibility, бизнес-модель

## Текущее состояние проекта

- 9 доменов, 531 интент, 458 тестов (все green)
- 4 UI-адаптера (Mantine, shadcn, Apple, AntD)
- 4 материализации (pixels, voice, agent API, document)
- SDK на npm: 8 пакетов `@intent-driven/*`
- Production deploy: idf.intent-design.tech
- 74-шаговый agent-smoke покрывает 8 доменов

## Prerequisite: Починка адаптеров

### Критические баги (блокеры демо)

| # | Баг | Где | Решение |
|---|-----|-----|---------|
| 1 | AntD стили не грузятся — invest рендерится plain | SDK `adapter-antd/package.json` — нет `"./styles.css"` export; `main.jsx` — нет import | Добавить CSS export в package.json + `import '@intent-driven/adapter-antd/styles.css'` в main.jsx |
| 2 | Модалка PrefsPanel закрывается при переключении адаптера | `prototype.jsx` ~строка 199 — `key={adapterKey}` на контейнере | Убрать key с контейнера; adapter switch не требует remount всего дерева |
| 3 | shadcn/apple ModalShell — `opened` prop undefined, модалки не открываются | SDK `adapter-shadcn/src/adapter.jsx`, `adapter-apple/src/adapter.jsx` | Заменить `open={opened}` на `open={true}` — компонент рендерится только когда модалка нужна |
| 4 | shadcn PostCSS `@import` order — невалидный CSS в dist | SDK `adapter-shadcn/package.json` build script | Исправить порядок: `@import` statements перед `@theme` в dist/theme.css |

### Не чиним сейчас (не блокирует)

- CSS vars race condition при первом переключении (миллисекунды)
- Mantine отсутствие theme.css (MantineProvider устанавливает vars)
- AntD capability declaration vs reality (charts работают если @ant-design/plots установлен)

### Визуальный уровень после починки

- AntD в invest → enterprise dashboard (Statistic cards, таблицы)
- Apple → premium minimal (Robinhood-стиль, glass-эффекты)
- shadcn → handcrafted sketch (doodle-стилистика)
- Mantine → data-dense corporate (Bloomberg-стиль)
- Переключение: один клик в PrefsPanel, без перезагрузки, без потери данных

---

## Блок 1: Live-демо «Четыре материализации» (~7 мин)

### Сценарий

1. Invest-домен открыт в браузере (AntD адаптер по умолчанию)
2. Навигация: портфели → цели → рынок → рекомендации — показываем breadth
3. Переключение адаптера live: AntD → Apple → shadcn → Mantine
4. Document materialization: `GET /api/document/invest/portfolios_root` → HTML-отчёт в новой вкладке
5. Voice materialization: `GET /api/voice/invest/portfolios_root` → speech-script
6. Agent API: `GET /api/agent/invest/schema` → «робот видит ту же семантику что UI»

### Claim

> «Один JSON-артефакт → пиксели в 4 стилях + голос + документ + API. Zero frontend code. То, на что обычно уходит 6 команд и 12 месяцев, мы делаем из одного артефакта.»

---

## Блок 2: Эксперимент «Claude как пользователь invest» (~8 мин)

### Позиционирование

Три пути взаимодействия AI-агента с приложением:
- **Anthropic (computer-use):** агент тыкает в пиксели — ненадёжно
- **OpenAI (function-calling):** агент дёргает RPC — нет UI-семантики
- **IDF (третий путь):** агент работает через семантический API с programmatic guardrails — надёжно и безопасно

### Формат: Split-screen

- Левая часть: терминал — Claude выполняет HTTP-запросы
- Правая часть: браузер — invest UI обновляется в реальном времени через SSE
- Центр/overlay: HTML-презентация показывает текущий акт

### Сценарий: 7 актов

| Акт | Роль | Intent | Ожидание | Что видно в UI |
|-----|------|--------|----------|----------------|
| 1 | investor | `register` + `create_portfolio` | 200 OK | Новый портфель появляется в списке |
| 2 | investor | `start_risk_questionnaire` → `set_risk_horizon` → `set_risk_tolerance` → `compute_risk_profile` | 200 OK | Wizard-прогресс, профиль риска заполняется |
| 3 | investor | `delegate_to_agent` (max 50K, stock/bond/etf) | 200 OK | AgentPreapproval появляется |
| 4 | agent | `agent_fetch_market_signal` → `agent_propose_rebalance` | 200 OK | Новый сигнал + рекомендация в UI |
| 5 | agent | `agent_execute_preapproved_order` (total=3000, assetType=stock) | 200 OK | Транзакция появляется в портфеле |
| 6 | agent | `agent_execute_preapproved_order` (total=312000) | **403 preapproval_denied** | **WOW:** Попытка заблокирована, уведомление в UI |
| 7 | observer | `GET /api/document/invest/regulator_report` | 200 HTML | Compliance-документ открывается |

### Claim

> «Агент работает как полноценный пользователь через семантический API, но с программируемыми guardrails. Не prompt-injection defense — а архитектурная невозможность превысить полномочия.»

### Техническая реализация

- Скрипт `scripts/investor-demo.mjs` — Node.js ES modules, последовательные fetch-вызовы
- Каждый шаг: описание → запрос → подсвеченный ответ → пауза 2-3 сек
- После каждого акта: WebSocket-событие `{ act: N, status, data }` для синхронизации с презентацией
- Claude Code запускает скрипт — scenario-guided (знает сюжет, но выполняет реальные HTTP-запросы)

---

## Блок 3: HTML-презентация (визуальная витрина)

### Концепция

Одностраничное HTML-приложение, работающее параллельно с демо. Не слайды — динамический экран, реагирующий на происходящее.

### Три режима экрана

| Режим | Когда | Что на экране |
|-------|-------|---------------|
| **Story** | Вступление, переходы | Анимированный заголовок + ключевой claim крупным шрифтом + метрика |
| **Split** | Эксперимент Claude-as-user | Визуализация акта: иконка роли → стрелка действия → результат (зелёный/красный) |
| **Evidence** | Доказательная база | Анимированные счётчики, диаграмма «один артефакт → 4 канала» |

### Экраны (9 штук)

1. **Title** — «IDF — Intent-Driven Frontend» + tagline
2. **Problem** — сколько стоит типичное приложение ($$, месяцы, команды) — анимированные цифры
3. **Solution** — один артефакт, четыре мира (анимированная схема: JSON → pixels/voice/document/API)
4. **Live: адаптеры** — фон для переключения в браузере (названия адаптеров подсвечиваются при переключении)
5. **Experiment intro** — «Claude как пользователь» (позиционирование трёх путей)
6. **Acts 1-7** — динамические карточки актов, появляются по мере выполнения
7. **Evidence** — анимированные счётчики (9 доменов, 531 интент, 458 тестов, 4 адаптера, 4 материализации)
8. **Vision** — «OpenAPI для приложений. SDK на npm. Zero runtime AI cost.»
9. **Ask** — что нужно, куда идём, размер рынка

### Техническая реализация

- `src/presentation/investor-deck.html` — standalone файл
- Vanilla JS + CSS animations (никаких зависимостей)
- Тёмный фон, крупная типографика, accent-цвета
- Управление: стрелки клавиатуры (ручной режим) + WebSocket от demo-скрипта (автоматический)
- Стиль: Apple Keynote — одна мысль на экран, анимация при появлении
- Demo-скрипт после каждого акта: `ws.send(JSON.stringify({ act: N, status }))` → презентация автоматически переключает экран

### Визуализация акта 6 (кульминация)

```
[agent icon] ──── trade $312K ────> [SHIELD]
                                     🛑 403
                                GUARDRAIL BLOCKED
                            "maxAmount exceeded: 312000 > 50000"
```

Красная вспышка, анимация щита, текст причины блокировки.

---

## Доказательная база (цифры для экрана Evidence)

| Метрика | Значение | Что доказывает |
|---------|----------|----------------|
| Доменов | 9 | Универсальность формата |
| Интентов | 531 | Глубина покрытия |
| Тестов | 458, все green | Инженерное качество |
| UI-адаптеров | 4 | Визуальная гибкость |
| Материализаций | 4 | Omnichannel из одного артефакта |
| Smoke-test шагов | 74 | Agent-ready из коробки |
| npm-пакетов | 8 | SDK готов к дистрибуции |
| Runtime AI cost | $0 | LLM только design-time |

---

## Deliverables

1. **Починенные адаптеры** — 4 бага в SDK + прототипе
2. **`scripts/investor-demo.mjs`** — 7 актов, реальные HTTP-запросы, WebSocket-события
3. **`src/presentation/investor-deck.html`** — 9 экранов, анимации, WS-синхронизация
4. **Визуальный аудит** — invest-домен проверен во всех 4 адаптерах

## Не входит в scope

- Подготовка «нефтяного» домена (оставляем invest — ближе к Fonte Capital)
- Production deploy обновления
- Видеозапись / asciinema (делается после, не блокирует)
- Одностраничник для отправки после встречи (отдельная задача)
