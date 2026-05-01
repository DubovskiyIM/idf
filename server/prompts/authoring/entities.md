# СОСТОЯНИЕ: entities

Цель и роли зафиксированы. Теперь определяем, какие «вещи» живут в инструменте
и какие поля у них есть.

**Цель:** за 2-4 хода получить 3-5 сущностей с 3-5 полями каждая. Далее —
`intents`.

## Стратегия

1. **Первый ход** — предложи 3-4 сущности на основе `meta.description`. Для
   каждой — 3-4 поля максимум. Не перегружай.
2. **Последующие ходы** — ждёшь реакции: «оставь как есть», «добавь X»,
   «убери Y», «в Client должно быть ещё поле contractValue».
3. **Stop-условие:** PM говорит «достаточно» / «хватит» / «погнали дальше» —
   переходи в `intents`.

## Типовой первый ход

Для golden-domain `client-onboarding`:

- `userFacing`: «Предлагаю 4 вещи. Client, Task, Contact, Note. Клиент имеет имя, индустрию, стадию, сумму контракта. Задача привязана к клиенту, имеет дедлайн и статус. Contact — люди со стороны клиента. Note — свободная заметка. Ок?»
- `patch`:
  ```json
  {
    "ONTOLOGY": {
      "entities": {
        "Client": {
          "fields": {
            "name": { "type": "text", "required": true, "role": "primary" },
            "industry": { "type": "select", "options": ["saas", "fintech", "retail", "other"] },
            "contractValue": { "type": "number", "role": "money" },
            "currentStage": { "type": "select", "options": ["contract", "kickoff", "config", "training", "go-live", "done"], "required": true }
          }
        },
        "Task": {
          "fields": {
            "clientId": { "type": "entityRef", "ref": "Client", "required": true },
            "title": { "type": "text", "required": true },
            "deadline": { "type": "date", "role": "date" },
            "done": { "type": "boolean" }
          }
        },
        "Contact": {
          "fields": {
            "clientId": { "type": "entityRef", "ref": "Client", "required": true },
            "fullName": { "type": "text", "required": true },
            "email": { "type": "text", "role": "email" }
          }
        },
        "Note": {
          "fields": {
            "clientId": { "type": "entityRef", "ref": "Client", "required": true },
            "body": { "type": "textarea", "required": true },
            "at": { "type": "date", "role": "date" }
          }
        }
      }
    }
  }
  ```
- `nextState`: `entities` (остаёмся, ждём корректировки)
- `nextPrompt`: `Оставить, изменить, добавить поле?`

## Что важно

- **Всегда ставь `role: "primary"`** на поле с именем сущности (обычно первый
  text-field). Это влияет на UI — adapter показывает его как заголовок
  карточки.
- **Всегда ставь `role: "money"`** на числовые поля, которые реально — деньги
  (contractValue, amount, price).
- **`role: "date"`** на date-поля — влияет на sorting в catalog.
- **Ownership:** не спешу — добавляй `ownerField: true` в `ontology_detail`
  состоянии, а не сейчас.

## Что НЕ делать

- **Не предлагай более 5 entity.** 3-4 оптимум. Если PM требует больше —
  объясни: «проще стартануть с 4, остальные добавим позже — можно в любой
  момент».
- **Не заполняй `fields` длиннее 6 полей** per entity. Типичная entity — 3-5
  полей. Больше — сложно воспринимать.
