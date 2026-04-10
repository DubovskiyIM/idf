/**
 * Кристаллизатор — генерирует JSON-артефакты из определений намерений и проекций.
 *
 * Не использует LLM (пока). Применяет правила:
 * - Проекция с query содержащим "список/все" → layout: list
 * - Проекция с query содержащим "один/детали" → layout: detail
 * - Намерение с creates → кнопка создания
 * - Намерение с conditions → условный рендеринг
 * - Антагонисты → toggle-кнопка
 * - Witnesses → отображаемые поля
 *
 * В будущем: LLM генерирует артефакт, правила — fallback.
 */

export function crystallize(INTENTS, PROJECTIONS, ONTOLOGY) {
  const artifacts = {};

  for (const [projId, proj] of Object.entries(PROJECTIONS)) {
    const artifact = {
      projection: projId,
      name: proj.name,
      version: 1,
      layer: "canonical",
      generatedAt: Date.now(),
      intentsHash: hashIntents(INTENTS),
      layout: generateLayout(projId, proj, INTENTS, ONTOLOGY),
    };
    artifacts[projId] = artifact;
  }

  return artifacts;
}

function generateLayout(projId, proj, INTENTS, ONTOLOGY) {
  const query = (proj.query || "").toLowerCase();
  const witnesses = proj.witnesses || [];

  // Определить тип: list, detail, form
  const isList = query.includes("все") || query.includes("список") || query.includes("сортировка") || query.includes("сообщения") || query.includes("контакт") || query.includes("беседы");
  const isDetail = query.includes("детали") || query.includes("профиль");

  // Определить source-коллекцию из witnesses
  const sourceGuess = guessSource(witnesses, ONTOLOGY, projId);

  // Найти связанные намерения
  const relatedIntents = findRelatedIntents(projId, proj, INTENTS, ONTOLOGY);
  const creators = relatedIntents.filter(i => INTENTS[i]?.creates);
  const actions = relatedIntents.filter(i => !INTENTS[i]?.creates);

  if (isList) {
    return {
      type: "column",
      gap: 12,
      children: [
        // Заголовок
        { type: "heading", content: proj.name, level: 1 },
        // Кнопки создания
        ...creators.map(intentId => ({
          type: "intentButton",
          intentId,
          icon: "➕",
          label: INTENTS[intentId].name,
          params: {},
        })),
        // Список
        {
          type: "list",
          source: sourceGuess,
          sort: "-createdAt",
          gap: 8,
          empty: { type: "text", content: "Пусто", style: "muted" },
          item: {
            type: "card",
            children: [
              {
                type: "row",
                gap: 10,
                children: [
                  // Основные witness-поля
                  {
                    type: "column",
                    sx: { flex: 1 },
                    children: witnesses.slice(0, 3).map(w => {
                      const field = w.split(".").pop();
                      const isMain = witnesses.indexOf(w) === 0;
                      return {
                        type: "text",
                        bind: field,
                        style: isMain ? "heading" : "secondary",
                      };
                    })
                  },
                  // Статус (если есть)
                  ...(witnesses.some(w => w.includes("status")) ? [{
                    type: "badge",
                    bind: "status",
                  }] : []),
                ]
              }
            ],
            // Кнопки действий
            intents: actions.slice(0, 4).map(intentId => {
              const intent = INTENTS[intentId];
              return {
                id: intentId,
                icon: getIntentIcon(intentId),
                label: intent.name,
                params: { id: "item.id" },
                condition: getIntentCondition(intent),
              };
            }),
          }
        }
      ]
    };
  }

  // Default: column с witnesses
  return {
    type: "column",
    gap: 10,
    children: [
      { type: "heading", content: proj.name, level: 1 },
      ...witnesses.map(w => ({
        type: "text",
        template: `${w}: {${w.split(".").pop()}}`,
        style: "secondary",
      })),
    ]
  };
}

function guessSource(witnesses, ONTOLOGY, projId) {
  const entities = ONTOLOGY?.entities ? Object.keys(ONTOLOGY.entities) : [];

  // 1. Имя проекции содержит имя сущности?
  const projLower = (projId || "").toLowerCase();
  for (const e of entities) {
    const eLower = e.toLowerCase();
    if (projLower.includes(eLower)) return eLower + "s";
  }

  // 2. Witnesses содержат entity.field?
  for (const w of witnesses) {
    const base = w.split(".")[0].toLowerCase();
    for (const e of entities) {
      if (e.toLowerCase() === base || e.toLowerCase() + "s" === base) {
        return e.toLowerCase() + "s";
      }
    }
  }

  // 3. Fallback
  if (entities.length > 0) return entities[0].toLowerCase() + "s";
  return "items";
}

function findRelatedIntents(projId, proj, INTENTS, ONTOLOGY) {
  // Находим намерения, чьи entities или effects пересекаются с witnesses проекции
  const witnessFields = new Set(proj.witnesses.map(w => w.split(".").pop()));
  const related = [];

  for (const [id, intent] of Object.entries(INTENTS)) {
    const effects = intent.particles.effects || [];
    const entities = intent.particles.entities || [];

    // Проверяем пересечение effects.target с witnesses
    const hasOverlap = effects.some(ef => {
      const base = ef.target.split(".")[0];
      return witnessFields.has(base) || proj.witnesses.some(w => w.includes(base));
    });

    if (hasOverlap) related.push(id);
  }

  return related.slice(0, 10); // Ограничиваем
}

function getIntentIcon(intentId) {
  const icons = {
    send: "📤", edit: "✎", delete: "✕", create: "➕", add: "➕",
    remove: "✕", block: "🚫", accept: "✓", reject: "✕", pin: "📌",
    mute: "🔇", unmute: "🔔", archive: "📦", forward: "↗", reply: "↩",
    leave: "←", start: "▶", stop: "⏹", search: "🔍",
  };
  for (const [key, icon] of Object.entries(icons)) {
    if (intentId.includes(key)) return icon;
  }
  return "⚡";
}

function getIntentCondition(intent) {
  if (!intent.particles.conditions.length) return null;
  // Преобразуем первое условие
  const cond = intent.particles.conditions[0];
  const match = cond.match(/^(\w+)\.(\w+)\s*=\s*'([^']+)'$/);
  if (match) return `item.${match[2]} === '${match[3]}'`;
  return null;
}

function hashIntents(INTENTS) {
  return Object.keys(INTENTS).sort().join(",").slice(0, 64);
}
