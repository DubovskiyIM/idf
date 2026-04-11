# Agent Layer Demo: claude-code как пользователь booking

Демо-руководство для агентского слоя §17 манифеста. Две цели:
- **Smoke-test** — проверка, что API-контракт работает (`scripts/agent-smoke.mjs`).
- **Live demo** — claude-code читает schema, orchestrirует вызовы, выполняет задачу пользователя.

## Предпосылки

1. Сервер запущен: `npm run server`
2. Клиент хотя бы раз подключался к booking-домену: `npm run dev` + открыть `/booking-v2` в браузере. Это нужно, чтобы клиент POST'нул ontology и intents в сервер. После первого POST клиента можно закрыть — сервер держит их в памяти.
3. В БД booking-домена есть хотя бы один specialist, одна услуга и несколько свободных слотов.

## API краткая справка

Все endpoint'ы требуют JWT в `Authorization: Bearer <token>`.

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/agent/booking/schema` | GET | Intents (отфильтрованные по роли agent) + ontology (visible fields) |
| `/api/agent/booking/world` | GET | Folded world с row+field фильтром по ownerField |
| `/api/agent/booking/exec/:intentId` | POST | Sync exec с 200/409/403/400 |

### Коды ошибок

- **400** `parameter_validation` / `build_failed` — неправильные параметры
- **401** `auth_required` — нет JWT
- **403** `intent_not_allowed` — intent не в canExecute для роли
- **404** `intent_not_found` — неизвестный intentId
- **409** `effect_rejected` — condition failed (с `failedCondition` для анализа)
- **503** `ontology_unavailable` — клиент не POST'нул ontology

## Аутентификация

```bash
JWT=$(node scripts/agent-login.mjs)
echo $JWT  # sanity check
```

`agent-login.mjs` идемпотентен — регистрирует при первом запуске, логинит при повторных. Email по умолчанию: `agent-demo@local`.

## Примеры curl-запросов

```bash
# Schema
curl -s -H "Authorization: Bearer $JWT" \
  http://localhost:3001/api/agent/booking/schema | jq

# World
curl -s -H "Authorization: Bearer $JWT" \
  http://localhost:3001/api/agent/booking/world | jq

# Создать бронь (замени id на реальные из /world)
curl -s -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  http://localhost:3001/api/agent/booking/exec/create_booking \
  -d '{"serviceId":"svc_1","specialistId":"spec_a","slotId":"slot_1","price":2000}' | jq
```

## Автоматический smoke-тест

Проверяет 11 шагов: login → seed → schema → world → create → world → conflict 409 → cancel → world → review → 403.

```bash
npm run agent-smoke
```

Exit 0 при успехе, 1 при любом упавшем assert'е.

**Важно:** smoke-тесту нужны seed-данные в БД (specialist, service, slots). Если `/world` пуст — запусти `npm run dev`, открой `/booking-v2`, клиент автоматически загрузит seed через `getSeedEffects`.

## Демо-сценарий для claude-code

Цель: показать, что LLM-агент — равноправный пользователь booking-домена.

### Задачи

1. **Happy path.** «Запиши меня на стрижку у Ани на следующий четверг после обеда.»
2. **Change of mind.** «Перенеси эту запись на пятницу.» (cancel + create или reschedule)
3. **Конфликт-rejection.** Параллельно с task 1 человек (другая вкладка `/booking-v2`) занимает целевой слот. Агент получает 409 `slot.status = 'free'` с `failedCondition.actualValue: "booked"`, должен перечитать `/world` и выбрать другой слот.
4. **Review.** «Оставь отзыв на последнюю завершённую запись: 5 звёзд, "всё понравилось".» (требует completed booking в БД — см. seed-fixture в smoke-test, шаг 2).

### Как запустить claude-code как агента

1. В новой терминал-сессии запусти `claude-code`.
2. Вставь system prompt из `docs/agent-system-prompt.md` в системное сообщение (или приложи как файл).
3. Дай задачу из списка выше.
4. Claude-code сам использует `curl`/`fetch` как tool'ы и orchestrates API-вызовы.

Наблюдай за tool-use цепочкой: схема → world → exec. При 409 — агент должен правильно reason'ить и попробовать другой параметр.

## Чеклист готовности для записи demo-видео

- [ ] `npm run server` запущен, лог чистый
- [ ] `npm run dev` запущен, `/booking-v2` открыт хотя бы раз (ontology загружена)
- [ ] В БД есть seed: Аня + стрижка + 3-5 free slots на следующую неделю
- [ ] `npm run agent-smoke` проходит (11 шагов ✓)
- [ ] Claude-code получил JWT через `agent-login.mjs`
- [ ] Задача №1 выполнена, бронь видна в UI `/booking-v2` (одновременно открыт второй экран браузера)
- [ ] Конфликт-сценарий воспроизводим: человек занимает слот в одной вкладке → агент получает 409 → восстанавливается
- [ ] Агент оставил отзыв через `leave_review` на seed completed-booking

## Known limitations

- **Idempotency отсутствует** — retry одного и того же POST может создать дубликат.
- **JWT без refresh** — через 7 дней нужен повторный login.
- **Synthetic write-ownership не enforced** — агент теоретически может cancel'ить чужую бронь, зная её `bookingId`. Защита пока только через row-filter в `/world` (агент не видит чужие id). Закрытие — отдельный следующий milestone.
- **`ontologyRegistry` in-memory** — при рестарте сервера клиент должен повторно POST'нуть ontology через `/api/typemap?domain=booking`.
