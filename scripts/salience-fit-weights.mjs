/**
 * salience-fit-weights.mjs
 *
 * Калибровка весов salience-функции на labeled dataset.
 * Метод: pairwise hinge-loss + coordinate-descent (без внешних зависимостей).
 *
 * Входные данные: docs/salience-suggestions.json
 * Формат: witnesses с tiedIds — наборы intent'ов с alphabetical-fallback.
 * Суждение: для каждого tied-набора определяем "правильный" winner по семантике id.
 *
 * Выход: JSON с откалиброванными весами (stdout) → docs/salience-fitted-weights.json
 *
 * ESM-модуль; экспортирует pairwiseLoss и fitWeightsCoordDescent для unit-тестирования.
 * CLI-секция внизу: if (import.meta.url === `file://${process.argv[1]}`)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Feature scoring (inline, не зависит от tarball) ──────────────────────────

/** Вычислить scalar salience из feature-вектора и весов */
function score(features, weights) {
  let s = 0;
  for (const k of Object.keys(features)) {
    s += (features[k] || 0) * (weights[k] || 0);
  }
  return s;
}

// ─── Pairwise hinge-loss ───────────────────────────────────────────────────────

/**
 * Вычислить pairwise hinge-loss + опциональная L2-регуляризация.
 *
 * @param {object} params
 * @param {Record<string, Record<string, number>>} params.features  - Map: intentId → feature vector
 * @param {Array<{winner: string, losers: string[]}>} params.pairs  - список пар
 * @param {Record<string, number>} params.weights                   - текущие веса
 * @param {number} [params.margin=1]                                - hinge margin
 * @param {number} [params.lambda=0]                                - L2 коэффициент
 * @returns {number}
 */
export function pairwiseLoss({ features, pairs, weights, margin = 1, lambda = 0 }) {
  let loss = 0;
  for (const { winner, losers } of pairs) {
    const fw = features[winner];
    if (!fw) continue;
    const sw = score(fw, weights);
    for (const lid of losers) {
      const fl = features[lid];
      if (!fl) continue;
      const sl = score(fl, weights);
      loss += Math.max(0, margin - (sw - sl));
    }
  }
  // L2 регуляризация
  if (lambda > 0) {
    for (const v of Object.values(weights)) {
      loss += lambda * v * v;
    }
  }
  return loss;
}

// ─── Coordinate-descent ───────────────────────────────────────────────────────

/**
 * Подобрать веса минимизацией pairwise hinge-loss через coordinate-descent.
 *
 * Веса ограничены снизу нулём (wk >= 0) и сверху 200 (wk <= 200).
 *
 * @param {object} params
 * @param {Record<string, Record<string, number>>} params.features  - feature vectors
 * @param {Array<{winner: string, losers: string[]}>} params.pairs  - пары (winner > loser)
 * @param {Record<string, number>} params.initial                   - начальные веса
 * @param {number} [params.lr=1]                                    - шаг по каждому весу
 * @param {number} [params.iters=500]                               - макс итераций
 * @param {number} [params.lambda=0]                                - L2 коэффициент
 * @param {boolean} [params.verbose=false]                          - логировать прогресс
 * @returns {Record<string, number>} откалиброванные веса
 */
export function fitWeightsCoordDescent({
  features,
  pairs,
  initial,
  lr = 1,
  iters = 500,
  lambda = 0,
  verbose = false,
}) {
  // Копируем initial, не мутируем его
  const w = Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v]));
  const keys = Object.keys(initial);
  const lossOpts = { features, pairs, weights: w, lambda };
  let prevLoss = pairwiseLoss(lossOpts);

  if (verbose) {
    process.stderr.write(`[salience-fit] start loss=${prevLoss.toFixed(3)} pairs=${pairs.reduce((s, p) => s + p.losers.length, 0)}\n`);
  }

  for (let it = 0; it < iters; it++) {
    let improved = false;
    for (const k of keys) {
      const baseLoss = pairwiseLoss(lossOpts);

      // Пробуем +lr (с ограничением сверху 200)
      const tryUp = Math.min(200, w[k] + lr);
      const savedK = w[k];
      w[k] = tryUp;
      const upLoss = pairwiseLoss(lossOpts);

      // Пробуем -lr (с ограничением снизу 0)
      const tryDown = Math.max(0, w[k] - lr - (tryUp - savedK)); // учитываем clamp
      w[k] = Math.max(0, savedK - lr);
      const downLoss = pairwiseLoss(lossOpts);

      if (upLoss < baseLoss && upLoss <= downLoss) {
        // +lr лучше
        w[k] = tryUp;
        improved = true;
      } else if (downLoss < baseLoss) {
        // -lr лучше, w[k] уже выставлен
        improved = true;
      } else {
        // нет улучшения — восстанавливаем
        w[k] = savedK;
      }
    }

    if (!improved) {
      if (verbose) {
        const finalLoss = pairwiseLoss(lossOpts);
        process.stderr.write(`[salience-fit] converged at iter=${it}, loss=${finalLoss.toFixed(3)}\n`);
      }
      break;
    }

    if (verbose && (it + 1) % 100 === 0) {
      const curLoss = pairwiseLoss(lossOpts);
      process.stderr.write(`[salience-fit] iter=${it + 1} loss=${curLoss.toFixed(3)}\n`);
    }
  }

  const finalLoss = pairwiseLoss(lossOpts);
  if (verbose) {
    process.stderr.write(`[salience-fit] final loss=${finalLoss.toFixed(3)}\n`);
  }

  return w;
}

// ─── Семантическое правило: кто winner в группе tied intent'ов ────────────────

/**
 * Приоритет action-глаголов: promotion > canonical-edit > creator > utility > negative
 * Возвращает числовой приоритет (выше = важнее).
 */
function intentSemanticPriority(id) {
  const s = String(id).toLowerCase();
  // Промоушн-глаголы (confirm, publish, submit, approve, complete, resolve, finalize, accept)
  if (/^(confirm|publish|submit|approve|complete|resolve|finalize|accept)/.test(s)) return 100;
  // Canonical edit (edit_<entity>, update_<entity>)
  if (/^(edit|update)_/.test(s)) return 90;
  // Creator (create_<entity>, add_<entity>)
  if (/^(create|add)_/.test(s)) return 80;
  // Relist / bulk positive actions
  if (/^(relist|bulk_relist)$/.test(s)) return 75;
  // Canonical read/detail
  if (/^(view|show|open|read)_/.test(s)) return 70;
  // Checkin / log / track
  if (/^(check|log|track)_/.test(s)) return 65;
  // Rename / move / schedule
  if (/^(rename|move|schedule)_/.test(s)) return 60;
  // Utility actions
  if (/^(set|assign|update|change|mark|tag|link|attach|import|export|duplicate|copy)_/.test(s)) return 50;
  // Follow/subscribe (lower priority than main actions)
  if (/^(follow|subscribe|like|watch)_/.test(s)) return 40;
  // Block/report/warn/flag (negative/moderation)
  if (/^(block|report|warn|flag|restrict|unblock|unfollow|unsubscribe|unlike)_/.test(s)) return 30;
  // Remove/delete/archive (destructive)
  if (/^(remove|delete|archive|cancel|reject|revoke|disable|deactivate)_/.test(s)) return 20;
  return 45; // default utility
}

/**
 * Определить winner для группы tiedIds по семантике.
 * Возвращает { winner, losers }.
 */
function resolveWinner(tiedIds) {
  if (tiedIds.length < 2) return null;
  const scored = tiedIds.map((id) => ({ id, p: intentSemanticPriority(id) }));
  scored.sort((a, b) => b.p - a.p);
  // winner — наибольший приоритет
  const winner = scored[0];
  // losers — все кто с меньшим приоритетом (уникальные по приоритету)
  const losers = scored.slice(1).filter((x) => x.p < winner.p).map((x) => x.id);
  if (losers.length === 0) return null; // все с одинаковым приоритетом — пропускаем
  return { winner: winner.id, losers };
}

// ─── Feature extraction (inline) ─────────────────────────────────────────────

const TIER_ALIAS = { primary: 1, secondary: 0.5, tertiary: 0.2, utility: 0.05 };

const FEATURE_KEYS_LOCAL = [
  "explicitNumber", "explicitTier",
  "tier1CanonicalEdit", "tier2EditLike", "tier3Promotion", "tier4ReplaceMain",
  "creatorMain", "phaseTransition", "irreversibilityHigh", "removeMain", "readOnly",
  "ownershipMatch", "domainFrequency",
];

function extractFeaturesLocal(intent, ctx) {
  const { projection, ONTOLOGY, intentUsage = {} } = ctx || {};
  const mainEntity = projection?.mainEntity;
  const lowerMain = String(mainEntity || "").toLowerCase();
  const id = intent?.id || String(intent) || "";
  const particles = intent?.particles || {};
  const effects = Array.isArray(particles.effects) ? particles.effects : [];
  const conditions = Array.isArray(particles.conditions) ? particles.conditions : [];
  const ownerField = ONTOLOGY?.entities?.[mainEntity]?.ownerField;

  const f = Object.fromEntries(FEATURE_KEYS_LOCAL.map((k) => [k, 0]));

  if (typeof intent?.salience === "number") {
    f.explicitNumber = Math.max(0, Math.min(1, intent.salience / 100));
  }
  if (typeof intent?.salience === "string" && TIER_ALIAS[intent.salience] != null) {
    f.explicitTier = TIER_ALIAS[intent.salience];
  }

  if (lowerMain && new RegExp(`^(edit|update)_${lowerMain}$`).test(id)) f.tier1CanonicalEdit = 1;
  if (/^(edit|update|rename)/.test(id)) f.tier2EditLike = 1;
  if (/^(publish|confirm|submit|accept|approve|complete|resolve|finalize)/.test(id)) f.tier3Promotion = 1;

  const hasReplaceOnMain = effects.some((e) => {
    if (e.α !== "replace") return false;
    const targetEntity = String(e.target || "").split(".")[0].toLowerCase();
    return targetEntity === lowerMain || targetEntity === String(mainEntity || "").toLowerCase();
  });
  if (hasReplaceOnMain && conditions.length === 0) f.tier4ReplaceMain = 1;

  // creates: проверяем и поле creates, и creates в виде "Entity(draft)"
  const createsVal = String(intent?.creates || "");
  if (createsVal === mainEntity || createsVal.startsWith(mainEntity + "(")) f.creatorMain = 1;

  if (effects.some((e) => e.α === "replace" && /\.(status|phase)$/.test(String(e.target || "")))) {
    f.phaseTransition = 1;
  }
  if (effects.some((e) => e?.context?.__irr?.point === "high" || intent?.irreversibility === "high")) {
    f.irreversibilityHigh = 1;
  }
  const lowerMainFull = String(mainEntity || "").toLowerCase();
  if (effects.some((e) => e.α === "remove" && String(e.target || "").toLowerCase().split(".")[0] === lowerMainFull)) {
    f.removeMain = 1;
  }
  if (effects.length === 0) f.readOnly = 1;

  if (ownerField) {
    const refs = (particles.entities || []).map(String);
    if (refs.some((r) => r.endsWith(`:${ownerField}`) || r.includes(mainEntity))) f.ownershipMatch = 1;
  }

  const total = Object.values(intentUsage).reduce((a, b) => a + b, 0);
  f.domainFrequency = total > 0 ? (intentUsage[id] || 0) / total : 0;

  return f;
}

// ─── Попытка загрузить extractSalienceFeatures из @intent-driven/core ─────────

async function tryLoadCoreExtractor() {
  try {
    const mod = await import("@intent-driven/core");
    if (typeof mod.extractSalienceFeatures === "function") {
      return mod.extractSalienceFeatures;
    }
  } catch (_) {
    // не установлен или tarball недоступен — используем inline версию
  }
  return null;
}

// ─── Загрузка domain INTENTS и ONTOLOGY ───────────────────────────────────────

async function loadDomainIntents(domain, baseDir) {
  const intentsPath = path.join(baseDir, "src", "domains", domain, "intents.js");
  const ontologyPath = path.join(baseDir, "src", "domains", domain, "ontology.js");
  try {
    const intentsUrl = new URL(`file://${intentsPath}`);
    const ontologyUrl = new URL(`file://${ontologyPath}`);
    const [intMod, ontMod] = await Promise.all([
      import(intentsUrl.href),
      import(ontologyUrl.href),
    ]);
    return {
      INTENTS: intMod.INTENTS || {},
      ONTOLOGY: ontMod.ONTOLOGY || ontMod.default || {},
    };
  } catch (_) {
    return { INTENTS: {}, ONTOLOGY: {} };
  }
}

// ─── Начальные DEFAULT веса ───────────────────────────────────────────────────

const DEFAULT_WEIGHTS_INITIAL = {
  explicitNumber: 100,
  explicitTier: 100,
  tier1CanonicalEdit: 80,
  tier2EditLike: 50,
  tier3Promotion: 70,
  tier4ReplaceMain: 60,
  creatorMain: 80,
  phaseTransition: 40,
  irreversibilityHigh: 35,
  removeMain: 30,
  readOnly: 10,
  ownershipMatch: 15,
  domainFrequency: 20,
};

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const __filename = fileURLToPath(import.meta.url);
  const baseDir = path.resolve(path.dirname(__filename), "..");

  // Загружаем dataset
  const suggestionsPath = path.join(baseDir, "docs", "salience-suggestions.json");
  if (!fs.existsSync(suggestionsPath)) {
    process.stderr.write(`[salience-fit] ERROR: ${suggestionsPath} не найден\n`);
    process.exit(1);
  }
  const dataset = JSON.parse(fs.readFileSync(suggestionsPath, "utf-8"));
  const witnesses = dataset.witnesses || [];

  process.stderr.write(`[salience-fit] Dataset: ${witnesses.length} witnesses из ${suggestionsPath}\n`);

  // Пробуем загрузить core-экстрактор
  const coreExtractor = await tryLoadCoreExtractor();

  if (coreExtractor) {
    process.stderr.write(`[salience-fit] Используем extractSalienceFeatures из @intent-driven/core\n`);
  } else {
    process.stderr.write(`[salience-fit] Используем inline feature extractor (fallback)\n`);
  }

  // Загружаем домены
  const domains = [...new Set(witnesses.map((w) => w.domain))];
  process.stderr.write(`[salience-fit] Домены: ${domains.join(", ")}\n`);

  const domainData = {};
  for (const domain of domains) {
    domainData[domain] = await loadDomainIntents(domain, baseDir);
    const intentCount = Object.keys(domainData[domain].INTENTS).length;
    process.stderr.write(`[salience-fit] Загружен домен ${domain}: ${intentCount} intents\n`);
  }

  /**
   * Стратегия формирования пар:
   *
   * Датасет `salience-suggestions.json` — набор alphabetical-fallback witnesses.
   * Каждый witness имеет:
   *   - `witness.salience` — числовой salience-slot (100 / 80 / 60 / 40 ...)
   *   - `tiedIds` — intent'ы в этом slot'е (все равны по текущим весам)
   *
   * Labeled constraint: witness с salience=100 важнее, чем witness с salience=80.
   * Значит: любой intent из tiedIds@100 должен быть выше любого intent из tiedIds@80
   * (для той же проекции и сущности).
   *
   * Дополнительно: внутри одного tiedIds применяем семантическую эвристику.
   */

  // Шаг 1: собираем всё feature vectors
  const allFeatures = {}; // `${domain}::${intentId}` → feature vector

  // Ключ с domain-prefix чтобы избежать коллизий между доменами
  function fkey(domain, intentId) {
    return `${domain}::${intentId}`;
  }

  for (const w of witnesses) {
    const { domain, mainEntity, tiedIds } = w;
    if (!tiedIds || tiedIds.length === 0) continue;

    const { INTENTS, ONTOLOGY } = domainData[domain] || {};
    if (!INTENTS || !ONTOLOGY) continue;

    const projection = { id: w.projectionId, mainEntity, archetype: "detail" };
    const intentUsage = Object.fromEntries(Object.entries(INTENTS).map(([id]) => [id, 1]));
    const ctx = { projection, ONTOLOGY, intentUsage };

    for (const intentId of tiedIds) {
      const key = fkey(domain, intentId);
      if (allFeatures[key]) continue;
      const intent = INTENTS[intentId] || {};
      try {
        allFeatures[key] = coreExtractor
          ? coreExtractor({ id: intentId, ...intent }, ctx)
          : extractFeaturesLocal({ id: intentId, ...intent }, ctx);
      } catch (_) {
        allFeatures[key] = extractFeaturesLocal({ id: intentId, ...intent }, ctx);
      }
    }
  }

  // Шаг 2: формируем cross-level пары (salience=100 > salience=80 > salience=60 > salience=40)
  //         для той же (domain, projectionId, mainEntity)
  const pairs = [];
  let totalPairs = 0;
  let skippedNoWinner = 0;

  // Группируем witnesses по (domain, projectionId, mainEntity)
  const groupKey = (w) => `${w.domain}|${w.projectionId}|${w.mainEntity}`;
  const groups = {};
  for (const w of witnesses) {
    const k = groupKey(w);
    if (!groups[k]) groups[k] = [];
    groups[k].push(w);
  }

  for (const [, grp] of Object.entries(groups)) {
    // Сортируем по salience desc
    grp.sort((a, b) => (b.witness.salience || 0) - (a.witness.salience || 0));

    // Cross-level: каждый winner из уровня i > каждый loser из уровня j (i < j)
    for (let i = 0; i < grp.length; i++) {
      for (let j = i + 1; j < grp.length; j++) {
        const higherLevel = grp[i]; // salience выше
        const lowerLevel = grp[j];  // salience ниже
        if ((higherLevel.witness.salience || 0) <= (lowerLevel.witness.salience || 0)) continue;

        const domain = higherLevel.domain;
        const highIds = (higherLevel.tiedIds || []).map((id) => fkey(domain, id)).filter((k) => allFeatures[k]);
        const lowIds = (lowerLevel.tiedIds || []).map((id) => fkey(domain, id)).filter((k) => allFeatures[k]);

        if (highIds.length === 0 || lowIds.length === 0) continue;

        // Берём представительный winner из highIds (первый — алфавитный)
        // и добавляем пары winner > каждый из lowIds
        for (const winnerId of highIds) {
          const losers = lowIds;
          pairs.push({ winner: winnerId, losers });
          totalPairs += losers.length;
        }
      }
    }

    // Внутри каждого уровня: семантическая эвристика по id
    for (const w of grp) {
      const tiedIds = (w.tiedIds || []).filter((id) => {
        const k = fkey(w.domain, id);
        return allFeatures[k];
      });
      if (tiedIds.length < 2) continue;

      const resolved = resolveWinner(tiedIds);
      if (!resolved) { skippedNoWinner++; continue; }

      const { winner, losers } = resolved;
      const winnerKey = fkey(w.domain, winner);
      const loserKeys = losers.map((l) => fkey(w.domain, l)).filter((k) => allFeatures[k]);

      if (!allFeatures[winnerKey] || loserKeys.length === 0) { skippedNoWinner++; continue; }

      pairs.push({ winner: winnerKey, losers: loserKeys });
      totalPairs += loserKeys.length;
    }
  }

  process.stderr.write(
    `[salience-fit] Сформировано ${pairs.length} групп, ${totalPairs} pairwise constraints\n` +
    `[salience-fit] Пропущено внутри уровня: ${skippedNoWinner}\n`
  );

  if (pairs.length === 0) {
    process.stderr.write(`[salience-fit] WARN: нет pairs для калибровки, возвращаем начальные веса\n`);
    console.log(JSON.stringify({
      _meta: { pairs: 0, loss: 0, note: "no pairs — returned defaults" },
      weights: DEFAULT_WEIGHTS_INITIAL,
    }, null, 2));
    process.exit(0);
  }

  // Стартовый hinge-loss (без L2)
  const startLoss = pairwiseLoss({ features: allFeatures, pairs, weights: DEFAULT_WEIGHTS_INITIAL });
  process.stderr.write(`[salience-fit] Стартовый loss=${startLoss.toFixed(3)}\n`);

  // Запускаем coordinate-descent (без L2, ограничения [0,200] внутри)
  const fitted = fitWeightsCoordDescent({
    features: allFeatures,
    pairs,
    initial: { ...DEFAULT_WEIGHTS_INITIAL },
    lr: 2,
    iters: 2000,
    lambda: 0,
    verbose: true,
  });

  // Финальный чистый hinge-loss (без L2 для честного сравнения)
  const finalLoss = pairwiseLoss({ features: allFeatures, pairs, weights: fitted });

  // Проверяем разумность диапазона весов
  const outOfRange = Object.entries(fitted).filter(([, v]) => v < 0 || v > 200);
  if (outOfRange.length > 0) {
    process.stderr.write(
      `[salience-fit] WARN: веса вышли за диапазон [0, 200]: ${outOfRange.map(([k, v]) => `${k}=${v}`).join(", ")}\n`
    );
  }

  // Выводим результат
  const result = {
    _meta: {
      generatedAt: new Date().toISOString(),
      dataset: "docs/salience-suggestions.json",
      totalWitnesses: witnesses.length,
      pairGroups: pairs.length,
      totalPairwiseConstraints: totalPairs,
      startLoss,
      finalLoss,
      converged: finalLoss < startLoss,
      note: "Fitted weights для DEFAULT_SALIENCE_WEIGHTS в SDK (@intent-driven/core). SDK PR: DubovskiyIM/idf-sdk#342.",
    },
    weights: fitted,
  };

  console.log(JSON.stringify(result, null, 2));

  if (finalLoss >= startLoss) {
    process.stderr.write(`[salience-fit] WARN: loss не уменьшился (start=${startLoss.toFixed(3)}, final=${finalLoss.toFixed(3)})\n`);
  } else {
    process.stderr.write(`[salience-fit] OK: loss уменьшился ${startLoss.toFixed(3)} → ${finalLoss.toFixed(3)}\n`);
  }
}
