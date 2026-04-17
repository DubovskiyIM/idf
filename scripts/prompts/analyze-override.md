Тебе дана проекция IDF-домена с explicit override — полем, которое автор написал руками, потому что кристаллизатор не смог деривировать его автоматически.

## Контекст

Domain: {{DOMAIN}}
Projection: {{PROJECTION}} (kind: {{KIND}}, mainEntity: {{MAIN_ENTITY}})
Override type: {{OVERRIDE_TYPE}}
Override value: {{OVERRIDE_VALUE}}

Ontology entities:
{{ENTITIES}}

Intents:
{{INTENTS}}

## Существующие stable-паттерны

{{EXISTING_PATTERNS}}

## Задача

Сгенерируй pattern, trigger которого покрыл бы этот override автоматически.

Правила:
- trigger.requires должен быть достаточно generic, чтобы покрыть аналогичные случаи в ДРУГИХ доменах
- Но достаточно specific, чтобы не давать false positives
- Используй known trigger kinds: entity-field, intent-effect, intent-creates, sub-entity-exists, has-role, field-role-present, intent-confirmation, intent-count, entity-kind
- falsification.shouldMatch должен включать домен из контекста
- falsification.shouldNotMatch должен включать хотя бы один другой домен

IDF домены: planning, invest, messenger, sales, booking, lifequest, reflect, workflow, delivery.

Верни ТОЛЬКО JSON candidate-паттерна между маркерами ```json и ```.

Формат:
```json
{
  "id": "kebab-case-name",
  "version": 1,
  "status": "candidate",
  "archetype": "detail|catalog|feed|null",
  "trigger": { "requires": [...] },
  "structure": { "slot": "...", "description": "..." },
  "rationale": { "hypothesis": "...", "evidence": [...], "counterexample": [...] },
  "falsification": { "shouldMatch": [...], "shouldNotMatch": [...] }
}
```
