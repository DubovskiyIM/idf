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
import { normalizeCreates } from "./assignToSlotsShared.js";

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
  registerBulkWizard();
  registerHeroCreate();
  registerCustomCapture();
}

/**
 * Выбрать control-архетип для намерения.
 * @param context — опциональный контекст, в котором может быть projection
 *   (customCapture.entityPicker использует его для проверки route scope).
 * @returns {object|null} архетип или null, если ни одно правило не сработало
 */
export function selectArchetype(intent, intentId, context = {}) {
  // 1. Explicit override
  if (intent.control) {
    return ARCHETYPES.find(a => a.id === intent.control) || null;
  }
  // 2. Эвристика — первое совпадение
  for (const a of ARCHETYPES) {
    if (a.match(intent, intentId, context)) return a;
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
          title: intent.name,
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
          title: intent.name,
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

// ============================================================
// heroCreate — inline-создатель главной сущности (planning M4)
// ============================================================

/**
 * heroCreate: большой input + primary button в catalog-проекции для
 * быстрого создания mainEntity. Заменяет fab+formModal для простых
 * creator-интентов с одним текстовым параметром.
 *
 * Match: intent.creates === projection.mainEntity + ровно один простой
 * текстовый параметр (после inferParameters). Размещается в слоте hero
 * (новый для catalog-архетипа, между toolbar и body).
 *
 * Это UX-паттерн «hero-input для быстрого создания» — из todo-list, trello,
 * slack каналов. Пользователь печатает название и жмёт Enter/кнопку,
 * не открывая модал.
 */
function registerHeroCreate() {
  const TEXT_CONTROLS = new Set(["text", "email", "tel", "url", undefined, null]);

  prependArchetype({
    id: "heroCreate",
    match: (intent, intentId, context) => {
      const creates = normalizeCreates(intent.creates);
      if (!creates) return false;
      const mainEntity = context?.projection?.mainEntity;
      if (!mainEntity || creates !== mainEntity) return false;
      // Должна быть catalog-проекция
      if (context?.projection?.kind !== "catalog") return false;
      // Если автор явно попросил другое (confirmation:form с несколькими
      // полями) — не перехватываем.
      const c = intent.particles?.confirmation;
      if (c === "form" && intent.parameters && intent.parameters.length > 1) return false;
      return true;
    },
    build: (intent, intentId, parameters) => {
      // Выбор параметра:
      //   1. title/name — приоритетные «человеческие» имена
      //   2. первый text-параметр (не foreign key — его inferParameters
      //      уже отсек)
      //   3. fallback "title"
      const params = parameters || [];
      const byName = params.find(p => p.name === "title" || p.name === "name");
      const byType = params.find(p => TEXT_CONTROLS.has(p.control));
      const chosen = byName || byType;
      const paramName = chosen?.name || "title";
      const placeholder = intent.placeholder || "Название…";
      return {
        type: "heroCreate",
        intentId,
        paramName,
        placeholder,
        buttonLabel: intent.name,
        icon: getIntentIcon(intentId, intent),
      };
    },
  });
}

// ============================================================
// customCapture — кастомные виджеты захвата (M3.5b)
// ============================================================

/**
 * Match-правила для customCapture. Дублируются в реестре runtime-виджетов
 * (src/runtime/renderer/controls/capture/*.jsx) — кристаллизатор не импортирует
 * React-компоненты, runtime не импортирует кристаллизатор. Оба источника
 * правды должны быть согласованы руками.
 */
const CAPTURE_RULES = [
  {
    widgetId: "voiceRecorder",
    match: (intent) => {
      const w = intent.particles?.witnesses || [];
      return w.includes("recording_duration") || w.includes("duration");
    },
  },
  {
    widgetId: "emojiPicker",
    match: (intent, intentId) =>
      intentId.startsWith("react_") ||
      (intent.particles?.witnesses || []).includes("available_reactions"),
  },
  {
    widgetId: "entityPicker",
    match: (_intent, intentId) => intentId === "forward_message",
  },
  {
    widgetId: "entityPicker",
    match: (intent, intentId, context) => {
      const creates = normalizeCreates(intent.creates);
      if (!creates) return false;
      const entities = (intent.particles?.entities || [])
        .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
      const nonCreates = entities.filter(e => e !== creates);
      if (nonCreates.length === 0) return false;
      // Если все non-creates уже в route scope проекции — picker не нужен
      // (send_message имеет Conversation в route chat_view → composer).
      const projection = context?.projection;
      if (projection) {
        const routeScope = new Set(
          projection.routeEntities
            ? [projection.mainEntity, ...projection.routeEntities].filter(Boolean)
            : (projection.entities || [])
        );
        if (projection.mainEntity) routeScope.add(projection.mainEntity);
        return nonCreates.some(e => !routeScope.has(e));
      }
      return true;
    },
  },
];

/**
 * Парсинг декларации entity: "alias: Entity" → { alias, entity }.
 * Возвращает массив всех entity у intent'а.
 */
function parseEntities(intent) {
  return (intent.particles?.entities || []).map(raw => {
    const [aliasPart, entityPart] = raw.split(":").map(s => s.trim());
    if (entityPart) {
      return {
        alias: aliasPart,
        entity: entityPart.replace(/\[\]$/, ""),
      };
    }
    // Без двоеточия — имя == alias
    const clean = aliasPart.replace(/\[\]$/, "");
    return { alias: clean.toLowerCase(), entity: clean };
  });
}

function pluralizeLower(word) {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  if (lower.endsWith("s")) return lower + "es";
  return lower + "s";
}

/**
 * Регистрация customCapture в начало списка, чтобы он ловил матчи до
 * общих правил (composerEntry/formModal/clickForm).
 */
function registerCustomCapture() {
  prependArchetype({
    id: "customCapture",
    match: (intent, intentId, context) =>
      CAPTURE_RULES.some(r => r.match(intent, intentId, context)),
    build: (intent, intentId, _parameters, context) => {
      const rule = CAPTURE_RULES.find(r => r.match(intent, intentId, context));
      const widgetId = rule.widgetId;

      // Для entityPicker — определить targetEntity (не-creates entity)
      let extras = {};
      if (widgetId === "entityPicker") {
        const entities = parseEntities(intent);
        const creates = normalizeCreates(intent.creates);
        const target = entities.find(e => e.entity !== creates);
        if (target) {
          extras = {
            targetEntity: target.entity,
            targetAlias: target.alias,
            targetCollection: pluralizeLower(target.entity),
            entityLabel: target.entity,
          };
        }
      }

      const key = `overlay_${intentId}`;
      return {
        trigger: {
          type: "intentButton",
          intentId,
          label: intent.name,
          icon: getIntentIcon(intentId, intent),
          opens: "overlay",
          overlayKey: key,
        },
        overlay: {
          type: "customCapture",
          key,
          widgetId,
          intentId,
          label: intent.name,
          ...extras,
        },
      };
    },
  });
}

// ============================================================
// bulkWizard — массовые операции (extended: true) — M3.6
// ============================================================

/**
 * bulkWizard перехватывает intents с `extended: true` — массовые операции
 * вроде bulk_delete_messages, import_contacts. Работает в оверлее с
 * многошаговым UI (select → summary → progress → done). Регистрируется
 * prepend'ом, чтобы перехватить раньше обычных confirmation-архетипов.
 */
function registerBulkWizard() {
  prependArchetype({
    id: "bulkWizard",
    match: (intent) => intent.extended === true,
    build: (intent, intentId) => {
      const key = `overlay_${intentId}`;
      // Источник коллекции: базовая часть target первого effect'а.
      // Для bulk_delete_messages → effects: replace message.deletedFor →
      // source: "messages".
      const firstEffect = intent.particles?.effects?.[0];
      const targetBase = firstEffect?.target?.split(".")[0] || "items";
      const source = targetBase.endsWith("s") ? targetBase + "es" : targetBase + "s";

      return {
        trigger: {
          type: "intentButton",
          intentId,
          label: intent.name,
          icon: getIntentIcon(intentId, intent),
          opens: "overlay",
          overlayKey: key,
        },
        overlay: {
          type: "bulkWizard",
          key,
          triggerIntentId: intentId,
          label: intent.name,
          source,
          filter: intent.bulkFilter || null,
        },
      };
    },
  });
}

// Инициализация: зарегистрировать встроенные архетипы при загрузке модуля.
// Порядок: базовые → bulkWizard → heroCreate → customCapture (все prepend).
// В итоге: customCapture первый, heroCreate второй, bulkWizard третий.
// heroCreate должен идти раньше базовых (clickForm/formModal), чтобы
// перехватить простые create-интенты в catalog.
registerBuiltins();
registerBulkWizard();
registerHeroCreate();
registerCustomCapture();
