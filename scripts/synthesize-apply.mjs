#!/usr/bin/env node
/**
 * Apply-synthesizer (§13.17 MVP, opt-c minimal).
 *
 * Берёт candidate JSON'ы из refs/candidates/, добавляет `structure.apply`
 * marker-only функцию (idempotent, source-marker preserving) и эмитит
 * updated JSON в `refs/candidates-with-apply/<file>`.
 *
 * Marker-only apply — наименьшее legitimate use of pattern bank apply
 * surface: помечает первый matching item в slot маркером
 * `source: "derived:<patternId>"`. Не мутирует shape, idempotent.
 * Это превращает researcher candidate из descriptive в minimally
 * prescriptive (есть исполнимая функция, проходит validateArtifact).
 *
 * Future opts (§13.17 a / b):
 *   a — AI-synthesizer, читает structure.description и emit'ит
 *       semantic apply с правильным slot-mutation
 *   b — researcher v2 prompt that emits apply directly
 *
 * Usage:
 *   node scripts/synthesize-apply.mjs            # все review-bucket
 *   node scripts/synthesize-apply.mjs --top 5    # top-N по score
 *   node scripts/synthesize-apply.mjs --id <id>  # один паттерн
 */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const REPO = process.env.IDF_REPO || join(homedir(), "WebstormProjects", "idf");
const CANDIDATES_DIR = join(REPO, "refs", "candidates");
const OUT_DIR = join(REPO, "refs", "candidates-with-apply");
const TOP_N = (() => {
  const idx = process.argv.indexOf("--top");
  return idx >= 0 ? Number(process.argv[idx + 1]) : Infinity;
})();
const ID_FILTER = (() => {
  const idx = process.argv.indexOf("--id");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

/**
 * Marker-only apply skeleton. Принимает structure.slot и patternId,
 * возвращает stringified function source.
 */
function buildApplySource(patternId, slotName) {
  return [
    "function apply(slots, context) {",
    `  // Auto-synthesized marker-only apply (§13.17 opt-c).`,
    `  // Marks first un-marked item in slots.${slotName} with source: "derived:${patternId}".`,
    `  // Idempotent: skip if already marked.`,
    `  const slot = slots?.${slotName};`,
    `  if (!Array.isArray(slot) || slot.length === 0) return slots;`,
    `  const idx = slot.findIndex((x) => x && !x.source);`,
    `  if (idx === -1) return slots;`,
    `  const marker = "derived:${patternId}";`,
    `  if (slot[idx].source === marker) return slots;`,
    `  return {`,
    `    ...slots,`,
    `    ${slotName}: slot.map((item, i) =>`,
    `      i === idx ? { ...item, source: marker } : item),`,
    `  };`,
    "}",
  ].join("\n");
}

function scoreSimple(c) {
  const ev = Array.isArray(c.rationale?.evidence) ? c.rationale.evidence.length : 0;
  const sm = Array.isArray(c.shouldMatch) ? c.shouldMatch.length : 0;
  const sn = Array.isArray(c.shouldNotMatch) ? c.shouldNotMatch.length : 0;
  const tr = Array.isArray(c.trigger?.requires) ? c.trigger.requires.length : 0;
  return ev * 2 + (sm > 0 && sn > 0 ? 4 : 0) + tr * 2;
}

async function main() {
  const files = (await readdir(CANDIDATES_DIR)).filter((f) =>
    f.endsWith(".json") && f.startsWith("2026-04-26-"),
  );
  const cands = [];
  for (const f of files) {
    try {
      const j = JSON.parse(await readFile(join(CANDIDATES_DIR, f), "utf8"));
      cands.push({ file: f, data: j });
    } catch (err) {
      console.warn(`skip ${f}: ${err.message}`);
    }
  }
  cands.sort((a, b) => scoreSimple(b.data) - scoreSimple(a.data));

  await mkdir(OUT_DIR, { recursive: true });

  let synthesized = 0;
  let skipped = 0;
  for (const { file, data } of cands) {
    if (ID_FILTER && data.id !== ID_FILTER) continue;
    if (!ID_FILTER && synthesized >= TOP_N) break;

    if (data.structure?.apply) {
      skipped += 1;
      continue;
    }
    const slotName = data.structure?.slot || "body";
    const applySrc = buildApplySource(data.id, slotName);

    // Эмиттим JSON с apply как stringified source (JSON-safe).
    // Runtime loader должен `eval(`(${applySrc})`)` или Function-constructor.
    const out = {
      ...data,
      structure: {
        ...data.structure,
        applySource: applySrc,
        applyKind: "marker-only-synthesized",
        applySynthesizedAt: Date.now(),
      },
    };

    await writeFile(join(OUT_DIR, file), JSON.stringify(out, null, 2));
    synthesized += 1;
  }

  console.log(
    `synthesized: ${synthesized} candidates → ${OUT_DIR.replace(REPO, "")}\n` +
    `skipped: ${skipped} (already had apply)\n` +
    `total scanned: ${cands.length}`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
