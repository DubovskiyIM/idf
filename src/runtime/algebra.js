/**
 * Алгебра композиции эффектов (раздел 11 манифеста).
 *
 * Проверяет совместимость α-типов при конкурентных эффектах на одну ячейку.
 * ⊥ = запрещённая пара, ловится при кристаллизации.
 */

// Таблица композиции: [α1][α2] → результат
// "ok" = совместимы, "conflict" = ⊥, "order" = зависит от причинного порядка
const COMPOSITION_TABLE = {
  replace:   { replace: "ok",       increment: "conflict", add: "conflict", remove: "conflict", batch: "ok" },
  increment: { replace: "conflict", increment: "ok",       add: "conflict", remove: "conflict", batch: "ok" },
  add:       { replace: "conflict", increment: "conflict", add: "ok",       remove: "order",    batch: "ok" },
  remove:    { replace: "conflict", increment: "conflict", add: "order",    remove: "ok",       batch: "ok" },
  batch:     { replace: "ok",       increment: "ok",       add: "ok",       remove: "ok",       batch: "ok" },
};

/**
 * Проверить совместимость двух эффектов.
 * @returns { compatible: boolean, resolution: string, detail: string }
 */
export function checkComposition(effect1, effect2) {
  // Только эффекты на одну и ту же ячейку (один target + один entity id)
  if (effect1.target !== effect2.target) return { compatible: true, resolution: "different_target" };

  const ctx1 = effect1.context || {};
  const ctx2 = effect2.context || {};
  if (ctx1.id && ctx2.id && ctx1.id !== ctx2.id) return { compatible: true, resolution: "different_entity" };

  const α1 = effect1.alpha;
  const α2 = effect2.alpha;

  const result = COMPOSITION_TABLE[α1]?.[α2];

  if (!result || result === "conflict") {
    return {
      compatible: false,
      resolution: "⊥",
      detail: `${α1} ⊗ ${α2} на ${effect1.target} = ⊥ (запрещённая пара)`,
      α1, α2, target: effect1.target,
    };
  }

  if (result === "order") {
    return {
      compatible: true,
      resolution: "causal_order",
      detail: `${α1} + ${α2} на ${effect1.target}: разрешается по причинному порядку (≺-поздний побеждает)`,
    };
  }

  if (α1 === "replace" && α2 === "replace") {
    return {
      compatible: true,
      resolution: "last_wins",
      detail: `replace + replace на ${effect1.target}: побеждает ≺-поздний`,
    };
  }

  if (α1 === "increment" && α2 === "increment") {
    return {
      compatible: true,
      resolution: "commutative",
      detail: `increment + increment: коммутативно (CRDT)`,
    };
  }

  return { compatible: true, resolution: "ok" };
}

/**
 * Проверить все пары эффектов в наборе намерений.
 * Находит потенциальные конфликты ⊥ между намерениями.
 */
export function checkAlgebraIntegrity(INTENTS) {
  const conflicts = [];
  const intentEntries = Object.entries(INTENTS);

  for (let i = 0; i < intentEntries.length; i++) {
    const [id1, intent1] = intentEntries[i];
    const effects1 = intent1.particles.effects || [];

    for (let j = i + 1; j < intentEntries.length; j++) {
      const [id2, intent2] = intentEntries[j];
      const effects2 = intent2.particles.effects || [];

      // Проверить каждую пару эффектов
      for (const ef1 of effects1) {
        for (const ef2 of effects2) {
          // Одинаковый target?
          const t1base = ef1.target.split(".")[0];
          const t2base = ef2.target.split(".")[0];
          if (t1base !== t2base) continue;

          // Проверить если это один и тот же field (для replace)
          if (ef1.target === ef2.target || ef1.target.includes(t2base) || ef2.target.includes(t1base)) {
            const result = checkComposition(
              { alpha: ef1.α, target: ef1.target, context: {} },
              { alpha: ef2.α, target: ef2.target, context: {} }
            );

            if (!result.compatible) {
              conflicts.push({
                intent1: id1, intent1Name: intent1.name,
                intent2: id2, intent2Name: intent2.name,
                ...result,
              });
            }
          }
        }
      }
    }
  }

  return conflicts;
}

// Примечание: был ранее `checkRuntimeConflicts(effects)` для runtime-проверки
// конкурентных эффектов, но ни один модуль его не вызывал (dead code).
// Удалён как часть ревизии границ реализации. Если понадобится runtime-проверка
// конфликтов — нужно интегрировать в server/validator.js или effect-pipeline.js.
