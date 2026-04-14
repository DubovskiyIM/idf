/**
 * voiceMaterializer — §1 manifesto: «voice» как 4-я равноправная
 * материализация проекции, наравне с pixels / agent-API / document.
 *
 * Превращает артефакт v2 (projection + world + viewer) в structured
 * speech-script: последовательность turns для voice-agent (LLM
 * realtime), TTS-движка (SSML) или phone-IVR (plain-text).
 *
 * Контракт voice-графа:
 *   {
 *     title, subtitle,
 *     meta: { date, viewer, domain, projection, materialization: "voice", locale },
 *     turns: [
 *       { role: "system", text: "..." },       // контекст для LLM / intro
 *       { role: "assistant", text: "...", ssml?: "..." },  // что озвучить
 *       { role: "prompts", items: [            // что ожидаем услышать
 *         { intentId, text, keywords, confirmation }
 *       ]},
 *     ],
 *     footer: { note }
 *   }
 *
 * Три формата output:
 *   - json  — structured turns (для voice-agent: Claude Voice, OpenAI realtime)
 *   - ssml  — XML с <break/>, <prosody>, <say-as> для TTS engines
 *   - plain — текст без разметки (для debug / IVR baseline)
 *
 * Brevity principles для voice (иначе пользователь повесит трубку):
 *   - Top 3-5 items в catalog, остальное «и ещё N»
 *   - Fields в priority order: title → witness-1 → witness-2 → «...»
 *   - Intent prompts: только primary actions, не все toolbar-buttons
 *   - Даты/деньги читаются human-friendly (не "1700000 руб.")
 */

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

function findCollection(world, entityName) {
  if (!entityName) return [];
  const candidates = [pluralize(entityName.toLowerCase())];
  const segs = entityName.match(/[A-Z][a-z]*/g) || [];
  if (segs.length > 1) candidates.push(pluralize(segs[segs.length - 1].toLowerCase()));
  for (const c of candidates) if (Array.isArray(world[c])) return world[c];
  return [];
}

function evalFilter(expr, item, viewer) {
  if (!expr) return true;
  try {
    const keys = Object.keys(item);
    const fn = new Function(...keys, "viewer", `return !!(${expr})`);
    return fn(...keys.map(k => item[k]), viewer);
  } catch {
    return true;
  }
}

/**
 * Human-friendly форматирование для TTS.
 * 100000 → "сто тысяч рублей" проще чем "100000 руб.".
 */
function speakValue(val, fieldName) {
  if (val == null || val === "") return "не указано";

  // Timestamp
  if (typeof val === "number" && val > 1e12 && /[Aa]t$|timestamp/.test(fieldName || "")) {
    const date = new Date(val);
    return date.toLocaleDateString("ru", { day: "numeric", month: "long" });
  }

  // Money
  if (typeof val === "number" && /[Aa]mount|[Pp]rice|[Tt]otal|pnl|fee|value/.test(fieldName || "")) {
    return speakMoney(val);
  }

  // Percentage
  if (typeof val === "number" && /percent|rate|progress|allocation/.test(fieldName || "")) {
    return `${Math.round(val)} процентов`;
  }

  return String(val);
}

function speakMoney(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "минус " : "";
  if (abs >= 1_000_000) {
    const mil = (abs / 1_000_000).toFixed(1).replace(".0", "");
    return `${sign}${mil} миллионов рублей`;
  }
  if (abs >= 1_000) {
    const thousands = Math.round(abs / 1_000);
    return `${sign}${thousands} тысяч рублей`;
  }
  return `${sign}${Math.round(abs)} рублей`;
}

function humanizeFieldName(name, labels = {}) {
  if (labels[name]) return labels[name];
  return name.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
}

/**
 * Читаемое имя поля → русский label. Domain-agnostic словарь.
 */
const RU_FIELD_LABELS = {
  name: "название",
  title: "заголовок",
  status: "статус",
  baseCurrency: "валюта",
  totalValue: "стоимость",
  pnl: "прибыль",
  riskProfile: "профиль риска",
  quantity: "количество",
  price: "цена",
  deadline: "срок",
  createdAt: "создано",
  targetAmount: "цель",
};

// ───────────────────────────────────────────────────────────
// Архетип-specific materializers
// ───────────────────────────────────────────────────────────

const TOP_ITEMS = 3; // сколько элементов catalog озвучивать перед "и ещё N"

function voiceCatalog(projection, world, viewer) {
  const rows = findCollection(world, projection.mainEntity);
  const filtered = projection.filter
    ? rows.filter(r => evalFilter(projection.filter, r, viewer))
    : rows;

  const witnesses = (projection.witnesses || []).slice(0, 3); // top-3 fields для brevity
  const total = filtered.length;

  if (total === 0) {
    return [{
      role: "assistant",
      text: `В разделе «${projection.name || projection.mainEntity}» пока ничего нет.`,
    }];
  }

  const top = filtered.slice(0, TOP_ITEMS);
  const rest = total - top.length;

  let intro = `В разделе «${projection.name || projection.mainEntity}» ${speakCount(total)}. `;

  const itemTexts = top.map((r, i) => {
    const titleField = r.name || r.title || r.ticker || r.id;
    const keyFacts = witnesses
      .filter(w => w !== "name" && w !== "title")
      .slice(0, 2)
      .map(w => `${humanizeFieldName(w, RU_FIELD_LABELS)} — ${speakValue(r[w], w)}`);
    return `${ordinal(i + 1)}: ${titleField}${keyFacts.length ? ". " + keyFacts.join(", ") : ""}`;
  });

  let body = itemTexts.join(". ");
  if (rest > 0) {
    body += `. И ещё ${rest}.`;
  }

  return [{ role: "assistant", text: intro + body }];
}

function voiceDetail(projection, world, viewer, routeParams) {
  const rows = findCollection(world, projection.mainEntity);
  const idParam = projection.idParam;
  const targetId = routeParams[idParam];
  const mainRow = targetId ? rows.find(r => r.id === targetId) : rows[0];

  if (!mainRow) {
    return [{ role: "assistant",
      text: `Сущность ${projection.mainEntity} не найдена.` }];
  }

  const titleField = mainRow.name || mainRow.title || mainRow.ticker || projection.mainEntity;
  const witnesses = (projection.witnesses || []).slice(0, 4);

  const facts = witnesses
    .filter(w => w !== "name" && w !== "title")
    .map(w => `${humanizeFieldName(w, RU_FIELD_LABELS)}: ${speakValue(mainRow[w], w)}`)
    .join(". ");

  const subCount = (projection.subCollections || []).length;
  const subNote = subCount > 0
    ? ` Есть ${speakSubCount(subCount)} со связанными данными.`
    : "";

  return [{
    role: "assistant",
    text: `${titleField}. ${facts}.${subNote}`,
  }];
}

function voiceFeed(projection, world, viewer) {
  const rows = findCollection(world, projection.mainEntity);
  const filtered = projection.filter
    ? rows.filter(r => evalFilter(projection.filter, r, viewer))
    : rows;
  const sorted = [...filtered].reverse(); // newest first (простая эвристика)

  if (sorted.length === 0) {
    return [{ role: "assistant", text: `Новых событий в «${projection.name}» нет.` }];
  }

  const top = sorted.slice(0, TOP_ITEMS);
  const rest = sorted.length - top.length;
  const items = top.map(r => {
    const summary = r.message || r.title || r.name || r.content || r.id;
    return String(summary).slice(0, 60);
  });

  let text = `В ленте «${projection.name}» ${speakCount(sorted.length)}. `;
  text += items.map((t, i) => `${ordinal(i + 1)}: ${t}`).join(". ");
  if (rest > 0) text += `. И ещё ${rest}.`;

  return [{ role: "assistant", text }];
}

function voiceDashboard(projection, world, viewer, allProjections) {
  const embedded = projection.embedded || [];
  const turns = [{
    role: "assistant",
    text: `Обзор «${projection.name}». Объединяет ${speakCount(embedded.length, "раздел")}.`,
  }];

  for (const emb of embedded.slice(0, 3)) {
    const sub = allProjections?.[emb.projection];
    if (!sub) continue;
    if (sub.kind === "catalog" || sub.kind === "feed") {
      turns.push(...voiceCatalog(sub, world, viewer));
    }
  }

  return turns;
}

function voiceWizard(projection, world, viewer) {
  const steps = projection.steps || [];
  if (steps.length === 0) {
    return [{ role: "assistant", text: `Мастер «${projection.name}» не настроен.` }];
  }
  const firstStep = steps[0];
  return [
    {
      role: "assistant",
      text: `Мастер «${projection.name}». Шаг ${1} из ${steps.length}: ${firstStep.label || firstStep.id}.`,
    },
    {
      role: "system",
      text: "Wizard — интерактивный flow. Полный голосовой диалог требует turn-by-turn session с сохранением collected state.",
    },
  ];
}

// ───────────────────────────────────────────────────────────
// Intent prompts — что пользователь может сказать
// ───────────────────────────────────────────────────────────

function extractPrompts(projection, ontology, viewerRole) {
  // Генерируем список intent prompts из projection.entities +
  // ontology.roles[viewerRole].canExecute. В voice-контексте —
  // top 5 по priority (primary variant → все, остальное — скип).
  const canExec = ontology?.roles?.[viewerRole]?.canExecute || [];
  const intents = ontology?.intents;
  if (!intents) {
    // Нет intent-определений на сервере — fallback короткий список
    return canExec.slice(0, 5).map(id => ({
      intentId: id,
      text: humanizeFieldName(id).toLowerCase(),
      keywords: [id.replace(/_/g, " ")],
    }));
  }

  return canExec.slice(0, 5).map(id => {
    const intent = intents[id];
    return {
      intentId: id,
      text: intent?.name || humanizeFieldName(id),
      keywords: [id.replace(/_/g, " "), (intent?.name || "").toLowerCase()].filter(Boolean),
      confirmation: intent?.particles?.effects?.length > 0 ? "enter" : undefined,
    };
  });
}

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

function speakCount(n, singular = "элемент") {
  const plural = singular === "элемент" ? "элементов" : "разделов";
  if (n === 0) return `ни одного ${singular}а`;
  if (n === 1) return `один ${singular}`;
  if (n >= 2 && n <= 4) return `${n} ${singular}а`;
  return `${n} ${plural}`;
}

function speakSubCount(n) {
  if (n === 1) return "одна секция";
  if (n >= 2 && n <= 4) return `${n} секции`;
  return `${n} секций`;
}

function ordinal(n) {
  return ["первый", "второй", "третий", "четвёртый", "пятый"][n - 1] || `${n}-й`;
}

// ───────────────────────────────────────────────────────────
// Main entry
// ───────────────────────────────────────────────────────────

function materializeAsVoice(projection, world, viewer, opts = {}) {
  const { allProjections = {}, routeParams = {}, domain = "", ontology = {}, viewerRole = "owner" } = opts;
  const now = new Date();

  const script = {
    title: projection.name || projection.id || "Проекция",
    subtitle: domain ? `домен ${domain}` : "",
    meta: {
      date: now.toISOString(),
      viewer: viewer?.name || viewer?.id || "—",
      domain,
      projection: projection.id || null,
      materialization: "voice",
      locale: opts.locale || "ru-RU",
      generator: "IDF voiceMaterializer v1",
    },
    turns: [
      {
        role: "system",
        text: `Ты — голосовой ассистент для домена «${domain}». Говори кратко, дружелюбно, на русском. Пользователь: ${viewer?.name || "клиент"}.`,
      },
    ],
    footer: {
      note: "Голосовой скрипт сгенерирован из Φ-журнала (§1, voice — 4-я базовая материализация).",
    },
  };

  let bodyTurns;
  switch (projection.kind) {
    case "catalog":
      bodyTurns = voiceCatalog(projection, world, viewer);
      break;
    case "feed":
      bodyTurns = voiceFeed(projection, world, viewer);
      break;
    case "detail":
      bodyTurns = voiceDetail(projection, world, viewer, routeParams);
      break;
    case "dashboard":
      bodyTurns = voiceDashboard(projection, world, viewer, allProjections);
      break;
    case "wizard":
      bodyTurns = voiceWizard(projection, world, viewer);
      break;
    case "canvas":
      bodyTurns = [{ role: "assistant",
        text: `Раздел «${projection.name}» содержит визуальную аналитику. Полный голосовой рендер требует custom voice-компонент.` }];
      break;
    default:
      bodyTurns = [{ role: "assistant", text: `Неизвестный архетип ${projection.kind}.` }];
  }

  script.turns.push(...bodyTurns);

  // Intent prompts — что можно сказать в ответ
  const prompts = extractPrompts(projection, ontology, viewerRole);
  if (prompts.length > 0) {
    script.turns.push({ role: "prompts", items: prompts });
  }

  return script;
}

// ───────────────────────────────────────────────────────────
// Renderers: SSML + plain
// ───────────────────────────────────────────────────────────

function escapeXml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[c]));
}

/**
 * SSML-рендер для TTS engines (Amazon Polly, Google Cloud TTS, Yandex
 * SpeechKit). Включает <break/> между turns, <prosody> для интонации.
 */
function renderVoiceSsml(script) {
  const speakTurns = script.turns.filter(t => t.role === "assistant");
  const body = speakTurns.map(t => {
    const text = t.ssml || escapeXml(t.text);
    return `  <p>${text}</p>\n  <break time="400ms"/>`;
  }).join("\n");

  return `<?xml version="1.0"?>
<speak xml:lang="${script.meta.locale}">
  <prosody rate="medium">
${body}
  </prosody>
</speak>`;
}

/**
 * Plain-text рендер — для debug / phone-IVR baseline / лог.
 */
function renderVoicePlain(script) {
  const lines = [
    `# ${script.title}`,
    `[${script.meta.materialization} · ${script.meta.locale} · viewer: ${script.meta.viewer}]`,
    "",
  ];
  for (const turn of script.turns) {
    if (turn.role === "prompts") {
      lines.push("[пользователь может сказать:]");
      for (const p of turn.items) {
        lines.push(`  — ${p.text}`);
      }
    } else {
      lines.push(`[${turn.role}] ${turn.text}`);
    }
  }
  return lines.join("\n");
}

module.exports = { materializeAsVoice, renderVoiceSsml, renderVoicePlain };
