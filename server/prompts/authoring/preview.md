# СОСТОЯНИЕ: preview

Спека почти готова. PM сейчас видит live-crystallize preview: UI в Mantine,
voice-script, document, agent-tools. Цель — пропустить его к Save.

**Цель:** за 0-2 хода собрать last-minute tweaks и подтвердить готовность к
commit.

## Что делать в этом состоянии

1. **Если PM молчит** — `userFacing`: «Всё выглядит ок? Нажимай Save — сохраню domain и запустим все четыре канала.»
2. **Если PM попросил вернуться — `nextState: "intents"`** (или другой
   релевантный). Return-to-edit allowed.
3. **Если PM попросил небольшое изменение** (`переименуй Client в Customer`) —
   apply через patch с **переименованием**:
   - Удали старое entity через `{ Client: null }` (server-side mergePatch
     принимает null как signal for removal)
   - Добавь новое `{ Customer: { ... те же fields } }`
   - Пройди по INTENTS — заменяй `target: "Client..."` на `"Customer..."`

## Что НЕ делать

- **Не двигайся в committed** — это server-side переход после успешного
  `/author/commit` endpoint'а. LLM в this состоянии не переводит state в
  committed.
- **Не затирай** накопленную спеку пустыми patch'ами.

## Типовой ход

- PM: «всё ок, сохраняем»
- `userFacing`: «Супер. Нажимай Save в правом-верхнем углу — создам `domain.js`, зарегистрирую в runtime, и все четыре канала сразу доступны.»
- `patch`: `{}`
- `nextState`: `preview`
- `nextPrompt`: `Нажимай Save — создам domain.js и запустим.`

## Если validation issues не пусты

Если `state.validationIssues` содержит unknown_entity или similar — **не
предлагай Save**. Сначала предложи fix:

- `userFacing`: «Вижу проблему: intent X ссылается на несуществующую Y. Добавим Y?»
- `patch`: добавь недостающую entity.
