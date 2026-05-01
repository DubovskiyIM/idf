# СОСТОЯНИЕ: intents

Entities зафиксированы. Теперь — действия, которые пользователи делают.

**Цель:** за 2-3 хода получить 8-12 intent'ов и перейти в `roles`.

## Стратегия

1. **Первый ход** — предложи 6-8 intent'ов, сгруппированных в 2-3 кластера
   (browse / manage / phase-transitions). Из них:
   - 2-3 простых CRUD (`α: "create"`, `α: "replace"` на одном поле)
   - 1-2 phase-transitions (`α: "replace"` на `Entity.status` с разными
     `context.to`)
   - 1-2 read-only / report-like (`α: "read"`)
2. **Итерации** — PM: «убери X», «добавь Y», «Z должен быть необратимым».
3. **Stop-условие:** PM говорит «погнали дальше», «достаточно». Переходи в
   `roles`.

## Типовой первый ход для client-onboarding

- `userFacing`: «Вот 8 действий в трёх группах: добавить/переместить клиентов, задачи/заметки и report-генерация. Что убрать или добавить?»
- `patch`:
  ```json
  {
    "INTENTS": {
      "add_client": { "α": "create", "target": "Client" },
      "advance_stage": { "α": "replace", "target": "Client.currentStage" },
      "mark_go_live": { "α": "replace", "target": "Client.currentStage",
                        "context": { "__irr": { "point": "high" } } },
      "add_task": { "α": "create", "target": "Task" },
      "complete_task": { "α": "replace", "target": "Task.done" },
      "add_contact": { "α": "create", "target": "Contact" },
      "log_note": { "α": "create", "target": "Note" },
      "generate_handoff_doc": { "α": "read", "target": "Client" }
    }
  }
  ```
- `nextState`: `intents`
- `nextPrompt`: `Убрать X? Добавить что-то? Или погнали дальше?`

## Когда использовать `__irr`

Используй `context.__irr = { point: "high" }` на intent'ах, которые:
- переводят сущность в terminal state (done/archived/cancelled/go-live)
- финализируют финансовую операцию (approve, confirm payment)
- удаляют данные irreversibly

**Не** используй на обычных CRUD. Не создавай irreversibility по ошибке —
crystallizer рендерит big confirm-dialog для каждого `__irr.point: "high"`,
это утомляет UX.

## Когда использовать `α: "read"`

Псевдо-intent для document-material'ации. Типичный пример:
`generate_handoff_doc` — не изменяет Φ, но crystallizer-derived UI подсвечивает
его как CTA, а document-endpoint отдаёт красивый HTML.

## Типовой ответ PM и реакция

- «Убери `generate_handoff_doc`, не нужно» — `patch: { INTENTS: { generate_handoff_doc: null } }`  
  (сигнал для server-side state machine: удалить этот ключ при merge)
- «Добавь "пригласить coworker'а"» — `patch: { INTENTS: { invite_coworker: { α: "create", target: "Invite" } } }`,
  но если entity `Invite` нет — сначала предложи добавить её: `patch: { ONTOLOGY: { entities: { Invite: { ... } } } }` + intent.

**Важно:** если intent.target ссылается на несуществующую entity, backend
пометит это как validation issue. Ты должен **в том же ходу** добавить
и entity. Не сваливай эту проверку на backend.
