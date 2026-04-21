# СОСТОЯНИЕ: roles

Intents зафиксированы. Теперь — кто что может выполнять и что видит.

**Цель:** за 1-2 хода заполнить `canExecute` и `visibleFields` для известных
ролей, добавить `agent`-роль, перейти в `ontology_detail`.

## Стратегия

1. **Заполни canExecute** для каждой роли из `kickoff`:
   - `base: "owner"` (csm) — может всё по своему клиенту: create, replace, read
   - `base: "admin"` (manager) — может всё по любому клиенту
2. **Добавь agent-роль** с узким набором:
   - `canExecute`: типичные 3-5 интентов, которые LLM реально хочется
     делегировать (report-generation, escalation, notification)
   - `visibleFields`: только поля, необходимые для этих intent'ов

## Типовой ход

- `userFacing`: «CSM владеет своими клиентами, manager видит всех. Добавил агент-роль с тремя intent'ами: escalate_blocker, request_extension, generate_handoff_doc. Всё ок?»
- `patch`:
  ```json
  {
    "ONTOLOGY": {
      "roles": {
        "csm": {
          "base": "owner",
          "canExecute": ["add_client", "advance_stage", "mark_go_live",
                         "add_task", "complete_task", "add_contact",
                         "log_note", "generate_handoff_doc"],
          "visibleFields": {
            "Client": ["*"], "Task": ["*"], "Contact": ["*"], "Note": ["*"]
          }
        },
        "manager": {
          "base": "admin"
        },
        "agent": {
          "base": "agent",
          "canExecute": ["log_note", "generate_handoff_doc"],
          "visibleFields": {
            "Client": ["name", "currentStage", "contractValue", "startDate"],
            "Task": ["title", "deadline", "done"],
            "Note": ["body", "at"]
          }
        }
      }
    }
  }
  ```
- `nextState`: `ontology_detail`
- `nextPrompt`: `Почти готово. Сейчас пропишу, кто владеет записями — это определит privacy. Подтверди или скорректируй.`

## Правила

- **`admin`** — видит всё без дополнительных `visibleFields`. Не прописывай ему
  `canExecute` — он может всё.
- **`owner`** — `canExecute` обычно = все intents кроме destructive и
  `generate_*` документов.
- **`agent`** — `canExecute` узкий, 2-4 intent'а из safest. Не давай агенту
  `advance_stage` / `mark_go_live` без preapproval — это часто приводит к
  нежелательным действиям.
- **`visibleFields["Entity"]: ["*"]`** — удобно на старте; в финальной спеке
  обычно нарезается точнее. На живом демо оставляем "*" для owner,
  сужаем для agent.

## Что пока НЕ делать

- **`preapproval`** для agent-роли — это отдельный концепт, усложняет демо.
  Не предлагай сейчас, упомянем в follow-up после demo.
- **Invariants** — это `ontology_detail`-состояние.
