/**
 * Правила целостности (раздел 13 манифеста) + алгебра композиции (раздел 11).
 * Проверяются перед кристаллизацией.
 *
 * Session B (2026-04-12): правила #1, #5, #7 переписаны как graph queries
 * поверх computeAlgebra. Substring-heuristics удалены.
 */

import { computeAlgebra, computeAlgebraWithEvidence } from "./intentAlgebra.js";

export function checkIntegrity(INTENTS, PROJECTIONS, ONTOLOGY) {
  const issues = [];
  const intents = Object.entries(INTENTS);
  const projections = Object.entries(PROJECTIONS);

  // Вычисляем алгебру один раз для всех rules, которые над ней работают.
  const algebra = computeAlgebra(INTENTS, ONTOLOGY);
  const algebraWithEvidence = computeAlgebraWithEvidence(INTENTS, ONTOLOGY);

  // === 1. Нет мёртвых намерений (через algebra graph) ===
  // Интент с conditions должен иметь хотя бы одно входящее ▷ ребро,
  // иначе его условия никогда не станут истинными.
  for (const [id, intent] of intents) {
    const conditions = intent.particles?.conditions || [];
    if (conditions.length === 0) continue;
    if (algebra[id].sequentialIn.length === 0) {
      issues.push({
        rule: "no_dead_intents",
        level: "warning",
        intent: id,
        message: `Условия намерения могут быть невыполнимы`,
        detail: `Нет входящих ▷-рёбер — ни один другой intent не делает условия истинными`
      });
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

  // === 5. Антагонисты существуют + §15 classification ===
  // Сохраняем existing error check: declared antagonist должен существовать.
  // Плюс new check: declared без structural witness → info с classification.
  for (const [id, intent] of intents) {
    if (!intent.antagonist) continue;

    // Rule #5a: target существует
    if (!INTENTS[intent.antagonist]) {
      issues.push({
        rule: "antagonist_exists",
        level: "error",
        intent: id,
        message: `Антагонист "${intent.antagonist}" не найден`,
        detail: `Declared antagonist target не существует в INTENTS`
      });
      continue;
    }

    // Rule #5b: classification через algebraWithEvidence
    const evidence = algebraWithEvidence[id]?.antagonistsEvidence?.[intent.antagonist];
    if (evidence?.classification === "heuristic-lifecycle") {
      issues.push({
        rule: "antagonist_declared_heuristic",
        level: "info",
        intent: id,
        message: `Declared antagonist "${intent.antagonist}" — эвристический (§15)`,
        detail: `Derivation не нашла structural witness (effect pair-reversal). Классифицировано как heuristic-lifecycle — нормально для асимметричных lifecycle-пар (accept/reject, confirm/cancel).`
      });
    }
  }

  // === 6. Анкеринг — привязка ВСЕХ частиц к онтологии (раздел 15) ===
  if (ONTOLOGY?.entities) {
    const entities = ONTOLOGY.entities;
    const knownEntities = new Set(Object.keys(entities).map(e => e.toLowerCase()));
    const allFields = {};
    // Нормализация fields: legacy формат — массив строк, M3.3 — объект
    // { fieldName: { type, read, write, ... } }. Принимаем оба формата.
    const fieldNames = (entity) => {
      const f = entity?.fields;
      if (Array.isArray(f)) return f;
      if (f && typeof f === "object") return Object.keys(f);
      return [];
    };
    for (const [name, entity] of Object.entries(entities)) {
      allFields[name.toLowerCase()] = new Set(fieldNames(entity));
    }
    const knownPredicates = new Set(Object.keys(ONTOLOGY.predicates || {}));

    for (const [id, intent] of intents) {
      // 6a. Entities → сущность в онтологии
      for (const entityStr of (intent.particles.entities || [])) {
        const typeName = entityStr.split(":").pop().trim().replace(/\(.*\)/, "").replace(/\[\]/, "").toLowerCase();
        if (!knownEntities.has(typeName)) {
          issues.push({ rule: "anchoring_entity", level: "warning", intent: id,
            message: `Сущность "${typeName}" не анкерирована`,
            detail: `Тип "${typeName}" не найден в ONTOLOGY.entities` });
        }
      }

      // 6b. Conditions → поле/предикат существует
      for (const cond of (intent.particles.conditions || [])) {
        const matchField = cond.match(/^(\w+)\.(\w+)/);
        if (matchField) {
          const [, entityType, field] = matchField;
          const entityFields = allFields[entityType];
          if (entityFields && !entityFields.has(field) && !entityFields.has("status") && field !== "status") {
            // Не блокируем — мягкая проверка
          }
        }
        // Проверить предикат
        const matchPred = cond.match(/^(\w+)$/);
        if (matchPred && !knownPredicates.has(matchPred[1])) {
          // Простой предикат не найден — info
        }
      }

      // 6c. Effects → target анкерирован
      for (const ef of (intent.particles.effects || [])) {
        const target = ef.target || "";
        const base = target.split(".")[0];
        const singular = base.endsWith("s") ? base.slice(0, -1) : base;
        const isKnown = knownEntities.has(base) || knownEntities.has(singular) || base === "drafts";
        if (!isKnown) {
          issues.push({ rule: "anchoring_effect", level: "warning", intent: id,
            message: `Effect target "${target}" не анкерирован`,
            detail: `"${base}" не найден в ONTOLOGY.entities` });
        }
        // Проверить поле если target = "entity.field"
        if (target.includes(".")) {
          const field = target.split(".").pop();
          const entityKey = singular;
          if (allFields[entityKey] && !allFields[entityKey].has(field) && field !== "status") {
            issues.push({ rule: "anchoring_field", level: "info", intent: id,
              message: `Поле "${field}" не объявлено в ${entityKey}`,
              detail: `Effect target "${target}": поле "${field}" не в ONTOLOGY.entities.${entityKey}.fields` });
          }
        }
      }

      // 6d. Witnesses → поля наблюдаемы
      for (const w of (intent.particles.witnesses || [])) {
        if (!w.includes(".") && !w.includes("(")) continue; // пропустить простые метки
        const parts = w.split(".");
        if (parts.length >= 2) {
          const entityType = parts[0].toLowerCase();
          const field = parts[1];
          if (allFields[entityType] && !allFields[entityType].has(field)) {
            issues.push({ rule: "anchoring_witness", level: "info", intent: id,
              message: `Witness "${w}" — поле "${field}" не в ${entityType}`,
              detail: `Свидетельство ссылается на поле, которого нет в онтологии` });
          }
        }
      }
    }
  }

  // === 7. Алгебра композиции (через algebra graph) ===
  // ⊥-пары из excluding рёбер становятся error'ами. Итерируем только с
  // одной стороны (id < otherId), чтобы избежать дубликации симметричных пар.
  for (const [id, relations] of Object.entries(algebra)) {
    for (const otherId of relations.excluding) {
      if (id >= otherId) continue;
      issues.push({
        rule: "algebra_composition",
        level: "error",
        intent: `${id} ⊗ ${otherId}`,
        message: `⊥ Конфликт: ${INTENTS[id].name} × ${INTENTS[otherId].name}`,
        detail: `Effects конфликтуют по таблице композиции (§11)`
      });
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
