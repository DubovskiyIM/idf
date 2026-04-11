/**
 * Реестр control-архетипов. Каждый архетип — это правило, как намерение
 * материализуется в UI-контрол. Порядок важен: первое совпадение побеждает.
 * Explicit `intent.control = "archetypeId"` имеет приоритет над эвристиками.
 *
 * М3.1 — первоклассный механизм, заменяющий жёстко зашитый switch в
 * wrapByConfirmation. Добавление нового control-архетипа (inlineSearch,
 * entityForm, customCapture и т.п.) теперь — одна registerArchetype запись,
 * без трогания центральной логики.
 */

import { getIntentIcon } from "./getIntentIcon.js";

// Встроенные архетипы (порядок определяет приоритет правил)
const ARCHETYPES = [];

/**
 * Зарегистрировать новый control-архетип.
 * archetype = { id, match(intent, intentId), build(intent, intentId, parameters) }
 * Возвращает архетип для удобства цепочек.
 */
export function registerArchetype(archetype) {
  if (!archetype?.id || typeof archetype.match !== "function" || typeof archetype.build !== "function") {
    throw new Error("registerArchetype: archetype must have { id, match, build }");
  }
  ARCHETYPES.push(archetype);
  return archetype;
}

/**
 * Зарегистрировать архетип в начало списка (высокий приоритет).
 * Используется для customCapture, которая должна перехватывать до общих правил.
 */
export function prependArchetype(archetype) {
  if (!archetype?.id || typeof archetype.match !== "function" || typeof archetype.build !== "function") {
    throw new Error("prependArchetype: archetype must have { id, match, build }");
  }
  ARCHETYPES.unshift(archetype);
  return archetype;
}

export function getArchetypes() {
  return ARCHETYPES.slice();
}

/**
 * Для тестов — очистить реестр и повторно зарегистрировать встроенные.
 */
export function _resetArchetypes() {
  ARCHETYPES.length = 0;
  registerBuiltins();
}

/**
 * Выбрать control-архетип для намерения.
 * @returns {object|null} архетип или null, если ни одно правило не сработало
 */
export function selectArchetype(intent, intentId) {
  // 1. Explicit override
  if (intent.control) {
    return ARCHETYPES.find(a => a.id === intent.control) || null;
  }
  // 2. Эвристика — первое совпадение
  for (const a of ARCHETYPES) {
    if (a.match(intent, intentId)) return a;
  }
  return null;
}

// ============================================================
// Встроенные архетипы
// ============================================================

function registerBuiltins() {
  // "auto" confirmation — нет UI
  registerArchetype({
    id: "auto",
    match: (intent) => intent.particles?.confirmation === "auto",
    build: () => null,
  });

  // inlineSearch — зарегистрирован до composerEntry/formModal, чтобы
  // ловить search-паттерн первым. Эвристика: entities пусто, witnesses
  // включают "query" и "results". Materialized как inline-инпут в toolbar,
  // связанный с ctx.viewState через paramName (обычно "query").
  //
  // viewState — параметры запроса проекции (§5 манифеста, расширение M3).
  // Не участвуют в World(t), живут в сессии рендерера.
  registerArchetype({
    id: "inlineSearch",
    match: (intent) => {
      const witnesses = intent.particles?.witnesses || [];
      const entities = intent.particles?.entities || [];
      return entities.length === 0 &&
             witnesses.includes("query") &&
             witnesses.includes("results");
    },
    build: (intent, intentId, parameters) => ({
      type: "inlineSearch",
      intentId,
      paramName: parameters.find(p => p.name === "query")?.name || "query",
      label: intent.name,
      icon: "🔍",
      placeholder: intent.parameters?.[0]?.placeholder || "Поиск…",
    }),
  });

  // "enter" + creates — composer entry (для feed-архетипа)
  registerArchetype({
    id: "composerEntry",
    match: (intent) => intent.particles?.confirmation === "enter",
    build: (intent, intentId, parameters) => ({
      type: "composerEntry",
      intentId,
      primaryParameter: parameters[0]?.name || "text",
      label: intent.name,
      icon: getIntentIcon(intentId, intent),
    }),
  });

  // irreversibility: high/medium — confirmDialog с trigger
  registerArchetype({
    id: "confirmDialog",
    match: (intent) => intent.irreversibility === "high" || intent.irreversibility === "medium",
    build: (intent, intentId, parameters) => {
      const key = `overlay_${intentId}`;
      const baseButton = {
        type: "intentButton",
        intentId,
        label: intent.name,
        icon: getIntentIcon(intentId, intent),
      };
      if (intent.antagonist) baseButton.antagonist = intent.antagonist;

      return {
        trigger: { ...baseButton, opens: "overlay", overlayKey: key },
        overlay: {
          type: "confirmDialog",
          key,
          triggerIntentId: intentId,
          irreversibility: intent.irreversibility,
          message: buildConfirmMessage(intent),
          confirmBy: intent.irreversibility === "high"
            ? { type: "typeText", expected: firstEntityField(intent) || "delete" }
            : { type: "button" },
        },
        antagonist: intent.antagonist,
      };
    },
  });

  // "form" c параметрами — formModal
  registerArchetype({
    id: "formModal",
    match: (intent) => intent.particles?.confirmation === "form",
    build: (intent, intentId, parameters) => {
      const key = `overlay_${intentId}`;
      const baseButton = {
        type: "intentButton",
        intentId,
        label: intent.name,
        icon: getIntentIcon(intentId, intent),
      };
      if (intent.antagonist) baseButton.antagonist = intent.antagonist;

      return {
        trigger: { ...baseButton, opens: "overlay", overlayKey: key },
        overlay: {
          type: "formModal",
          key,
          intentId,
          witnessPanel: (intent.particles.witnesses || [])
            .filter(w => w.includes("."))
            .map(w => ({ type: "text", bind: w })),
          parameters,
        },
        antagonist: intent.antagonist,
      };
    },
  });

  // "click" — plain button ИЛИ formModal если есть параметры (phase:investigation)
  registerArchetype({
    id: "clickForm",
    match: (intent) => intent.particles?.confirmation === "click",
    build: (intent, intentId, parameters) => {
      const baseButton = {
        type: "intentButton",
        intentId,
        label: intent.name,
        icon: getIntentIcon(intentId, intent),
      };
      if (intent.antagonist) baseButton.antagonist = intent.antagonist;

      if (parameters.length === 0) {
        return baseButton;
      }

      // С параметрами — открывается formModal (например, edit_message с
      // phase:investigation + editable параметром content)
      const key = `overlay_${intentId}`;
      return {
        trigger: { ...baseButton, opens: "overlay", overlayKey: key },
        overlay: {
          type: "formModal",
          key,
          intentId,
          witnessPanel: (intent.particles.witnesses || [])
            .filter(w => w.includes("."))
            .map(w => ({ type: "text", bind: w })),
          parameters,
        },
        antagonist: intent.antagonist,
      };
    },
  });

  // "file" — file picker с автоматическим вызовом exec при выборе файла
  registerArchetype({
    id: "filePicker",
    match: (intent) => intent.particles?.confirmation === "file",
    build: (intent, intentId, parameters) => ({
      type: "intentButton",
      intentId,
      label: intent.name,
      icon: getIntentIcon(intentId, intent),
      filePicker: true,
      parameters,
    }),
  });
}

function firstEntityField(intent) {
  const witnesses = intent.particles?.witnesses || [];
  const dotted = witnesses.find(w => w.includes("."));
  return dotted || null;
}

function buildConfirmMessage(intent) {
  const witnesses = intent.particles?.witnesses || [];
  const preview = witnesses.filter(w => w.includes(".")).map(w => `{${w}}`).join(", ");
  return `${intent.name}${preview ? ": " + preview : ""}?`;
}

// Инициализация: зарегистрировать встроенные архетипы при загрузке модуля
registerBuiltins();
