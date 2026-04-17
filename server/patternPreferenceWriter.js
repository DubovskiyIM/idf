/**
 * patternPreferenceWriter — AST-safe codemod для projections.js.
 *
 * Назначение (§3.4 plan-B4, §16 манифест): UI Pattern Inspector отправляет
 * author-decision (enable / disable / clear паттерн для конкретной проекции)
 * через POST /api/patterns/preference. Это решение — не снимок артефакта,
 * а preference — должно дописываться в исходник `src/domains/<domain>/projections.js`,
 * потому что комбинация `patterns.{enabled,disabled}` — часть декларации
 * проекции, читаемая кристаллизатором и реестром паттернов.
 *
 * Подход: recast 0.23 — печатает только изменённые узлы AST, остальной текст
 * остаётся байтово-идентичным (сохраняются комментарии, отступы, trailing
 * запятые). Это важно: проекции содержат много комментариев и TODO-меток.
 *
 * API (CJS для совместимости с server/*): module.exports = { writePatternPreference }.
 *
 * Контракт writePatternPreference(filePath, projectionId, patternId, action):
 *   - action ∈ { "enable" | "disable" | "clear" }
 *   - ensures: у проекции есть patterns: { enabled: [], disabled: [] }
 *   - enable: удаляет из disabled, добавляет в enabled (idempotent)
 *   - disable: удаляет из enabled, добавляет в disabled
 *   - clear: удаляет из обоих списков
 *   - throws: unknown action | projection not found
 *
 * Tolerance:
 *   - ключ объекта может быть Identifier (key.name) или StringLiteral (key.value)
 *     — зависит от того, кавычками ли оригинал писался.
 *   - элемент массива может быть Literal или StringLiteral — зависит от парсера
 *     (esprima vs babel). recast 0.23 по умолчанию — esprima → Literal, но мы
 *     добавляем через builders.stringLiteral для консистентности со спекой.
 */

const fs = require("node:fs");
const recast = require("recast");

const ACTIONS = new Set(["enable", "disable", "clear"]);

const keyName = (node) => {
  if (!node || !node.key) return null;
  return node.key.name || node.key.value || null;
};

const isStringElement = (el, value) => {
  if (!el) return false;
  if (el.type === "Literal" && el.value === value) return true;
  if (el.type === "StringLiteral" && el.value === value) return true;
  return false;
};

function writePatternPreference(filePath, projectionId, patternId, action) {
  if (!ACTIONS.has(action)) {
    throw new Error(`Unknown action: ${action}`);
  }

  const source = fs.readFileSync(filePath, "utf8");
  const ast = recast.parse(source);
  const b = recast.types.builders;

  let modified = false;

  // NB: recast 0.23 использует esprima по умолчанию — ESTree-шка узлов называет
  // property-узлы как `Property` (не `ObjectProperty`, как в Babel). Visitor
  // имя соответствует node.type; поддерживаем оба варианта на случай смены
  // парсера (recast/babel-parser имеет другую форму AST).
  const visitor = function (path) {
      const node = path.node;
      const key = keyName(node);
      if (key !== projectionId) return this.traverse(path);

      const projValue = node.value;
      if (!projValue || projValue.type !== "ObjectExpression") {
        return false;
      }

      // Найти / создать patterns: { enabled: [], disabled: [] }
      let patternsProp = projValue.properties.find(
        (p) => keyName(p) === "patterns",
      );
      if (!patternsProp) {
        patternsProp = b.objectProperty(
          b.identifier("patterns"),
          b.objectExpression([
            b.objectProperty(b.identifier("enabled"), b.arrayExpression([])),
            b.objectProperty(b.identifier("disabled"), b.arrayExpression([])),
          ]),
        );
        projValue.properties.push(patternsProp);
      }

      const pObj = patternsProp.value;
      if (!pObj || pObj.type !== "ObjectExpression") {
        throw new Error(
          `projection ${projectionId}.patterns — ожидался ObjectExpression`,
        );
      }

      let enabled = pObj.properties.find((p) => keyName(p) === "enabled");
      let disabled = pObj.properties.find((p) => keyName(p) === "disabled");
      if (!enabled) {
        enabled = b.objectProperty(
          b.identifier("enabled"),
          b.arrayExpression([]),
        );
        pObj.properties.push(enabled);
      }
      if (!disabled) {
        disabled = b.objectProperty(
          b.identifier("disabled"),
          b.arrayExpression([]),
        );
        pObj.properties.push(disabled);
      }

      const removeFrom = (arrProp) => {
        arrProp.value.elements = arrProp.value.elements.filter(
          (el) => !isStringElement(el, patternId),
        );
      };
      const addTo = (arrProp) => {
        const hasIt = arrProp.value.elements.some((el) =>
          isStringElement(el, patternId),
        );
        if (!hasIt) arrProp.value.elements.push(b.stringLiteral(patternId));
      };

      if (action === "enable") {
        removeFrom(disabled);
        addTo(enabled);
      } else if (action === "disable") {
        removeFrom(enabled);
        addTo(disabled);
      } else {
        // clear
        removeFrom(enabled);
        removeFrom(disabled);
      }

      modified = true;
      return false;
    };

  recast.types.visit(ast, {
    visitProperty: visitor,
    visitObjectProperty: visitor,
  });

  if (!modified) {
    throw new Error(`Projection ${projectionId} not found in ${filePath}`);
  }

  fs.writeFileSync(filePath, recast.print(ast).code);
}

module.exports = { writePatternPreference };
