/**
 * Алгебра композиции эффектов (раздел 11 манифеста).
 *
 * Проверяет совместимость α-типов при конкурентных эффектах на одну ячейку.
 * ⊥ = запрещённая пара, ловится при кристаллизации.
 *
 * Note: α-типы `increment` и `cas` удалены из таблицы (Session A / Core
 * стабилизация). Они декларировались в раннем манифесте как аспирационные,
 * но за всё время прототипирования (152 намерения в 4 доменах) не нашлось
 * ни одного use-case, и `fold.js` их не обрабатывал. Если реальный кейс
 * появится (счётчики голосов как CRDT, оптимистичные блокировки для
 * сообщений) — вернуть обратно с полноценной реализацией в fold + тесты.
 */

// Таблица композиции: [α1][α2] → результат
// "ok" = совместимы, "conflict" = ⊥, "order" = зависит от причинного порядка
const COMPOSITION_TABLE = {
  replace:   { replace: "ok",       add: "conflict", remove: "conflict", batch: "ok" },
  add:       { replace: "conflict", add: "ok",       remove: "order",    batch: "ok" },
  remove:    { replace: "conflict", add: "order",    remove: "ok",       batch: "ok" },
  batch:     { replace: "ok",       add: "ok",       remove: "ok",       batch: "ok" },
};

/**
 * Проверить совместимость двух эффектов.
 *
 * Примитив, используемый intentAlgebra.deriveExcluding для построения
 * ⊕-графа. Раньше был также использован в checkAlgebraIntegrity, который
 * удалён в Session B (2026-04-12) как дубликат — intent-алгебра теперь
 * унифицирована в src/runtime/intentAlgebra.js.
 *
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

  return { compatible: true, resolution: "ok" };
}

// Примечание (Session B, 2026-04-12): функция checkAlgebraIntegrity
// удалена. Её функциональность — вычисление ⊕-графа между intent'ами —
// теперь живёт в src/runtime/intentAlgebra.js::deriveExcluding как часть
// унифицированного модуля intent-алгебры. Integrity.js rule #7 читает
// граф из computeAlgebra(...).excluding.
//
// Также был ранее `checkRuntimeConflicts(effects)` для runtime-проверки
// конкурентных эффектов, но ни один модуль его не вызывал (dead code).
// Удалён как часть ревизии границ реализации.
