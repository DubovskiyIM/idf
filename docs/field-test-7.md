# Intent-Driven Frontend — Полевой тест 1.0.1

## Стресс-тест парадигмы на реальном приложении

## Домен: чат-мессенджер с авторизацией и real-time

Полноценное чат-приложение: регистрация/авторизация (email+password, JWT), список контактов, 1:1 чаты, групповые чаты, сообщения в реальном времени (WebSocket), прочитанные сообщения, индикатор «печатает», поиск, вложения. Реальная многопользовательность — каждый пользователь в своём браузере.

**Почему этот домен.** Это первый тест на **реальном приложении**, а не на прототипе-демонстрации. Предыдущие 6 тестов проверяли концепты парадигмы в изоляции. Мессенджер проверяет **всё одновременно**: многопользовательность, real-time, авторизацию, масштаб, границу, зависимость от зрителя, рабочие процессы — в одном приложении, которым можно реально пользоваться.

Ключевые стресс-точки:
- **Реальная авторизация** — JWT, сессии, middleware. Зритель = авторизованный пользователь.
- **WebSocket вместо SSE** — двунаправленный real-time. Эффекты пушатся мгновенно.
- **Много пользователей одновременно** — не симуляция, реальные подключения.
- **Масштаб Φ** — тысячи сообщений = тысячи эффектов. Fold на каждом рендере?
- **Приватность** — я вижу только свои чаты, не чужие. Зависимость от зрителя = не декорация, а безопасность.

## Онтология

**Сущности:**

`User` — внутренняя. Поля: id, email, name, avatar, status {online, offline, away}, lastSeen, createdAt.

`Contact` — внутренняя (relationship entity). Поля: id, userId, contactId, status {pending, accepted, blocked}. Связь между двумя пользователями.

`Conversation` — внутренняя. Поля: id, type {direct, group}, title, createdBy, participantIds[], lastMessageAt, createdAt.

`Participant` — внутренняя. Поля: id, conversationId, userId, role {member, admin, owner}, joinedAt, lastReadAt.

`Message` — внутренняя. Поля: id, conversationId, senderId, type {text, image, file, system}, content, replyToId, attachmentUrl, status {sent, delivered, read}, createdAt, editedAt, deletedFor[].

`TypingIndicator` — транзиентная (сигнал, не сущность). Не хранится в Φ.

**Предикаты:**
- `user_is_online(user)` ≡ `user.status = 'online'`
- `contact_is_accepted(contact)` ≡ `contact.status = 'accepted'`
- `is_participant(user, conversation)` ≡ `∃ participant: participant.conversationId = conversation.id ∧ participant.userId = user.id`
- `is_admin(user, conversation)` ≡ `participant.role IN ('admin', 'owner')`
- `message_is_mine(message, user)` ≡ `message.senderId = user.id`

**Правила импликации:**
- Принятие контакта → можно создать direct-чат
- Блокировка контакта → сообщения не доставляются
- Удаление участника из группы → теряет доступ к новым сообщениям
- Отправка сообщения → обновляет lastMessageAt беседы

## Роли и доступ (раздел 5 манифеста)

```
roles: {
  self: {
    // Свои данные — полный доступ
    canExecute: [все намерения],
    visibleFields: { User: все, Message: все для своих чатов }
  },
  contact: {
    // Другие пользователи — ограниченный
    visibleFields: { User: [id, name, avatar, status], Message: [отправленные в общих чатах] }
  },
  stranger: {
    // Незнакомцы — минимальный
    visibleFields: { User: [id, name, avatar] }
  }
}
```

## 25 намерений

### Авторизация (4)

**1. register — Регистрация**
```
E: user: User
C: [email не занят]
F: [{ α: add, target: users, σ: global }]
W: []
P: form (email, password, name)
creates: User
```
Граница: валидация email, хеширование пароля. Эффект `add` в Φ с `σ: global`. JWT-токен возвращается.

**2. login — Вход**
```
E: user: User
C: [user.email = input.email, password.matches]
F: [{ α: replace, target: user.status, value: 'online', σ: global }]
W: []
P: form (email, password)
```
Граница: проверка пароля, генерация JWT. Сигнал: `presence_changed` (online).

**3. logout — Выход**
```
E: user: User
C: [user.status = 'online']
F: [{ α: replace, target: user.status, value: 'offline', σ: global }]
W: []
P: click
```
Сигнал: `presence_changed` (offline). Закрытие WebSocket.

**4. update_profile — Обновить профиль**
```
E: user: User
C: []
F: [{ α: replace, target: user.name, σ: global },
    { α: replace, target: user.avatar, σ: global }]
W: [user.name (текущее), user.avatar (текущий)]
P: form
phase: investigation
```

### Контакты (4)

**5. add_contact — Добавить контакт**
```
E: contact: Contact
C: [target_user существует, нет существующего контакта]
F: [{ α: add, target: contacts, σ: account }]
W: [target_user.name, target_user.avatar]
P: click
creates: Contact(pending)
```
Сигнал: `contact_request` (push уведомление получателю).

**6. accept_contact — Принять запрос**
```
E: contact: Contact
C: [contact.status = 'pending', contact.contactId = me.id]
F: [{ α: replace, target: contact.status, value: 'accepted', σ: account }]
W: [requester.name]
P: click
antagonist: reject_contact
```
Последовательная: `accept_contact ▷ create_direct_chat`.

**7. reject_contact — Отклонить запрос**
```
E: contact: Contact
C: [contact.status = 'pending', contact.contactId = me.id]
F: [{ α: replace, target: contact.status, value: 'rejected', σ: account }]
W: [requester.name]
P: click
antagonist: accept_contact
```

**8. block_contact — Заблокировать**
```
E: contact: Contact
C: [contact.status = 'accepted']
F: [{ α: replace, target: contact.status, value: 'blocked', σ: account }]
W: [contact.name]
P: click (подтверждение)
irreversibility: medium
```

### Беседы (5)

**9. create_direct_chat — Создать личный чат**
```
E: conversation: Conversation, contact: Contact
C: [contact_is_accepted(contact), нет существующего direct-чата]
F: [{ α: add, target: conversations, σ: account },
    { α: add, target: participants, σ: account }]     — два участника
W: [contact.name]
P: click
creates: Conversation(direct)
```

**10. create_group — Создать групповой чат**
```
E: conversation: Conversation
C: []
F: [{ α: add, target: conversations, σ: account },
    { α: add, target: participants, σ: account }]
W: []
P: form (title, participantIds)
creates: Conversation(group)
```

**11. add_to_group — Добавить в группу**
```
E: conversation: Conversation, user: User
C: [conversation.type = 'group', is_admin(me, conversation)]
F: [{ α: add, target: participants, σ: account }]
W: [user.name, conversation.title]
P: click
```
Сигнал: `added_to_group` (push).

**12. leave_group — Покинуть группу**
```
E: participant: Participant
C: [conversation.type = 'group', participant.userId = me.id]
F: [{ α: remove, target: participants, σ: account }]
W: [conversation.title, participants.count]
P: click (подтверждение)
```

**13. remove_from_group — Удалить из группы**
```
E: participant: Participant
C: [conversation.type = 'group', is_admin(me, conversation), participant.userId != me.id]
F: [{ α: remove, target: participants, σ: account }]
W: [participant.user.name, conversation.title]
P: click (подтверждение)
irreversibility: medium
```

### Сообщения (8)

**14. send_message — Отправить сообщение**
```
E: message: Message
C: [is_participant(me, conversation)]
F: [{ α: add, target: messages, σ: account },
    { α: replace, target: conversation.lastMessageAt, σ: account }]
W: [conversation.title, draft_text]
P: enter/click
creates: Message(sent)
```
Ключевое намерение. Эффект `add` в Φ → WebSocket пушит всем участникам → delivered → read.

Жизненный цикл сообщения: `sent → delivered → read` (аналог proposed → confirmed, но для доставки).

**15. edit_message — Редактировать сообщение**
```
E: message: Message
C: [message_is_mine(message, me), message.createdAt > now - 15min]
F: [{ α: replace, target: message.content, σ: account },
    { α: replace, target: message.editedAt, σ: account }]
W: [message.content (текущее)]
P: form
phase: investigation
```
Темпоральный предикат: редактирование доступно 15 минут.

**16. delete_message — Удалить сообщение**
```
E: message: Message
C: [message_is_mine(message, me)]
F: [{ α: replace, target: message.deletedFor, σ: account }]     — мягкое удаление
W: [message.content]
P: click (подтверждение)
```
Два варианта: «удалить для себя» (добавить myId в deletedFor[]) и «удалить для всех» (добавить '*' в deletedFor[]). Зависимость от зрителя: я не вижу своих удалённых.

**17. reply_to_message — Ответить на сообщение**
```
E: message: Message
C: [is_participant(me, conversation)]
F: [{ α: add, target: messages, σ: account }]
W: [original_message.content, original_message.sender.name]
P: enter/click
creates: Message(sent, replyToId)
```

**18. forward_message — Переслать**
```
E: message: Message, target_conversation: Conversation
C: [is_participant(me, target_conversation)]
F: [{ α: add, target: messages, σ: account }]
W: [message.content, target_conversation.title]
P: click (выбор беседы)
creates: Message(sent, forwarded)
```

**19. mark_as_read — Прочитать сообщения**
```
E: participant: Participant
C: [is_participant(me, conversation)]
F: [{ α: replace, target: participant.lastReadAt, σ: account }]
W: []
P: auto (при открытии чата)
```
Автоматическое намерение — при открытии беседы все непрочитанные отмечаются. Сигнал: `read_receipt` (отправителю).

**20. send_attachment — Отправить вложение**
```
E: message: Message
C: [is_participant(me, conversation)]
F: [{ α: add, target: messages, σ: account }]
W: [file.name, file.size, file.type]
P: file upload
creates: Message(image/file)
```
Граница: загрузка файла на сервер/S3 → URL в message.attachmentUrl.

**21. start_typing — Начать печатать**
```
E: (нет сущности — только сигнал)
C: [is_participant(me, conversation)]
F: []
W: []
P: auto (при начале ввода)
```
Чистый сигнал (Σ): `typing_started` → WebSocket → индикатор у собеседников. Транзиентный — не в Φ.

### Поиск и настройки (4)

**22. search_messages — Поиск по сообщениям**
```
E: (проекция, не намерение)
C: []
F: []
W: [query, results]
P: form
```
Проекция, не намерение (нет эффектов). Фильтрация messages по тексту.

**23. mute_conversation — Заглушить беседу**
```
E: participant: Participant
C: [is_participant(me, conversation)]
F: [{ α: replace, target: participant.muted, value: true, σ: account }]
W: [conversation.title]
P: click
antagonist: unmute_conversation
```

**24. unmute_conversation — Включить звук**
```
E: participant: Participant
C: [is_participant(me, conversation), participant.muted = true]
F: [{ α: replace, target: participant.muted, value: false, σ: account }]
W: [conversation.title]
P: click
antagonist: mute_conversation
```

**25. pin_conversation — Закрепить беседу**
```
E: participant: Participant
C: [is_participant(me, conversation)]
F: [{ α: replace, target: participant.pinned, value: true, σ: account }]
W: []
P: click
```

---

## 5 проекций

**conversation_list** `V = ⟨E, Q, W⟩`
```
E: Conversation, Participant, Message, User
Q: все беседы текущего пользователя, сортировка по lastMessageAt
W: [title, lastMessage.content, lastMessage.sender.name, unreadCount, participant.status]
```
Зависимость от зрителя: я вижу только свои беседы. Закреплённые наверху. Заглушённые без звука.

**chat_view** `V = ⟨E, Q, W⟩`
```
E: Message, User, Conversation
Q: сообщения одной беседы, пагинация (последние N + загрузка по скроллу)
W: [message.content, sender.name, sender.avatar, createdAt, status, replyTo, editedAt]
```
Зависимость от зрителя: не показывать сообщения с myId в deletedFor. Показывать «отредактировано» для editedAt > createdAt.

**contact_list** `V = ⟨E, Q, W⟩`
```
E: Contact, User
Q: все контакты текущего пользователя + входящие запросы
W: [name, avatar, status, contact.status]
```

**user_profile** `V = ⟨E, Q, W⟩`
```
E: User
Q: профиль одного пользователя
W: [name, avatar, status, lastSeen]
```
Зависимость от зрителя: я вижу lastSeen только для контактов.

**typing_indicators** `V = ⟨E, Q, W⟩`
```
E: (транзиентный поток Σ)
Q: кто сейчас печатает в текущей беседе
W: [user.name]
```
Проекция над сигналами, не над Φ.

---

## 6 сигналов

**new_message** — при send_message, at-least-once (WebSocket push)
**read_receipt** — при mark_as_read, fire-and-forget (WebSocket)
**typing_started** — при start_typing, fire-and-forget (WebSocket, TTL 3с)
**contact_request** — при add_contact, at-least-once (push notification)
**added_to_group** — при add_to_group, at-least-once
**presence_changed** — при login/logout, fire-and-forget (broadcast)

---

## Что работает с ходу

**Сообщения как эффекты.** send_message = `add` в Φ. Редактирование = `replace`. Удаление = `replace deletedFor`. Алгебра: `add + add` = объединение (параллельные сообщения). Работает.

**Беседы и участники.** Conversation + Participant = relationship entity (тест 1, тест 6). CRUD стандартный.

**Контакты.** Contact = relationship entity с жизненным циклом: pending → accepted | rejected | blocked. Рабочий процесс (раздел 9a).

**Антагонисты.** accept ⇌ reject, mute ⇌ unmute. Автовывод.

**Зависимость от зрителя.** Критична для приватности: я вижу только свои чаты и сообщения. Реализуется через roles в онтологии.

**Проекции.** Список бесед, чат, контакты, профиль — чистые проекции.

**Автоматические намерения.** mark_as_read при открытии чата — автоматический процесс (раздел 9a + executor).

---

## Находки

### M1 (🔴 блокирующая). Авторизация как граница с состоянием.

JWT-токен, сессия, middleware — это **граница с внешним миром**, но с состоянием. Текущая модель границы (раздел 19): чужие эффекты входят в Φ как confirmed, зеркальные сущности. Но авторизация — это не зеркальная сущность. Это **фильтр на доступ к Φ**: пользователь видит только свой срез World(t).

Решение-эскиз: `World_for(viewer) = fold(Φ_confirmed WHERE visible_to(viewer))`. Fold принимает viewer как параметр и фильтрует эффекты по scope + access rules.

Это расширение fold: вместо `fold(Φ)` → `fold(Φ, viewer)`. Зависимость от зрителя переносится из проекции в fold.

### M2 (🔴 блокирующая). WebSocket вместо SSE — двунаправленный real-time.

SSE (текущий) — однонаправленный: сервер → клиент. Для мессенджера нужен двунаправленный: отправка сообщения = клиент → сервер через WebSocket, доставка = сервер → клиент через WebSocket. 

Решение: заменить SSE на WebSocket. Протокол: клиент отправляет `{ type: "effect", payload: {...} }`, сервер валидирует и бродкастит `{ type: "effect:confirmed", id }` или `{ type: "effect:rejected", id, reason }`.

Это не расширение парадигмы — это замена транспорта. Φ, fold, effects — не меняются. Меняется только канал доставки.

### M3 (🟡 значительная). Масштаб Φ — пагинация и виртуализация.

Чат с 10000 сообщений = 10000 эффектов. `fold(Φ_confirmed)` на каждом рендере — невозможно. Нужна пагинация: загружать последние N сообщений, подгружать по скроллу.

Решение: fold принимает `window` — временное окно или лимит. `fold(Φ_confirmed, { after: lastReadAt - 1h, limit: 50 })`. Для conversation_list — fold всех бесед, но только lastMessage каждой.

Это расширение fold: оконная функция. Для прототипа — достаточно `LIMIT` на SQL-запросе.

### M4 (🟡 значительная). Typing как транзиентный сигнал с TTL.

`start_typing` — не эффект (не в Φ), не черновик (не в Δ). Это **транзиентный сигнал** с автоматическим истечением (TTL 3с). Если пользователь перестал печатать — индикатор исчезает.

Текущая модель сигналов (раздел 6) — fire-and-forget, без TTL. Typing нуждается в TTL на сигнале.

Решение: сигнал с `ttl: 3000` — клиент показывает индикатор, через 3с скрывает. Если новый сигнал приходит — таймер перезапускается. Это расширение модели сигналов, аналогичное TTL на эффектах.

### M5 (🟡 значительная). Удаление для себя / для всех.

`delete_message` имеет два варианта: «для себя» (добавить myId в deletedFor) и «для всех» (deletedFor = ['*']). Это не два намерения — это одно намерение с параметром.

Проекция `chat_view` фильтрует: `messages.filter(m => !m.deletedFor?.includes(myId) && !m.deletedFor?.includes('*'))`. Зависимость от зрителя на уровне фильтрации, не отображения.

### M6 (🟢 минорная). Read receipts как каскадный сигнал.

mark_as_read → сигнал read_receipt → отправителю. Отправитель обновляет статус сообщения: sent → delivered → read. Это **каскад**: эффект одного пользователя порождает эффект у другого через сигнал. Не проблема — уже работает через SSE/WebSocket.

---

## Сводка находок

| # | Находка | Уровень | Новое? |
|---|---|---|---|
| M1 | Авторизация как фильтр на Φ | 🔴 | Да |
| M2 | WebSocket вместо SSE | 🔴 | Инфраструктурное |
| M3 | Масштаб: пагинация fold | 🟡 | Да |
| M4 | Typing: сигнал с TTL | 🟡 | Расширение |
| M5 | Удаление для себя/для всех | 🟡 | Нет (зависимость от зрителя) |
| M6 | Read receipts как каскад | 🟢 | Нет |

Два блокера. Три значительных. Одна минорная.

---

## Архитектура реализации

### Стек
- **Frontend:** React (текущий прототип IDF)
- **Backend:** Express + SQLite (текущий) → расширить WebSocket (ws)
- **Auth:** JWT + bcrypt
- **Real-time:** WebSocket (ws library)
- **Файлы:** локальная файловая система (для прототипа)

### Серверная архитектура
```
server/
├── index.js           # Express + WebSocket
├── auth.js            # JWT, bcrypt, middleware
├── ws.js              # WebSocket handler (замена SSE)
├── db.js              # SQLite (существующий)
├── validator.js       # (существующий, расширить)
├── executor.js        # (существующий)
└── routes/
    ├── effects.js     # (существующий, + WebSocket)
    ├── auth.js        # POST /api/auth/register, /api/auth/login
    └── upload.js      # POST /api/upload (файлы)
```

### Клиентская архитектура
```
src/domains/messenger/
├── intents.js
├── projections.js
├── ontology.js
├── domain.js
├── ManualUI.jsx       # Sidebar (беседы) + ChatView + Input
└── components/
    ├── AuthForm.jsx   # Login/Register
    ├── ChatList.jsx   # Список бесед
    ├── ChatView.jsx   # Сообщения
    ├── MessageInput.jsx
    ├── ContactList.jsx
    └── UserProfile.jsx
```

---

## Траектория блокеров

| Тест | Домен | Тип | 🔴 | 🟡 | 🟢 |
|---|---|---|---|---|---|
| 0.2 | Очередь чтения | персональный | 4 | 5 | 1 |
| 0.2.1 | Календарь | темпоральный | 4 | 4 | 1 |
| 0.2.2 | Интернет-магазин | транзакционный | 2 | 4 | 0 |
| 0.3.1 | Бронирование | транз.-темпоральный | 0 | 4 | 2 |
| 0.5.1 | Планирование | коллаборативный | 2 | 3 | 1 |
| 0.6.1 | Workflow-редактор | графовый | 2 | 3 | 1 |
| 1.0.1 | Мессенджер | реальное приложение | 2 | 3 | 1 |

Блокеры стабильны на 2 — но характер меняется. Ранние блокеры — концептуальные (отсутствие проекций, сигналов). Поздние — инфраструктурные (авторизация, WebSocket, масштаб). Парадигма зрелая, блокеры на уровне реализации.

---

## Вердикт

Мессенджер — первый тест на реальном приложении. Парадигма покрывает доменную логику (сообщения, контакты, беседы) без новых концептуальных блокеров. Два блокера — инфраструктурные: авторизация как фильтр Φ и WebSocket вместо SSE. Оба решаемы расширением существующей архитектуры, не ядра парадигмы.

Ключевой инсайт: **парадигма масштабируется от прототипа к реальному приложению**. Концепты (Φ, fold, проекции, сигналы, зависимость от зрителя) переносятся 1:1. Меняется только инфраструктура (транспорт, авторизация, масштаб).
