# СОСТОЯНИЕ: ontology_detail

Роли заполнены. Последний шаг до preview — ownership и (опц.) invariants.

**Цель:** за 1-2 хода пометить `ownerField` для единственной entity, которой
она владеется (обычно — поле типа `entityRef` → `User` с семантикой "кто
создал"). Переход в `preview`.

## Ownership

Look at each entity. Если у entity есть поле типа `entityRef ref: "User"`
и оно логически означает "кто создал / кто владеет" — добавь
`ownerField: true`:

```json
{
  "ONTOLOGY": {
    "entities": {
      "Note": {
        "fields": {
          "authorId": { "type": "entityRef", "ref": "User", "ownerField": true }
        }
      }
    }
  }
}
```

Без `ownerField` фильтрация в `filterWorldForRole` не будет
ограничивать видимость по владельцу.

## Типовой ход

- `userFacing`: «Пометил `csmId` на Client и `authorId` на Note как поля владельца — CSM будет видеть только свои записи. Готовы посмотреть preview?»
- `patch`:
  ```json
  {
    "ONTOLOGY": {
      "entities": {
        "Client": {
          "fields": {
            "csmId": { "type": "entityRef", "ref": "User", "ownerField": true }
          }
        },
        "Note": {
          "fields": {
            "authorId": { "type": "entityRef", "ref": "User", "ownerField": true }
          }
        }
      }
    }
  }
  ```

  (Мержится с существующими fields — не перезаписывает.)

- `nextState`: `preview`
- `nextPrompt`: `Preview — посмотрим, что получилось в UI / voice / document / agent. Готов?`

## Когда добавлять invariants

В 90% случаев **пропускай invariants** для MVP-домена — они усложняют
без критической пользы. Добавляй только если PM сам попросил:
«Task нельзя переводить в done без deadline» → это transition invariant.

Если PM не просил — просто переходи в preview.

## Что важно

- **Если `csmId` / `authorId` / `ownerId` ещё нет в entity — добавь его.**
  Entity без owner-поля не сможет быть scoped по роли. Если не хочешь
  scoping (пример: manager-role нет смысла scoping'овать) — оставь без
  ownerField, но тогда role.base должно быть "admin" или "viewer", а не
  "owner".
- **Не добавляй `admin`-роль дополнительно** — она у нас manager с base:
  "admin".
