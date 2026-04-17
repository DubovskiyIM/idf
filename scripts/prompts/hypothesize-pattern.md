Ты — архитектор UX-паттернов для IDF кристаллизатора.

## Контекст

Extracted domain model из реального продукта:
{{EXTRACTED_MODEL}}

Source: {{SOURCE_NAME}}

## Существующие stable-паттерны

{{EXISTING_PATTERNS}}

## Задача

1. Сопоставь каждое observation из extracted model с existing паттернами
2. Если observation покрыто — отметь "covered: <pattern-id>"
3. Если observation НЕ покрыто — сгенерируй candidate-паттерн

## Формат candidate-паттерна

```json
{
  "id": "kebab-case-name",
  "version": 1,
  "status": "candidate",
  "archetype": "detail|catalog|feed|null",
  "trigger": {
    "requires": [
      { "kind": "<trigger-kind>", ...params }
    ]
  },
  "structure": {
    "slot": "primaryCTA|hero|sections|toolbar|overlay|header|footer|composer|body",
    "description": "Что паттерн делает, 1-2 предложения"
  },
  "rationale": {
    "hypothesis": "Почему это UX-решение лучше наивного",
    "evidence": [
      { "source": "product-name", "description": "Что именно видели", "reliability": "high|medium|low" }
    ],
    "counterexample": [
      { "source": "product-name", "description": "Где это НЕ работает", "reliability": "high|medium|low" }
    ]
  },
  "falsification": {
    "shouldMatch": [
      { "domain": "idf-domain-name", "projection": "projection-id", "reason": "..." }
    ],
    "shouldNotMatch": [
      { "domain": "idf-domain-name", "projection": "projection-id", "reason": "..." }
    ]
  }
}
```

Trigger kinds: entity-field, intent-effect, intent-creates, sub-entity-exists, has-role, field-role-present, intent-confirmation, intent-count, entity-kind.

IDF домены для falsification: planning (Poll, TimeOption, Vote), invest (Portfolio, Position, Asset), messenger (Conversation, Message), sales (Listing, Bid), booking (Specialist, Service, Booking), lifequest (Goal, Habit, Task), reflect (MoodEntry, Hypothesis), workflow (Workflow, Node, Execution), delivery (Order, MenuItem, Delivery).

## Output

JSON с двумя полями:
- "covered": массив {"observation": "...", "coveredBy": "pattern-id"}
- "candidates": массив candidate-паттернов (может быть пуст если всё покрыто)

Верни ТОЛЬКО JSON между маркерами ```json и ```.
