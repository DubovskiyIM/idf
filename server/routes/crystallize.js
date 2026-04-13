/**
 * POST /api/crystallize/enrich — LLM enrichment pass для артефакта v2.
 *
 * Rule-based артефакт + Claude API → обогащённый артефакт (labels, placeholders,
 * icons, ordering, emptyState). Кешируется в SQLite по inputsHash + projectionId.
 */

const { Router } = require("express");
const Anthropic = require("@anthropic-ai/sdk").default;
const db = require("../db.js");

const router = Router();

// Таблица кеша
db.exec(`
  CREATE TABLE IF NOT EXISTS enriched_artifacts (
    inputs_hash TEXT NOT NULL,
    projection_id TEXT NOT NULL,
    enriched_slots TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (inputs_hash, projection_id)
  );
`);

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

router.post("/enrich", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY не задан" });
  }

  const { artifact, ontology, domain } = req.body;
  if (!artifact || !artifact.inputsHash || !artifact.projection) {
    return res.status(400).json({ error: "artifact с inputsHash и projection обязателен" });
  }

  // Проверить кеш
  const cached = db.prepare(
    "SELECT enriched_slots FROM enriched_artifacts WHERE inputs_hash = ? AND projection_id = ?"
  ).get(artifact.inputsHash, artifact.projection);

  if (cached) {
    try {
      const enrichedSlots = JSON.parse(cached.enriched_slots);
      const enriched = { ...artifact, slots: enrichedSlots, generatedBy: "llm-enriched" };
      return res.json({ enrichedArtifact: enriched, cached: true });
    } catch {
      // Кеш повреждён — удалить и продолжить
      db.prepare("DELETE FROM enriched_artifacts WHERE inputs_hash = ? AND projection_id = ?")
        .run(artifact.inputsHash, artifact.projection);
    }
  }

  // Вызвать Claude API
  try {
    const client = new Anthropic({ apiKey });
    const userMessage = JSON.stringify({
      artifact: { ...artifact, nav: undefined }, // nav не нужен для enrichment
      ontology: ontology ? { entities: ontology.entities } : undefined,
      domain,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "Пустой ответ от Claude" });
    }

    // Парсим ответ — ожидаем JSON артефакта
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Попробуем извлечь JSON из markdown code block
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        return res.status(502).json({ error: "Claude вернул невалидный JSON" });
      }
    }

    // Извлекаем slots из ответа
    const enrichedSlots = parsed.slots || parsed;

    // Merge: enriched поверх оригинала
    const mergedSlots = mergeSlots(artifact.slots, enrichedSlots);
    const enriched = { ...artifact, slots: mergedSlots, generatedBy: "llm-enriched" };

    // Кешировать
    db.prepare(`
      INSERT OR REPLACE INTO enriched_artifacts (inputs_hash, projection_id, enriched_slots, created_at)
      VALUES (?, ?, ?, ?)
    `).run(artifact.inputsHash, artifact.projection, JSON.stringify(mergedSlots), Date.now());

    console.log(`  [llm-enrich] Обогащён: ${artifact.projection} (${domain})`);
    res.json({ enrichedArtifact: enriched, cached: false });
  } catch (err) {
    console.error("[llm-enrich] Ошибка:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/crystallize/status — проверить доступность API key
router.get("/status", (req, res) => {
  res.json({ available: !!process.env.ANTHROPIC_API_KEY });
});

/**
 * Рекурсивный merge: enriched поверх original.
 * Добавляет/обновляет leaf-поля (label, placeholder, hint, icon, emptyState),
 * сохраняет structure original.
 */
function mergeSlots(original, enriched) {
  if (!enriched || typeof enriched !== "object") return original;
  if (!original || typeof original !== "object") return original;
  if (Array.isArray(original)) {
    if (!Array.isArray(enriched) || enriched.length !== original.length) return original;
    return original.map((item, i) => mergeSlots(item, enriched[i]));
  }
  const result = { ...original };
  for (const key of Object.keys(enriched)) {
    if (key in original) {
      if (typeof original[key] === "object" && original[key] !== null) {
        result[key] = mergeSlots(original[key], enriched[key]);
      } else {
        // Leaf: берём enriched
        result[key] = enriched[key];
      }
    } else {
      // Новый leaf-ключ (label, placeholder, hint, icon, emptyState) — добавляем
      const safeKeys = ["label", "placeholder", "hint", "icon", "emptyState", "description"];
      if (safeKeys.includes(key)) {
        result[key] = enriched[key];
      }
    }
  }
  return result;
}

module.exports = router;
module.exports.mergeSlots = mergeSlots;
