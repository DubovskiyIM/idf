/**
 * Правила целостности (раздел 13 манифеста).
 * Проверяются перед кристаллизацией.
 *
 * Принимает: INTENTS, PROJECTIONS, ONTOLOGY
 * Возвращает: { passed, issues[] }
 */

export function checkIntegrity(INTENTS, PROJECTIONS, ONTOLOGY) {
  const issues = [];
  const intents = Object.entries(INTENTS);
  const projections = Object.entries(PROJECTIONS);

  // === 1. Нет мёртвых намерений ===
  // Для каждого намерения с conditions — существует ли путь (другое намерение),
  // чьи эффекты делают условие истинным?
  for (const [id, intent] of intents) {
    const conditions = intent.particles.conditions || [];
    if (conditions.length === 0) continue;

    for (const cond of conditions) {
      // Извлечь target.field = 'value' из условия
      const match = cond.match(/^(\w+)\.(\w+)\s*=\s*'([^']+)'$/);
      if (!match) continue;
      const [, entityType, field, value] = match;

      // Найти намерение, чей эффект устанавливает это значение
      const hasProducer = intents.some(([otherId, other]) => {
        if (otherId === id) return false;
        return (other.particles.effects || []).some(ef => {
          const efTarget = ef.target || "";
          return efTarget.includes(field) && (ef.value === value || other.creates);
        });
      });

      if (!hasProducer) {
        issues.push({
          rule: "no_dead_intents",
          level: "warning",
          intent: id,
          message: `Условие "${cond}" может быть невыполнимо — не найден производитель`,
          detail: `Нет намерения, чей эффект устанавливает ${entityType}.${field} = '${value}'`
        });
      }
    }
  }

  // === 2. Нет эффектов-сирот ===
  // Каждый эффект должен быть наблюдаем через хотя бы одну проекцию
  for (const [id, intent] of intents) {
    for (const ef of (intent.particles.effects || [])) {
      const target = ef.target || "";
      const collectionBase = target.split(".")[0];

      // Проверить: есть ли проекция, чьи witnesses упоминают поля из этого target
      const isObservable = projections.some(([, proj]) => {
        return (proj.witnesses || []).some(w => {
          return w.includes(collectionBase) || target.includes(w.split(".")[0]);
        });
      });

      // Также проверяем через онтологию — если сущность существует, она наблюдаема
      const entityExists = ONTOLOGY?.entities && Object.keys(ONTOLOGY.entities).some(e =>
        e.toLowerCase() === collectionBase || (e.toLowerCase() + "s") === collectionBase
      );

      if (!isObservable && !entityExists) {
        issues.push({
          rule: "no_orphan_effects",
          level: "warning",
          intent: id,
          message: `Эффект на "${target}" может быть ненаблюдаем`,
          detail: `Нет проекции с witness для ${collectionBase}`
        });
      }
    }
  }

  // === 3. Полнота свидетельств ===
  // Witnesses должны покрывать условия и ключевые поля эффектов
  for (const [id, intent] of intents) {
    const witnesses = intent.particles.witnesses || [];
    const conditions = intent.particles.conditions || [];
    const effects = intent.particles.effects || [];

    // Условия, от которых зависит решение, должны быть в witnesses
    for (const cond of conditions) {
      const match = cond.match(/^(\w+)\.(\w+)/);
      if (!match) continue;
      const condField = match[2];

      const hasWitness = witnesses.some(w => w.includes(condField));
      if (!hasWitness && condField !== "status") { // status обычно очевиден из UI
        issues.push({
          rule: "witness_completeness",
          level: "info",
          intent: id,
          message: `Условие "${cond}" не покрыто свидетельством`,
          detail: `Witness для "${condField}" отсутствует — пользователь может не знать, применимо ли намерение`
        });
      }
    }

    // Намерение без witnesses (кроме тривиальных)
    if (witnesses.length === 0 && effects.length > 0 && !intent.creates) {
      issues.push({
        rule: "witness_completeness",
        level: "info",
        intent: id,
        message: `Нет свидетельств`,
        detail: `Намерение без witnesses — пользователь принимает решение вслепую`
      });
    }
  }

  // === 4. Пропорциональность подтверждения ===
  // irreversibility: high → подтверждение должно быть сильнее чем click
  for (const [id, intent] of intents) {
    const irreversibility = intent.irreversibility;
    const confirmation = intent.particles.confirmation;

    if (irreversibility === "high" && confirmation === "click") {
      issues.push({
        rule: "confirmation_proportionality",
        level: "warning",
        intent: id,
        message: `Высокая необратимость, но подтверждение — click`,
        detail: `irreversibility: high требует как минимум подтверждения (confirm dialog)`
      });
    }
  }

  // === 5. Антагонисты существуют ===
  for (const [id, intent] of intents) {
    if (intent.antagonist && !INTENTS[intent.antagonist]) {
      issues.push({
        rule: "antagonist_exists",
        level: "error",
        intent: id,
        message: `Антагонист "${intent.antagonist}" не найден`,
        detail: `Определён antagonist, но намерения с таким ID нет`
      });
    }
  }

  // === 6. Онтология покрывает сущности из намерений ===
  if (ONTOLOGY?.entities) {
    const knownEntities = new Set(Object.keys(ONTOLOGY.entities).map(e => e.toLowerCase()));
    for (const [id, intent] of intents) {
      for (const entityStr of (intent.particles.entities || [])) {
        const typeName = entityStr.split(":").pop().trim().replace(/\(.*\)/, "").toLowerCase();
        if (!knownEntities.has(typeName) && typeName !== "booking[]") {
          issues.push({
            rule: "ontology_coverage",
            level: "warning",
            intent: id,
            message: `Сущность "${typeName}" не найдена в онтологии`,
            detail: `Частица entities ссылается на тип, которого нет в ONTOLOGY.entities`
          });
        }
      }
    }
  }

  const errors = issues.filter(i => i.level === "error").length;
  const warnings = issues.filter(i => i.level === "warning").length;
  const infos = issues.filter(i => i.level === "info").length;

  return {
    passed: errors === 0,
    errors, warnings, infos,
    issues,
    summary: `${intents.length} намерений, ${projections.length} проекций: ${errors} ошибок, ${warnings} предупреждений, ${infos} инфо`
  };
}
