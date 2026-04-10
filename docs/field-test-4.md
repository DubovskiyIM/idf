# Intent-Driven Frontend — Полевой тест 0.3.1

## Проверка парадигмы на домене с временем, границей и черновиками

## Домен: платформа записи к специалистам

Сервис онлайн-записи к специалистам (парикмахер, врач, репетитор): каталог специалистов и услуг, просмотр расписания, выбор слота, бронирование с удержанием, подтверждение, отмена, перенос, повторная запись, отзывы. Специалист управляет услугами, блокирует слоты, обрабатывает записи. Расписание синхронизируется с внешним календарём (Google Calendar).

**Почему этот домен.** Он находится на стыке транзакционного и темпорального: запись — это транзакция (подтверждение, отмена, деньги), но привязанная ко времени (слоты, расписание, длительность, часовые пояса). Интернет-магазин (тест 3) проверил ядро в чистом транзакционном домене. Календарь (тест 2) нашёл блокеры в темпоральном. Бронирование — стресс-тест на стыке: обязано работать как транзакция и обязано работать со временем.

Дополнительно этот домен даёт естественные кейсы для четырёх непроверенных концептов прототипа:
- **Δ (черновики):** выбор услуги и слота до подтверждения — черновик бронирования
- **TTL (истекающие эффекты):** удержание слота на 10 минут — эффект с TTL
- **Граница:** расписание специалиста из Google Calendar — зеркальная сущность
- **Время:** слоты, длительности, рабочие часы — время как онтологический примитив

## Онтология

**Сущности:**

`Specialist` — гибридная сущность. Внутренние поля: имя, описание, рейтинг (вычисляемый из отзывов). Зеркальные поля: расписание (авторитет — Google Calendar). Поля: id, name, specialization, rating, calendarId.

`Service` — внутренняя сущность. Поля: id, specialistId, name, duration, price, active. Предикат: `service.active = true` для применимости записи.

`TimeSlot` — зеркальная сущность, авторитет снаружи (Google Calendar). Поля: id, specialistId, date, startTime, endTime, status {free, held, booked, blocked}. Материализация: стоячий запрос по предикату `slot.specialistId = X AND slot.date BETWEEN today AND today+30`.

`Booking` — внутренняя сущность. Поля: id, clientId, specialistId, serviceId, slotId, status {draft, confirmed, completed, cancelled, no_show}, price, createdAt. Жизненный цикл: draft → confirmed → completed | cancelled | no_show.

`Review` — внутренняя сущность. Поля: id, clientId, specialistId, bookingId, rating, text, response, createdAt. Условие создания: booking.status = 'completed'.

`Client` — внутренняя сущность. Поля: id, name, phone, email.

**Предикаты:**
- `slot_is_free(slot)` ≡ `slot.status = 'free'`
- `booking_is_active(booking)` ≡ `booking.status IN ('draft', 'confirmed')`
- `booking_is_completed(booking)` ≡ `booking.status = 'completed'`
- `service_has_no_active_bookings(service)` ≡ `¬∃ booking: booking.serviceId = service.id ∧ booking_is_active(booking)`

**Правила импликации:**
- Завершение записи → специалист может быть оценён
- Активная запись на услугу → услуга не может быть удалена
- Блокировка слота → все удержания на этот слот отвергаются

## 22 намерения

### Клиентские (10)

**1. select_service — Выбрать услугу**
```
I = ⟨E, C, F, W, P⟩
E: service: Service, specialist: Specialist
C: [service.active = true]
F: [{ α: add, target: drafts, σ: session }]                    — эффект в Δ
W: [service.name, service.duration, service.price, specialist.name, specialist.rating]
P: click
```
Начало черновика бронирования. Эффект идёт в черновой поток Δ, не в Φ. Пользователь выбрал услугу, но ещё не обязался.

**2. select_slot — Выбрать временной слот**
```
E: slot: TimeSlot, draft: Booking(draft)
C: [slot_is_free(slot), draft.serviceId != null]
F: [{ α: replace, target: slot.status, value: 'held', σ: shared, ttl: 600000 },
    { α: replace, target: draft.slotId, σ: session }]
W: [slot.date, slot.startTime, service.duration, specialist.name]
P: click
```
Критическое намерение: создаёт **истекающий эффект** (TTL: 10 минут). Удержание слота — это `replace` на зеркальной сущности с `σ: shared` (другие клиенты видят слот как занятый). По истечении TTL эффект автоматически переходит в `Φ_rejected`, слот возвращается в `free`.

Пересечение концептов: TTL (из теста 3, E3) + граница (зеркальная сущность) + черновик (draft ещё не закоммичен).

**3. confirm_booking — Подтвердить запись**
```
E: draft: Booking(draft)
C: [draft.slotId != null, draft.serviceId != null, slot_is_free(slot) OR slot.status = 'held']
F: [{ α: replace, target: draft.status, value: 'confirmed', σ: account },
    { α: replace, target: slot.status, value: 'booked', σ: shared }]
W: [service.name, service.price, slot.date, slot.startTime, specialist.name]
P: click
```
Главный коммит. Промотирует черновик из Δ в Φ. Слот переходит из `held` в `booked` (бессрочно — TTL удержания заменяется постоянным эффектом). Сигналы: `booking_confirmed` (email/SMS клиенту), `booking_reminder` (запланированный, за N часов до приёма).

Этот момент — точка невозврата для удержания: TTL-эффект заменяется постоянным. Причинная цепочка: select_slot (held, ttl) → confirm_booking (booked, permanent).

**4. cancel_booking — Отменить запись**
```
E: booking: Booking
C: [booking.status = 'confirmed']
F: [{ α: replace, target: booking.status, value: 'cancelled', σ: account },
    { α: replace, target: slot.status, value: 'free', σ: shared }]
W: [booking.service.name, booking.slot.date, booking.slot.startTime]
P: click (+ подтверждение для записей < 24ч)
```
Антагонист `confirm_booking`: отменяет запись, освобождает слот. Пропорциональность подтверждения: отмена за сутки — click, отмена за 2 часа — подтверждение с предупреждением о штрафе.

**5. reschedule_booking — Перенести запись**
```
E: booking: Booking, new_slot: TimeSlot
C: [booking.status = 'confirmed', slot_is_free(new_slot)]
F: [{ α: replace, target: booking.slotId, value: new_slot.id, σ: account },
    { α: replace, target: old_slot.status, value: 'free', σ: shared },
    { α: replace, target: new_slot.status, value: 'booked', σ: shared }]
W: [booking.service.name, old_slot.date, new_slot.date, new_slot.startTime]
P: click
phase: investigation (выбор нового слота) + commitment (подтверждение переноса)
```
Многофазное намерение. Фаза исследования: пользователь видит расписание, выбирает новый слот — `Overlay(I)` показывает предварительный результат. Фаза коммитмента: старый слот освобождается, новый бронируется. Три эффекта на две сущности — атомарно.

**6. repeat_booking — Повторить запись**
```
E: past_booking: Booking
C: [past_booking.status IN ('completed', 'cancelled')]
F: [{ α: add, target: drafts, σ: session }]                    — новый черновик из шаблона
W: [past_booking.service.name, past_booking.specialist.name]
P: click
creates: Booking (из шаблона прошлой записи)
```
Создаёт новый черновик с предзаполненными полями из прошлой записи. Пользователь попадает в поток select_slot → confirm_booking. Последовательная связь: `repeat_booking ▷ select_slot ▷ confirm_booking`.

**7. abandon_draft — Отменить черновик**
```
E: draft: Booking(draft)
C: [draft.status = 'draft']
F: [{ α: remove, target: drafts, σ: session },
    { α: replace, target: slot.status, value: 'free', σ: shared }]      — если слот был held
W: [draft.service.name]
P: click
```
Удаление черновика из Δ. Если слот был удержан — освобождается. Это антагонист всего потока select_service → select_slot: возврат к исходному состоянию.

**8. leave_review — Оставить отзыв**
```
E: booking: Booking, specialist: Specialist
C: [booking_is_completed(booking)]
F: [{ α: add, target: reviews, σ: account }]
W: [specialist.name, booking.service.name, booking.slot.date]
P: click
creates: Review
```
Последовательная связь: `complete_booking ▷ leave_review`. Условие применимости делает review невозможным до завершения приёма. Сигнал при коммите: `review_posted` (уведомление специалисту).

**9. edit_review — Редактировать отзыв**
```
E: review: Review
C: []
F: [{ α: replace, target: review.rating, σ: account },
    { α: replace, target: review.text, σ: account }]
W: [review.text (текущий), review.rating (текущий)]
P: click
phase: investigation
```

**10. delete_review — Удалить отзыв**
```
E: review: Review
C: []
F: [{ α: remove, target: reviews, σ: account }]
W: [review.text]
P: click (подтверждение)
irreversibility: medium
```

### Специалист/админ (9)

**11. block_slot — Заблокировать слот**
```
E: slot: TimeSlot
C: [slot_is_free(slot)]
F: [{ α: replace, target: slot.status, value: 'blocked', σ: shared }]
W: [slot.date, slot.startTime]
P: click
```

**12. unblock_slot — Разблокировать слот**
```
E: slot: TimeSlot
C: [slot.status = 'blocked']
F: [{ α: replace, target: slot.status, value: 'free', σ: shared }]
W: [slot.date, slot.startTime]
P: click
antagonist: block_slot                                    — ⇌ антагонист
```

**13. cancel_client_booking — Отменить запись клиента**
```
E: booking: Booking
C: [booking.status = 'confirmed']
F: [{ α: replace, target: booking.status, value: 'cancelled', σ: account },
    { α: replace, target: slot.status, value: 'free', σ: shared }]
W: [booking.client.name, booking.service.name, booking.slot.date]
P: click (подтверждение + причина)
irreversibility: high
```
Сигнал: `booking_cancelled` (уведомление клиенту с причиной). Необратимость `high` — клиент получает уведомление, отменить отмену нельзя.

**14. complete_booking — Отметить приём завершённым**
```
E: booking: Booking
C: [booking.status = 'confirmed', booking.slot.endTime <= now]
F: [{ α: replace, target: booking.status, value: 'completed', σ: account }]
W: [booking.client.name, booking.service.name]
P: click
```
Условие: приём может быть завершён только после окончания слота. `now` в условии — пример времени как онтологического примитива (расширение из р.22): множество применимых намерений меняется с течением времени без единого эффекта.

**15. mark_no_show — Отметить неявку**
```
E: booking: Booking
C: [booking.status = 'confirmed', booking.slot.endTime <= now]
F: [{ α: replace, target: booking.status, value: 'no_show', σ: account }]
W: [booking.client.name, booking.service.name, booking.slot.date]
P: click
```
Исключающая связь с `complete_booking`: `complete_booking ⊕ mark_no_show` — нельзя и завершить, и отметить неявку. Оба имеют одинаковое условие, но взаимоисключающие эффекты. Алгебра: `replace` на один и тот же target с разными value = конфликт.

**16. add_service — Добавить услугу**
```
E: service: Service
C: []
F: [{ α: add, target: services, σ: account }]
W: [specialist.services.count]
P: click
creates: Service
```

**17. update_service — Изменить услугу**
```
E: service: Service
C: []
F: [{ α: replace, target: service.price, σ: account },
    { α: replace, target: service.duration, σ: account }]
W: [service.name, service.price (текущая), service.duration (текущая)]
P: click
phase: investigation
```

**18. remove_service — Убрать услугу**
```
E: service: Service
C: [service_has_no_active_bookings(service)]
F: [{ α: replace, target: service.active, value: false, σ: account }]
W: [service.name, active_bookings.count]
P: click (подтверждение)
```
Не `remove`, а `replace active → false` (мягкое удаление). Условие проверяет отсутствие активных записей. Если есть — намерение неприменимо, свидетельство показывает количество записей.

**19. respond_to_review — Ответить на отзыв**
```
E: review: Review
C: [review.response = null]
F: [{ α: replace, target: review.response, σ: account }]
W: [review.text, review.rating, review.client.name]
P: click
```

### Граничные (2)

**20. sync_calendar — Синхронизировать расписание**
```
E: specialist: Specialist
C: [specialist.calendarId != null]
F: [{ α: replace, target: specialist.slots, σ: shared }]      — чужие эффекты
W: [specialist.name, last_sync_time]
P: auto (периодически) | click (ручной запуск)
```
Граничная операция. Входящие данные из Google Calendar входят в Φ как `confirmed` с маркером `foreign:google_calendar`. TimeSlot — зеркальная сущность: авторитет снаружи. Декларация границы:
- **Авторитет:** внешний (Google Calendar всегда прав)
- **Материализация:** стоячий запрос на ближайшие 30 дней
- **Распространение:** pull (периодическая синхронизация)
- **Входящий канал:** Google Calendar API
- **Разрешение конфликтов:** внешний побеждает

**21. handle_external_cancel — Обработать внешнюю отмену**
```
E: slot: TimeSlot
C: [slot.status = 'booked' OR slot.status = 'held']
F: [{ α: replace, target: slot.status, value: 'blocked', σ: shared },
    { α: replace, target: booking.status, value: 'cancelled', σ: account }]    — каскад
W: [slot.date, slot.startTime, booking.client.name]
P: auto (реакция на чужой эффект)
```
Шумный дрейф: специалист заблокировал время в Google Calendar, а на этот слот уже есть запись. Система обнаруживает расхождение, **не адаптируется молча**, а останавливается и показывает конфликт. Специалист принимает решение: отменить запись клиента (с уведомлением) или разблокировать слот в календаре.

### Расширенные (1)

**22. bulk_cancel_day — Отменить все записи на день**
```
I_ext = ⟨
  template: cancel_client_booking,
  collection: bookings WHERE booking.specialist = self AND booking.slot.date = target_date AND booking.status = 'confirmed',
  summary_witnesses: [target_date, bookings.count, affected_clients],
  bulk_confirmation: click + причина,
  partial_success_policy: allow,
  progress_semantics: per_item
⟩
```
Специалист заболел — отменяет все записи на день. Расширенное намерение: шаблон `cancel_client_booking` над коллекцией дневных записей. Политика `allow`: если одна отмена не прошла (например, запись уже была отменена клиентом) — остальные проходят. Прогресс как свидетельство: «Отменено 4/7 записей...»

Каждая внутренняя отмена порождает сигнал `booking_cancelled` клиенту. Массовая отмена → массовые уведомления.

---

## 4 проекции

**specialist_catalog** `V = ⟨E, Q, W⟩`
```
E: Specialist, Service
Q: все активные специалисты с их услугами, фильтрация по специализации/рейтингу
W: [name, specialization, rating, services.count, nearest_free_slot]
```
`nearest_free_slot` — вычисляемое свидетельство, зависящее от зеркальных TimeSlot. Композиция: `specialist_catalog ∘ filter_by_specialization ∘ sort_by_rating`.

**specialist_schedule** `V = ⟨E, Q, W⟩`
```
E: TimeSlot, Booking, Service
Q: слоты специалиста на выбранную неделю, со статусами
W: [date, startTime, endTime, status, booking.client.name (если booked)]
```
Зависимость от зрителя: клиент видит только free/booked (без имён), специалист видит всё включая имена клиентов. Это подтверждает концепт из раздела 5 манифеста: одна проекция, разное содержимое для разных зрителей.

**my_bookings** `V = ⟨E, Q, W⟩`
```
E: Booking, Service, Specialist, TimeSlot
Q: все записи текущего клиента, сортировка: будущие↑ прошлые↓
W: [specialist.name, service.name, slot.date, slot.startTime, status]
```
Контекст для намерений: на каждой записи доступны `cancel_booking` (если confirmed), `reschedule_booking` (если confirmed), `repeat_booking` (если completed/cancelled), `leave_review` (если completed и нет отзыва).

**specialist_dashboard** `V = ⟨E, Q, W⟩`
```
E: Booking, Review, Service
Q: агрегированная статистика специалиста
W: [today_bookings.count, week_bookings.count, avg_rating, recent_reviews, no_show_rate]
```

---

## 4 сигнала

**booking_confirmed** `s = ⟨κ, σ, ρ, ε, δ⟩`
```
κ: notification
σ: client (email/SMS)
ρ: confirm_booking
ε: confirm_booking
δ: at-least-once
```
Испускается при коммите `confirm_booking`. Содержит: специалист, услуга, дата, время, адрес.

**booking_cancelled** `s = ⟨κ, σ, ρ, ε, δ⟩`
```
κ: notification
σ: client (email/SMS)
ρ: cancel_booking | cancel_client_booking
ε: cancel_booking | cancel_client_booking
δ: at-least-once
```
Испускается при любой отмене. Если отменяет специалист — содержит причину.

**booking_reminder** `s = ⟨κ, σ, ρ, ε, δ⟩`
```
κ: notification
σ: client (push/SMS)
ρ: confirm_booking
ε: confirm_booking
δ: at-most-once
trigger: slot.startTime - reminder_offset (запланированный, времятриггерный)
```
**Запланированный сигнал** (расширение из раздела 22). Испускается не при коммите, а при наступлении времени: за 24 часа и за 2 часа до приёма. При переносе (`reschedule_booking`) — перепланируется. При отмене — отменяется. Требует темпоральной планирующей подсистемы.

**review_posted** `s = ⟨κ, σ, ρ, ε, δ⟩`
```
κ: notification
σ: specialist (push/email)
ρ: leave_review
ε: leave_review
δ: fire-and-forget
```

---

## Что работает с ходу

**Черновики (Δ) — подтверждение на свежем домене.** Поток select_service → select_slot → confirm_booking естественно ложится на модель Δ. Черновик живёт в сессии, промотируется при confirm. Это третье подтверждение концепта (после корзины из теста 3 и черновика формы). Δ можно считать стабильным.

**TTL — подтверждение на свежем домене.** Удержание слота на 10 минут — чистый TTL-эффект. Истечение → слот возвращается в `free` → черновик инвалидируется. Причинная история каскадирует корректно: если TTL-эффект `held` отвергнут по истечении → зависимый `draft.slotId` подозрителен. Это второе подтверждение (после резервирования инвентаря из теста 3). TTL можно считать стабильным.

**Антагонисты.** `block_slot ⇌ unblock_slot`, `confirm_booking ↔ cancel_booking`. Автовывод корректен.

**Многофазность.** `reschedule_booking` — чистый двухфазный: исследование (выбор слота с Overlay) + коммит (перенос). Работает как описано.

**Алгебра связей.** Последовательные: `select_service ▷ select_slot ▷ confirm_booking ▷ complete_booking ▷ leave_review`. Исключающие: `complete_booking ⊕ mark_no_show`. Антагонистические: `block ⇌ unblock`. Все выводятся из частиц.

**Расширенные намерения.** `bulk_cancel_day` — шаблон + коллекция + partial_success. Работает как в тесте 3 (массовая обработка возвратов).

**Проекции.** Все четыре проекции ложатся чисто: реактивны (пересчитываются при изменении Φ), композируемы (фильтры, сортировки), с контекстом для намерений.

---

## Находки

### B1 (🟡 значительная). Время как условие применимости.

`complete_booking` и `mark_no_show` имеют условие `booking.slot.endTime <= now`. Это условие, зависящее от текущего времени, а не от состояния мира. Множество применимых намерений меняется каждую секунду — без единого эффекта в Φ.

Это повторяет находку C6 из теста 2 (время как онтологический примитив). Но здесь яснее: `now` — это не поле сущности, а **темпоральный предикат**. Условия бывают двух типов:
- **Статические:** зависят от `World(t)`, меняются при эффектах
- **Темпоральные:** зависят от `now`, меняются непрерывно

Парадигма пока не различает эти типы. Для прототипа достаточно периодического пересчёта, но для зрелой реализации нужен механизм темпоральной реактивности: система знает, *когда* условие станет истинным, и планирует пересчёт.

Третий домен с этой находкой (тест 2: календарь, тест 3: промо-цены с дедлайном, этот тест: завершение приёма). **Рекомендация: включить в стабильную часть манифеста как признанную подсистему.**

### B2 (🟡 значительная). TTL-эффект заменяется постоянным.

В `select_slot` слот получает `held` с TTL 10 мин. В `confirm_booking` тот же слот получает `booked` без TTL. Что происходит с TTL-эффектом? Он должен быть **заменён**: `confirm_booking` создаёт новый эффект `replace slot.status = 'booked'` без TTL, который причинно зависит от `held`-эффекта (`parent_id`). Истекающий эффект перестаёт быть актуальным, потому что его значение перезаписано более поздним.

Но алгебра должна это обеспечить корректно: два `replace` на одну ячейку — побеждает причинно-поздний (по таблице из раздела 11). Если TTL истёк *после* подтверждения — ничего не должно произойти, потому что TTL-эффект уже неактуален. Причинный порядок: `held(ttl) ≺ booked(permanent)`, поэтому `booked` побеждает.

Это не баг, а подтверждение: алгебра и причинность работают вместе, и TTL-замена — их естественное следствие. Но это стоит явно прописать в манифесте как паттерн «промоция временного в постоянное».

### B3 (🟡 значительная). Шумный дрейф как рабочий процесс.

`handle_external_cancel` — не одно намерение, а микро-рабочий процесс:
1. Синхронизация обнаруживает расхождение (слот заблокирован, но есть запись)
2. Система останавливается (шумный дрейф)
3. Специалист видит конфликт и принимает решение
4. Решение — это отдельное намерение (`cancel_client_booking` или ручное разблокирование в Calendar)

Шумный дрейф порождает не автоматическое действие, а **контекст для решения автора**. Это подтверждает принцип из раздела 19: молчаливая адаптация запрещена. Но также показывает, что дрейф — это не точечное событие, а процесс с участием человека. Связано с расширением «рабочие процессы» (раздел 22).

### B4 (🟡 значительная). Зависимость проекций от зрителя — практическое подтверждение.

`specialist_schedule` показывает разное содержимое клиенту (free/booked) и специалисту (+ имена клиентов). Это первый полевой тест, где зависимость от зрителя не теоретическая, а практически необходимая: без неё клиент видит персональные данные чужих клиентов.

Проекция `V(slot, viewer)`:
- `viewer = client` → `W: [date, startTime, status ∈ {free, unavailable}]`
- `viewer = specialist` → `W: [date, startTime, status, booking.client.name, booking.service.name]`

Правила доступа на сущности Booking: поле `client.name` видно только `booking.specialist` и самому `booking.client`. Механизм — как описан в разделе 5 манифеста. Третий домен с этой находкой (тест 2: free/busy скрывает заголовки, этот тест: скрывает имена). **Рекомендация: включить в стабильную часть.**

### B5 (🟢 минорная). Запланированные сигналы — третье подтверждение.

`booking_reminder` — запланированный сигнал, не испускаемый при коммите. Третий домен (тест 2: напоминания о событиях, тест 3: восстановление брошенной корзины, этот тест: напоминание о приёме). Концепт стабилен. **Рекомендация: включить в стабильную часть.**

### B6 (🟢 минорная). Устаревание свидетельств в черновиках — подтверждение.

Если клиент выбрал слот, но не подтвердил в течение часа — цена услуги могла измениться (специалист обновил). При возврате к черновику система должна пересчитать свидетельства и показать дифф. Повторяет E4 из теста 3.

---

## Сводка находок

| # | Находка | Уровень | Тесты |
|---|---|---|---|
| B1 | Время как условие применимости (темпоральные предикаты) | 🟡 | 2, 3, 4 → **стабилизировать** |
| B2 | Промоция TTL-эффекта в постоянный (алгебра + причинность) | 🟡 | 3, 4 |
| B3 | Шумный дрейф как рабочий процесс | 🟡 | 4 (новое) |
| B4 | Зависимость проекций от зрителя — практическое подтверждение | 🟡 | 2, 4 → **стабилизировать** |
| B5 | Запланированные сигналы — третье подтверждение | 🟢 | 2, 3, 4 → **стабилизировать** |
| B6 | Устаревание свидетельств в черновиках | 🟢 | 3, 4 |

Ноль блокеров. Четыре значительных. Две минорных.

---

## Что было подтверждено

- **Черновики Δ** — третий домен (тест 3: корзина, этот тест: черновик бронирования). Стабилен.
- **TTL** — второй домен (тест 3: инвентарь, этот тест: удержание слота). Стабилен.
- **Граница** — зеркальные сущности работают (TimeSlot из Google Calendar), шумный дрейф работает.
- **Расширенные намерения** — второй домен (тест 3: массовый заказ, этот тест: массовая отмена). Стабильны.
- **Алгебра** — replace на одну ячейку с причинным порядком корректно обрабатывает TTL-замену.
- **Причинная история** — цепочка select_slot → confirm_booking → complete_booking → leave_review каскадирует корректно.

---

## Рекомендации для манифеста v0.4

По результатам четырёх тестов, три расширения прошли порог трёх доменов и рекомендуются к включению в стабильную часть:

1. **Запланированные сигналы** (тесты 2, 3, 4) — сигнал, испускаемый по наступлению времени, а не при коммите. Перепланирование при смещении якоря, отмена при удалении.

2. **Время как онтологический примитив / темпоральные предикаты** (тесты 2, 3, 4) — условия, зависящие от `now`. Различение статических и темпоральных предикатов. Темпоральная реактивность.

3. **Зависимость проекций от зрителя** (тесты 2, 4) — разное содержимое для разных зрителей. Правила доступа на сущностях. (Два теста, но оба убедительны и концепт уже в манифесте как свойство проекций.)

---

## Траектория блокеров по четырём тестам

| Тест | Домен | 🔴 Блокеры | 🟡 Значит. | 🟢 Минорн. |
|---|---|---|---|---|
| 0.2 | Очередь чтения | 4 | 5 | 1 |
| 0.2.1 | Календарь | 4 | 4 | 1 |
| 0.2.2 | Интернет-магазин | 2 | 4 | 0 |
| 0.3.1 | Бронирование | 0 | 4 | 2 |

Блокеры: 4 → 4 → 2 → 0. Четвёртый тест не обнаружил ни одного блокера. Все находки — уточнения существующих концептов или подтверждения расширений. Конвергенция продолжается.

---

## Вердикт

Домен бронирования услуг лёг на парадигму без единого блокера. Все новые находки — уточнения. Три расширения из раздела 22 прошли порог трёх тестов и готовы к стабилизации.

Парадигма готова к реализации e-commerce/booking домена в прототипе. Ядро стабильно. Расширения конвергируют.
