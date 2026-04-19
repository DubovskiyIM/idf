# Freelance — мануальный e2e checklist

8 пунктов, которые мы прошли в сессии 2026-04-19. Каждый — независимый сценарий с шагами, expected effects и точкой проверки.

## Pre-requisites

```bash
# Сервер + dev-server
npm run server      # :3001
npm run dev         # :5173

# 1 раз — создать 5 тест-аккаунтов с id, совпадающими с seed-пользователями
node scripts/freelance-accounts.mjs
```

Аккаунты (пароль у всех `password`):

| Email | id | Роль | Назначение |
|---|---|---|---|
| `alisa@freelance.local` | `u_customer_1` | customer | Основной заказчик (3 seed-задачи) |
| `boris@freelance.local` | `u_customer_2` | customer | Второй заказчик |
| `viktor@freelance.local` | `u_executor_1` | executor | Основной исполнитель JS/React |
| `galya@freelance.local` | `u_executor_2` | executor | Дизайнер |
| `dima@freelance.local` | `u_universal` | universal | Обе роли — тест toolbar-переключателя |

**Точка входа:** `/studio.html?domain=freelance&view=prototype` (через Studio) — `/freelance` (StandaloneApp) freelance не зарегистрирован.

После каждого шага — **hard-reload** страницы, если HMR в браузере оставил inconsistent state ("Internal React error: Expected static flag" — про-форс reload решает).

---

## 1. Создание задачи (customer)

**Кейс.** task_catalog_public виден гостю без create; `my_tasks` для customer'а; create_task_draft → status=draft.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Login как **alisa@freelance.local** | Входим, видим вкладку «Каталог задач», «Мои задачи», «Мои отклики», «Мои сделки», «Кошелёк». Toolbar сверху: «Роль: Заказчик» + «Слой: авто/Mantine/Doodle/Apple/AntD». |
| 2 | Открыть «Мои задачи» → кнопка **«Опубликовать задачу»** в toolbar | Открывается formModal с 7 полями: Заголовок (text), Категория (dropdown 3 опции из seed), Бюджет (number с ₽ префиксом и форматом тысяч), Формат (Удалённо/На месте), Описание (textarea), Срок (datetime с временем, шаг 5 мин), Город (text). |
| 3 | Заполнить «Починить утюг», 5000₽, Разработка, Удалённо, описание любое, срок завтра 18:00, Город Москва → **Создать** | В Φ-логе: `add tasks ● confirmed`. В `my_tasks`-каталоге появляется новая задача со status=draft. |
| 4 | Проверить что в публичном каталоге («Каталог задач») задача **не видна** | Filter `status === 'published'` отсекает draft. |
| 5 | Открыть task_detail_customer (клик по карточке в my_tasks) | Видны все witnesses, в т.ч. status: «draft». Toolbar: edit_task / publish_task / cancel_task_before_deal. Секция «Отклики» пуста. |
| 6 | Клик **«Опубликовать»** (publish_task) | Φ: `replace task.status` value=published. Карточка обновляется. Задача появляется в публичном каталоге у Виктора. |

**Если что-то идёт не так — debug-команды:**
```bash
# Последние 10 rejected effects на create_task_draft:
node -e "const db=require('./server/db.js'); console.table(db.prepare(\"SELECT id,intent_id,status,context FROM effects WHERE intent_id='create_task_draft' ORDER BY created_at DESC LIMIT 10\").all())"

# Re-run invariants на текущем world:
node -e "
const { foldWorld } = require('./server/validator.js');
const { checkInvariants } = require('./server/schema/invariantChecker.cjs');
(async () => {
  const ont = await import('./src/domains/freelance/ontology.js');
  console.log(checkInvariants(foldWorld(), ont.ONTOLOGY));
})();
"
```

---

## 2. Toolbar-переключатели (универсал — Дима)

**Кейс.** Toolbar показывает «Роль: Заказчик / Исполнитель» когда домен объявил `session_set_active_role`. UI-kit переключается без reload.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Login как **dima@freelance.local** | В toolbar: 2 переключателя — «Роль» и «Слой». Активная роль из sessionStorage (по умолчанию customer). |
| 2 | Клик «Исполнитель» | sessionStorage['idf.activeRole.freelance']='executor'. exec(`session_set_active_role`,{role:'executor'}). Φ-эффект proposed → confirmed. |
| 3 | Клик «Doodle» в Слой | `prefs.uiKit='shadcn'` в localStorage. UI перерисовывается с zelёным акцентом + Caveat-шрифтом. |
| 4 | Клик «AntD» | `prefs.uiKit='antd'`. Перерисовка с blue + Segoe. |
| 5 | Reload страницы | Активная роль и UI-kit сохраняются (storage). |

**Проверить:** при HMR-переключении кода может появиться React warning «Expected static flag was missing» — hard-reload (Cmd+Shift+R) лечит.

---

## 3. Отклики (executor)

**Кейс.** submit_response → pending; счётчик инкрементится; edit/withdraw guards; uniqueness; status guard.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Login как **viktor@freelance.local** | «Каталог задач» — видны published задачи **БЕЗ** Виктора-customer'а (universal-pattern). |
| 2 | Открыть task (например «Лендинг на React» — published seed) → секция «Отклики» | Видны существующие отклики (если есть). Inline-форма «Откликнуться»: 3 поля (Цена ₽, Срок дней, Сообщение). |
| 3 | Заполнить 70000, 7, «Сделаю с Next.js» → **+** | Φ: 2 эффекта — `add responses` (status=pending) + `replace task.responsesCount` (+1). |
| 4 | Logout → Login Алиса → Мои задачи → клик задачу | responsesCount = +1, секция «Отклики» содержит запись Виктора. |
| 5 | Logout → Login Виктор обратно → попытка повторно откликнуться на **ту же** задачу | buildCustomEffects guard — silent reject. Форма submit'нулась но эффекта нет. (UX-improvement: добавить toast/error — см. SDK backlog.) |
| 6 | Открыть «Мои отклики» (новая projection) | Виктор видит свои отклики catalog-view: `taskId`, цена, срок, status. |
| 7 | Открыть `task_detail_public` для draft-задачи (не published) | Inline-форма «Откликнуться» **скрыта** (`canAdd` false из-за `task.status = 'published'` condition). |
| 8 | Edit/Withdraw на pending-отклике | Кнопки видны только на своих pending-откликах (per-item conditions). После select_executor — скрыты. |

---

## 4. Кошелёк и пополнение

**Кейс.** wallet detail; top_up form; сумма + cardLastFour валидации; reserved обновляется; ₽-семантика.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Login Алиса → «Кошелёк» | Видим **PriceBlock**: «Баланс: 150 000 ₽» (primary), «В резерве: 0 ₽». Toolbar: «Пополнить баланс». Секция «История операций» (transactions из seed). |
| 2 | Клик «Пополнить баланс» → formModal | 2 поля: Сумма пополнения (number с ₽-префиксом, разделители тысяч, min=1) + Последние 4 цифры (text, maxLength=4, pattern=^\d{4}$). |
| 3 | Ввести `50000`, `1234` → Создать | Φ: `add transactions` (kind=topup, status=posted, note='Card *1234') + `replace wallet.balance: 150000→200000`. |
| 4 | Negative: ввести `-100` или `0` | Submit → buildCustomEffects guard: amount≤0 → null. UI кнопка disabled из-за `min:1`. |
| 5 | Negative: cardLastFour `12` или `12345` | maxLength/minLength блокируют ввод/submit. |
| 6 | Проверить что в `confirm_deal` reserved растёт, а после `accept_result` падает обратно | См. сценарий 6 — escrow happy path. |

---

## 5. Выбор исполнителя (customer)

**Кейс.** select_executor только customer'у; cascade selected/not_chosen; re-select работает; task исчезает из публичного каталога.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Login Алиса → Мои задачи → задача с ≥2 pending-откликами (например seed task_3) | Секция «Отклики» — на каждом pending-отклике видна кнопка «Выбрать» (Confirm_deal там же — но только для status=selected). |
| 2 | Клик «Выбрать» на отклике Виктора | Φ: 2 effects (если 2 sibling responses): `replace response.status` not_chosen × N siblings + `replace response.status` selected (target). **Порядок effects критичен**: сначала демотируем, потом промотируем — иначе invariant `task_has_at_most_one_selected_response` ловит транзитное 2-selected. |
| 3 | После confirm — на не-выбранных откликах кнопки edit/select/withdraw скрыты | `conditions: response.status='pending'` filtering работает. |
| 4 | Клик «Выбрать» на ДРУГОМ отклике (re-select) | Effects: previously-selected демотируется first, новый промотируется. Invariant не падает. |
| 5 | Logout → Login Виктор → «Каталог задач» | Эта задача **исчезла** из публичного каталога (filter добавил `!world.responses.some(r.taskId===item.id && r.status='selected')`). |
| 6 | На selected-отклике Алисы — кнопка «Подтвердить сделку» (per-item action) | Готово к escrow flow (сценарий 6). |

---

## 6. Escrow happy path

**Кейс.** confirm_deal → submit_work_result → accept_result. Wallet balance/reserved корректно. IrreversibleBadge.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Алиса на task_detail → selected response Виктора → «Подтвердить сделку» | Открывается ConfirmDialog (high-irreversibility, type-text-to-confirm). После подтверждения: 4 effects — `add deals` (status=in_progress, `__irr:{point:high, at:now, reason}`) + `add transactions` (escrow-hold) + `replace wallet.balance` (-amount) + `replace wallet.reserved` (+amount). Commission = 10% от amount. |
| 2 | Алиса → «Кошелёк» | balance уменьшился, reserved вырос. |
| 3 | Logout → Login Виктор → «Мои сделки» | Видна новая сделка in_progress (real-time SSE или после reload). Open → deal_detail_executor. |
| 4 | Toolbar Виктора: «Сдать работу» (submit_work_result) | formModal: result (textarea) + links (text). Submit → 2 effects: `replace deal` (result/links/submittedAt) + `replace deal.status` (in_progress→on_review). |
| 5 | Logout → Login Алиса → «Мои сделки» → сделка | Status: on_review. Toolbar: «Принять работу» (accept_result). |
| 6 | Клик «Принять работу» → ConfirmDialog → подтверждение | 5 effects: status→completed + 2× transactions (release amount-commission to executor + commission to platform) + executor.balance += payout + customer.reserved -= amount. |
| 7 | Алиса→ Кошелёк: balance=75000, reserved=0. Виктор→Кошелёк: balance=72500 (если amount был 75000, commission 7500). | |
| 8 | Toolbar Алисы после completed: accept_result/submit_work_result скрыты по conditions (deal.status='on_review'). | Повторное действие невозможно. |

**Известное ограничение SDK:** AntdOverflowMenu игнорирует `condition` — кнопки могут визуально остаться в overflow-меню, но buildCustomEffects guard всё равно блокирует exec. См. SDK backlog 2.6.

---

## 7. Revision flow

**Кейс.** request_revision → revision_requested → submit_revision → on_review. Цикл повторяется.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Виктор submit_work_result → status=on_review | (см. сценарий 6 шаги 3-4). |
| 2 | Алиса open deal → toolbar: «Вернуть на доработку» (request_revision, иконка ↩) | formModal: comment (textarea required). Заполнить «Шрифт мелковат», submit. |
| 3 | Φ: 2 effects — `replace deal` (revisionComment + revisionRequestedAt) + `replace deal.status` (on_review → revision_requested). | |
| 4 | Виктор → deal_detail_executor → видит status=revision_requested + comment в witnesses | Toolbar: «Сдать правки» (submit_revision, 📤). |
| 5 | submit_revision form: result (textarea) + links — обновлённый results, submit → status revision_requested → on_review | |
| 6 | Алиса снова request_revision (cycle 2) | OK, transition `[on_review, revision_requested]` allow'ится много раз. |
| 7 | Алиса accept_result после N итераций | Завершение, escrow release как обычно. |
| 8 | Negative: Алиса попыталась request_revision на in_progress / completed deal | Кнопка скрыта conditions; buildCustomEffects guard если бы как-то прошло. |

---

## 8. Auto-accept rule (timer)

**Кейс.** После submit_work_result через 72h scheduler emit auto_accept_result. Revoke на ручной accept / revision / cancel.

**Pre-condition:** ontology.rules должны быть отправлены на сервер. Это происходит автоматически при `POST /api/typemap` (DomainRuntime + standalone). Проверить:
```bash
node -e "
const { getOntology } = require('./server/ontologyRegistry.cjs');
const ont = getOntology('freelance');
console.log('rules:', ont?.rules?.map(r=>({id:r.id,trigger:r.trigger,after:r.after})));
"
```

| # | Действие | Ожидание |
|---|---|---|
| 1 | Виктор submit_work_result | Φ: основные эффекты + автоматический `add ScheduledTimer` (firesAt=now+72h, fireIntent=auto_accept_result, revokeOn=[accept_result, request_revision, cancel_deal_mutual]). |
| 2 | Проверить таймер: `curl -s http://localhost:3001/api/effects | jq '.[] | select(.intent_id=="schedule_timer") | .context' | tail -3` | timer-объект с firesAt, fireIntent, revokeOnEvents. |
| 3 | **Fast-forward 72h:** `curl -X POST "http://localhost:3001/api/timer/fast-forward?ms=$((73*3600*1000))"` | Response: `{"fired":1, "remaining":0, ...}`. Server fires `auto_accept_result` → buildCustomEffects same path as accept_result → status=completed + release + commission. |
| 4 | Verify Алиса wallet: reserved=0, executor balance вырос. Φ содержит `auto_accept_result ● confirmed` с `causedByTimer:<id>` в context. | |
| 5 | **Revoke test (новый цикл):** заново create→publish→response→select→confirm→submit_work_result. **БЕЗ** fast-forward Алиса click `accept_result` сразу. | Server `evaluateScheduleV2` ловит accept_result в revokeOn → emit `revoke_timer` для активного timer. Φ: `revoke_timer ● confirmed`. После fast-forward: `{"fired":0}` — таймер уже revoked. |
| 6 | **Revoke на revision:** submit_work_result → request_revision (без accept). Timer revoked. submit_revision → **новый** timer (rule.trigger — массив ["submit_work_result", "submit_revision"], OR-семантика). Fast-forward → новый auto-accept срабатывает. |
| 7 | **Revoke на cancel:** submit_work_result → cancel_deal_mutual → timer revoked. fast-forward → 0 fired. |

---

## Тех. checks

```bash
# Все 716 vitest-тестов зелёные
npx vitest run

# Crystallize artefact для конкретной проекции:
node -e "
(async () => {
  const { crystallizeV2 } = await import('@intent-driven/core');
  const dom = await import('./src/domains/freelance/domain.js');
  const arts = crystallizeV2(dom.INTENTS, dom.PROJECTIONS, dom.ONTOLOGY, 'freelance');
  console.log(JSON.stringify(arts.task_detail_customer.slots, null, 2));
})();
"

# Просмотр всех эффектов конкретного intent'а:
node -e "
const db=require('./server/db.js');
console.table(db.prepare(\"SELECT id,status,context FROM effects WHERE intent_id='confirm_deal' ORDER BY created_at DESC LIMIT 20\").all());
"

# Ручная регистрация ontology на server'е (если что-то слетело):
curl -X POST http://localhost:3001/api/typemap?domain=freelance \
  -H 'Content-Type: application/json' \
  -d "$(node -e 'import(\"./src/domains/freelance/ontology.js\").then(m => console.log(JSON.stringify(m.ONTOLOGY)))')"
```

## Common gotchas

1. **«Internal React error: Expected static flag was missing»** — HMR-артефакт после правок V2Shell/DomainRuntime. Cmd+Shift+R лечит.
2. **antd Card warnings про `size="default"` / `bordered`** — deprecated в antd v5, фикс в SDK adapter-antd (см. backlog 2.5). Не блокирует.
3. **`tasks` collection — cross-domain shared.** Если в DB есть lifequest-задачи (status="active"), и freelance запускает чек transition-инвариант — он среагирует. Поэтому 3 freelance-инварианта (`task_status_transition`, `deal_status_transition`, `wallet_reserved_equals_escrow_sum`) переведены в `severity:"warning"`. Это известное ограничение SDK (backlog 1.4).
4. **Параллельная git-сессия в idf/.** Не пушить из этой сессии в общую ветку без согласования. PR в feature-ветке безопасно.
5. **`/freelance` URL не работает** — `standalone.jsx` не имеет freelance в DOMAINS. Заходить через `/studio.html?domain=freelance&view=prototype`.
