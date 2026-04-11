/**
 * §1.3-1.4 дизайна: построение контрол-обёртки на основе control archetype.
 *
 * Логика вынесена в реестр controlArchetypes.js — здесь только диспетчер.
 * Правила регистрируются в самом реестре через registerArchetype/prependArchetype.
 * Добавление нового control-архетипа (inlineSearch, entityForm, customCapture
 * и т.п.) не требует изменений в этом файле.
 */

import { selectArchetype } from "./controlArchetypes.js";

export function wrapByConfirmation(intent, intentId, parameters) {
  const archetype = selectArchetype(intent, intentId);
  if (!archetype) return null;
  return archetype.build(intent, intentId, parameters);
}
