#!/usr/bin/env node
/**
 * CLI: LLM enrichment для артефактов кристаллизации.
 *
 * Использование:
 *   ANTHROPIC_API_KEY=sk-... node scripts/crystallize-llm.mjs [domain] [projection]
 *
 * Без аргументов — обогащает все артефакты всех доменов.
 * С domain — все артефакты одного домена.
 * С domain + projection — один артефакт.
 *
 * Требует работающий сервер (npm run server) для кеширования.
 * Если сервер не запущен — работает standalone через прямой API call.
 */

import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY не задан. Использование:");
  console.error("   ANTHROPIC_API_KEY=sk-... node scripts/crystallize-llm.mjs [domain] [projection]");
  process.exit(1);
}

const [,, domainFilter, projectionFilter] = process.argv;

// Динамический импорт доменов
const domains = {
  booking: () => import("../src/domains/booking/domain.js"),
  planning: () => import("../src/domains/planning/domain.js"),
  workflow: () => import("../src/domains/workflow/domain.js"),
  messenger: () => import("../src/domains/messenger/domain.js"),
  meshok: () => import("../src/domains/meshok/domain.js"),
};

const { crystallizeV2 } = await import("../src/runtime/crystallize_v2/index.js");

const SYSTEM_PROMPT = `Ты — LLM-обогатитель артефактов кристаллизации IDF.

Вход: JSON артефакт v2 + онтология домена.

Задача: обогатить артефакт человеко-читаемыми элементами на русском языке:
- label для каждого intent-button в toolbar/body/overlay (глагол в инфинитиве: "Оставить отзыв", "Сделать ставку")
- placeholder для каждого параметра в formModal/composer/form (подсказка: "Введите сумму ставки")
- hint для параметров где полезно (пояснение: "Минимум на 1₽ выше текущей цены")
- icon (emoji) для intent-buttons — контекстно уместный
- emptyState для body.type=list — текст при пустом списке ("Пока нет ставок. Будьте первым!")
- Порядок toolbar: primary actions первыми, destructive последними

Ограничения:
- НЕ менять structure (keys, nesting, types слотов)
- НЕ менять archetype, version, nav, conditions, parameter types
- НЕ добавлять новые slots или controls
- Только обогащение существующих полей
- Ответ — ТОЛЬКО валидный JSON, без markdown, без комментариев`;

const client = new Anthropic({ apiKey: API_KEY });

async function enrichArtifact(artifact, ontology, domainId) {
  const userMessage = JSON.stringify({
    artifact: { ...artifact, nav: undefined },
    ontology: ontology ? { entities: ontology.entities } : undefined,
    domain: domainId,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0]?.text;
  if (!text) throw new Error("Пустой ответ от Claude");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) parsed = JSON.parse(match[1]);
    else throw new Error("Невалидный JSON в ответе");
  }

  return parsed.slots || parsed;
}

// Попытка сохранить в кеш сервера (если запущен)
async function tryCacheToServer(artifact, ontology, domainId) {
  try {
    const r = await fetch("http://localhost:3001/api/crystallize/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact, ontology, domain: domainId }),
    });
    if (r.ok) {
      const data = await r.json();
      if (data.cached) return { cached: true };
    }
  } catch {
    // Сервер не запущен — работаем standalone
  }
  return null;
}

let totalEnriched = 0;
let totalCached = 0;
let totalFailed = 0;

const domainIds = domainFilter ? [domainFilter] : Object.keys(domains);

for (const domainId of domainIds) {
  if (!domains[domainId]) {
    console.error(`❌ Домен "${domainId}" не найден. Доступные: ${Object.keys(domains).join(", ")}`);
    continue;
  }

  console.log(`\n🔮 Домен: ${domainId}`);
  const domain = await domains[domainId]();
  const artifacts = crystallizeV2(domain.INTENTS, domain.PROJECTIONS, domain.ONTOLOGY, domainId);

  const projIds = projectionFilter ? [projectionFilter] : Object.keys(artifacts);

  for (const projId of projIds) {
    const artifact = artifacts[projId];
    if (!artifact) {
      console.log(`  ⚠ Проекция "${projId}" не найдена`);
      continue;
    }

    // Попробовать кеш сервера
    const serverResult = await tryCacheToServer(artifact, domain.ONTOLOGY, domainId);
    if (serverResult?.cached) {
      console.log(`  ✓ ${projId} (из кеша)`);
      totalCached++;
      continue;
    }

    // Прямой API call
    try {
      process.stdout.write(`  ⏳ ${projId}...`);
      const enrichedSlots = await enrichArtifact(artifact, domain.ONTOLOGY, domainId);

      // Попробовать закешировать через сервер
      try {
        await fetch("http://localhost:3001/api/crystallize/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifact: { ...artifact, slots: enrichedSlots, generatedBy: "llm-enriched" },
            ontology: domain.ONTOLOGY,
            domain: domainId,
          }),
        });
      } catch { /* сервер не запущен */ }

      // Вывод изменений
      const changes = [];
      const countNew = (obj, path = "") => {
        if (!obj || typeof obj !== "object") return;
        for (const [k, v] of Object.entries(obj)) {
          if (["label", "placeholder", "hint", "emptyState"].includes(k) && typeof v === "string") {
            changes.push(`${path}${k}: "${v.slice(0, 40)}"`);
          }
          if (typeof v === "object") countNew(v, `${path}${k}.`);
        }
      };
      countNew(enrichedSlots);

      console.log(` ✨ ${changes.length} обогащений`);
      if (changes.length > 0) {
        for (const c of changes.slice(0, 5)) console.log(`    ${c}`);
        if (changes.length > 5) console.log(`    ... и ещё ${changes.length - 5}`);
      }
      totalEnriched++;
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      totalFailed++;
    }
  }
}

console.log(`\n📊 Итого: ${totalEnriched} обогащено, ${totalCached} из кеша, ${totalFailed} ошибок`);
