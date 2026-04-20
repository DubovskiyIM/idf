# Интеграция SDK P0-backlog в host (idf/) — design

**Дата:** 2026-04-20
**Ветка:** `feat/sdk-p0-integration`
**Контекст:** PR #50 (`idf-sdk`, merged 2026-04-19) закрыл все 10 P0-пунктов из `docs/sdk-improvements-backlog.md`. SDK опубликован: `@intent-driven/core@0.33.0`, `@intent-driven/renderer@0.12.1`, `@intent-driven/adapter-antd@1.3.0` (и три остальных адаптера).
Открытые test-plan чекбоксы PR #50 — «Интеграция с idf/: убрать workaround'ы ... Визуальная проверка invest/freelance».

## Цель

Снять оставшиеся host-workaround'ы во freelance-домене, верифицировать визуально freelance и invest после обновлённого multi-owner + primaryCTA flow. После этого прототип переходит на полностью native SDK-поведение без локальных патчей.

## Состояние host'а перед работой

| Workaround | Где | Статус |
|---|---|---|
| `patchAntdButtonsChildrenAsLabel` | `DomainRuntime.jsx` | ✅ уже удалён параллельным агентом |
| `AntdDateTimeWithTime` | `DomainRuntime.jsx` | ✅ уже удалён |
| `AntdPriceNumber` | `DomainRuntime.jsx` | ✅ уже удалён |
| `AntdTextInputWithValidation` | `DomainRuntime.jsx` | ✅ уже удалён |
| `projection.patterns.disabled:["footer-inline-setter"]` в `deal_detail_customer` | `freelance/projections.js:121` | ⛔ стоит |
| `projection.patterns.disabled:["footer-inline-setter"]` в `deal_detail_executor` | `freelance/projections.js:140` | ⛔ стоит |
| `creates:"Deal"` опущен в `confirm_deal` | `freelance/intents.js:761` | ⛔ workaround |
| `creates:"Transaction"` опущен в `top_up_wallet_by_card` | `freelance/intents.js:626` | ⛔ workaround (но связан не с P0, а с `assignToSlotsDetail::creates !== mainEntity` логикой) |
| `irreversibility:"high"` как UI-трюк на `submit_work_result` | `freelance/intents.js:789` | ⛔ workaround (§3.1 backlog закрыт) |
| `irreversibility:"high"` как UI-трюк на `request_revision` | `freelance/intents.js:859` | ⛔ workaround (§3.1 backlog закрыт) |
| `irreversibility:"high"` на `submit_revision` (без комментария, но та же причина) | `freelance/intents.js:883` | ⛔ workaround (§3.1 backlog закрыт) |

Зависимости в `package.json` свежие: `^0.33.0` core, `^1.3.0` для всех адаптеров.

## Изменения

### 1. Снять `patterns.disabled` для `footer-inline-setter`

**Файл:** `src/domains/freelance/projections.js`
**Места:** `deal_detail_customer` (line 117–121), `deal_detail_executor` (line 140).
**Причина в backlog §4.3:** SDK matcher `footer-inline-setter` теперь отсекает `parameters` с `control ∈ {textarea, file, multiImage}`. Phase-transition intents (`request_revision`, `submit_work_result`) имеют textarea-параметр `comment` / `result` → matcher их больше не подхватывает.
**Удаляем строку** `patterns: { disabled: ["footer-inline-setter"] },` и предшествующий 4-строчный комментарий в обеих проекциях.

### 2. Проверка возврата `creates:"Deal"` в `confirm_deal`

**Файл:** `src/domains/freelance/intents.js`, line 752–763.
**Текущий комментарий (line 761–763):** «creates:"Deal" опущен — иначе my_deals-catalog добавил бы heroCreate-форму с 6 required-params».
**Hypothesis:** backlog §4.1 (inferParameters читает `particles.parameters`) + §4.2 (heroCreate matcher нормализует confirmation) должны были убрать этот edge-case. Корректный flow: confirm_deal имеет `irreversibility:"high"` → попадает в `confirmDialog`, а не heroCreate, независимо от `creates`.
**Стратегия:** вернуть `creates:"Deal"`, прогнать `npm test`, проверить в браузере `/app/freelance/my-deals` — нет ли нежелательной heroCreate-формы.
**Fallback (если регрессия):** оставить `creates` опущенным, обновить комментарий со ссылкой на PR #50 и указанием оставшейся open edge-case, добавить задачу в sdk-backlog.

### 3. Проверка возврата `creates:"Transaction"` в `top_up_wallet_by_card`

**Файл:** `src/domains/freelance/intents.js`, line 609–629.
**Текущий комментарий (line 626–629):** «creates опущен осознанно: ... SDK `assignToSlotsDetail` (line 100: creates !== mainEntity) отсечёт intent от Wallet.toolbar».
**Природа workaround'а:** это **не P0 backlog issue**, а структурное поведение `assignToSlotsDetail` — intent с `creates: X` где X ≠ mainEntity не кладётся в detail.toolbar. Top-up реально создаёт и `Transaction` (audit trail) и мутирует `Wallet`. Архитектурно чистое решение требует design'а «composite creates» или явного `appliesToMainEntity`, чего в PR #50 нет.
**Стратегия:** НЕ трогаем в этом PR. Обновляем комментарий: ссылка на SDK design-item «composite effects / multi-entity creates» как open question, закрываем в следующей итерации SDK backlog'а.

### 4. Визуальная проверка

После изменений 1 и 2 запустить `npm run server` + `npm run dev` и вручную проверить:

| Проекция | Флоу | Что проверить |
|---|---|---|
| `freelance.deal_detail_customer` | customer: accept_result / request_revision / cancel | все три кнопки в toolbar (не в footer), textarea-overlay корректно рендерит |
| `freelance.deal_detail_executor` | executor: submit_work_result / submit_revision / cancel | то же с executor-ролью; multi-owner ownership правильно фильтрует |
| `freelance.task_detail_customer` | customer: confirm_deal per-item на Response | confirm_deal остаётся per-item на отклике (не heroCreate на my_deals) |
| `freelance.my_deals` | customer: список сделок | нет heroCreate-формы сверху (если её вдруг вставит — rollback изменения 2) |
| `freelance.wallet` | top_up_wallet_by_card | кнопка пополнения в toolbar, price-prefix ₽, 4-digit cardLastFour валидация работают |
| `invest.*` (любая detail) | invest role | multi-owner + preapproval сохранились корректно |

## Риски и митигация

- **R1: возврат `creates:"Deal"` триггерит heroCreate.** Митигация: тестируем изолированно, rollback к опущенному `creates` с обновлённым комментарием.
- **R2: снятие `patterns.disabled:["footer-inline-setter"]` возвращает старый баг** (phase-transition в footer вместо toolbar). Митигация: SDK PR #50 §4.3 явно добавил `parameters.every(p => p.control не в textarea/file/multiImage)` — должен блокировать. Проверяем в браузере; при регрессии — возврат disabled с комментарием про persisting edge-case.
- **R3: параллельный агент коммитит в main во время работы.** Митигация: работаем в `.worktrees/sdk-p0-integration`, перед merge — rebase на `main`.

## Deliverable

Один PR в `idf`: `feat/sdk-p0-integration` с 1-2 коммитами (снятие workaround'ов + обновления комментариев). PR body ссылается на idf-sdk PR #50 и закрывает его host-integration check-box.

## Не в scope

- Новые SDK-фиксы (P1 / P2 backlog остались)
- `top_up_wallet_by_card.creates:"Transaction"` (§3 выше — open architectural item)
- SDK `AuthGate` primitive (backlog §3.5 — P2, отдельная задача)
- UX Pattern Bank promotion profi/avito-кандидатов (sub-project B из декомпозиции, отдельный spec)
- Format v2.2 additions (`costHint`, multi-dim aggregate) — sub-project C, отдельный цикл
