# Freelance — Manual Smoke Test

End-to-end сценарий проверки escrow-контура. Запускать после любых изменений в доменных файлах.

## Подготовка

```bash
cd .superpowers.worktrees/freelance
npm run server    # terminal 1 — :3001
npm run dev       # terminal 2 — :5173
```

Открыть http://localhost:5173/freelance в двух приватных окнах браузера (A и B). Окно A войдёт как customer, окно B — как executor. Seed содержит подходящих пользователей (смотри `src/domains/freelance/seed.js`).

## Сценарий (happy path, 7 шагов)

### 1. Customer A публикует задачу

1. В A: войти как customer_a@mail.ru
2. Вкладка «Мои задачи» → кнопка «Создать задачу»
3. Заполнить: title=«Тест-задача escrow», description=«smoke», categoryId=dev, budget=10000, deadline=+7 дней, type=remote, city=Москва
4. Submit → задача появляется в статусе draft
5. Открыть задачу → toolbar → `publish_task` → status=published
6. **Verify:** в публичном каталоге (вкладка «Задачи») задача видна

### 2. Executor B откликается

1. В B: войти как executor_b@mail.ru
2. Вкладка «Задачи» → найти «Тест-задача escrow» → клик
3. В subCollection «Отклики» → «Добавить»: price=9000, deliveryDays=3, message=«Возьмусь»
4. **Verify:** в «Мои задачи» окна A счётчик откликов увеличился; в B отклик в статусе pending

### 3. Customer A пополняет кошелёк

1. В A: вкладка «Кошелёк»
2. Toolbar → `top_up_wallet_by_card`, amount=20000, cardLastFour=1234
3. **Verify:** Wallet.balance вырос на 20000; в subCollection «История операций» появился Transaction(kind=topup, amount=20000, status=posted)

### 4. Customer A выбирает исполнителя

1. В A: открыть «Тест-задача escrow» (my_tasks или task_detail_customer)
2. В subCollection «Отклики» → действие `select_executor`: id=<отклик B>, taskId=<задача>
3. **Verify:** отклик B status=selected; остальные отклики → not_chosen

### 5. Customer A подтверждает сделку (escrow hold)

1. В A: toolbar → `confirm_deal` с параметрами executorId=<id B>, taskId=<>, responseId=<>, amount=9000, deadline=+7 дней
2. **Verify:**
   - В «Мои сделки» появилась новая сделка status=in_progress, amount=9000, commission=900 (10%)
   - Wallet.balance = 11000 (20000 − 9000)
   - Wallet.reserved = 9000 (0 + 9000)
   - В «История операций»: Transaction(kind=escrow-hold, status=posted, amount=9000)

### 6. Executor B сдаёт работу

1. В B: вкладка «Мои сделки» → открыть сделку
2. Toolbar → `submit_work_result`: result=«готово», links=«https://example.com/out»
3. **Verify:** deal.status=on_review (в обоих окнах)

### 7. Customer A принимает результат (escrow release)

1. В A: «Мои сделки» → deal → toolbar → `accept_result`
2. **Verify:**
   - Deal.status=completed
   - Executor B wallet.balance = 8100 (9000 − 900 комиссия 10%)
   - Customer A wallet.reserved = 0 (9000 − 9000)
   - 2 новых Transaction: release (8100 → w_exe), commission (900 → w_cust)

### 8. Обе стороны оставляют отзывы

1. В A: на deal → `leave_review`: dealId=<>, targetUserId=<id B>, role=customer, rating=5, comment=«супер»
2. В B: на том же deal → `leave_review`: dealId=<>, targetUserId=<id A>, role=executor, rating=5, comment=«быстро платит»
3. **Verify:** Review создан; ExecutorProfile.rating пересчитан через rule `recalc_rating` (weightedAvg с halfLife 180d)

## Отрицательные сценарии (должны отклоняться)

- `leave_review` на deal со status=in_progress → rejected (domain.js guard возвращает null)
- `leave_review` от user, который не customerId и не executorId сделки → rejected
- `confirm_deal` с amount больше баланса customer'а → rejected (buildCustomEffects возвращает null; UI показывает ошибку, balance не меняется)
- `accept_result` на deal со status=completed / cancelled → rejected

## Результат smoke

Если все 8 положительных шагов и 4 отрицательных проходят без ошибок в консоли браузера и без необработанных исключений на сервере — freelance в working state.

## Известные ограничения (не тестируем)

- Real Stripe integration (используется mock top-up — сразу зачисляет)
- Admin-dispute (только mutual cancel)
- Chat между customer/executor
- KYC, verified badges
- Canvas для analytics
- Agent-preapproval
- Role.scope для Deal по executorId (executor видит свои deals через server-side filterWorldForRole fallback по executorId)
