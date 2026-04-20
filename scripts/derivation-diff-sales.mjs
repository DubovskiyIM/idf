/**
 * Derivation diff для sales — сравнить PROJECTIONS (authored, что реально
 * отдают домены) и `deriveProjections(INTENTS, ONTOLOGY)` (что сам формат
 * считает должным).
 *
 * Задача — понять, **почему авторы выбирают руки**. Три класса ответа:
 *
 *   (a) Surplus author-side:   авторская проекция, которой deriveProjections
 *                              не создаёт. Явная ценность поверх правил.
 *   (b) Shared id, другая форма:
 *                              проекция существует в обоих, но поля отличаются.
 *                              Это и есть "override". Где именно — будет видно.
 *   (c) Missing: derived, автором не переопределена. Бесплатная структура,
 *                              которую авторы оставили, не объявляя.
 *
 * Если (c) близко к 0 — значит deriveProjections недоспецифицирован и
 * авторы вынужденно дублируют. Если (b) доминирует — авторы выбирают
 * override, и нужно понять, какие поля наиболее часто override'ятся.
 */
// Требует @intent-driven/core >= 0.17 (PR #61).
import { deriveProjections } from "@intent-driven/core";
import { INTENTS, PROJECTIONS, ONTOLOGY } from "../src/domains/sales/domain.js";

const derived = deriveProjections(INTENTS, ONTOLOGY);

// Нормализация: убираем служебные derivedBy перед сравнением,
// чтобы diff показывал семантику, а не witness trail.
const stripDerived = (proj) => {
  const { derivedBy: _d, ...rest } = proj;
  return rest;
};

const authoredIds = new Set(Object.keys(PROJECTIONS));
const derivedIds  = new Set(Object.keys(derived));

const onlyAuthored = [...authoredIds].filter(id => !derivedIds.has(id));
const onlyDerived  = [...derivedIds].filter(id => !authoredIds.has(id));
const shared       = [...authoredIds].filter(id =>  derivedIds.has(id));

console.log(`# sales — derivation diff\n`);
console.log(`authored проекций: ${authoredIds.size}`);
console.log(`derived  проекций: ${derivedIds.size}`);
console.log(`shared id:         ${shared.length}`);
console.log(`only authored:     ${onlyAuthored.length}  (a) surplus`);
console.log(`only derived:      ${onlyDerived.length}  (c) free structure`);
console.log(`\n## (a) Только авторские — ценность поверх правил\n`);
for (const id of onlyAuthored) {
  const p = PROJECTIONS[id];
  console.log(`  ${id.padEnd(28)} kind=${(p.kind || "?").padEnd(10)} mainEntity=${p.mainEntity || "-"}`);
}

console.log(`\n## (c) Только derived — бесплатная структура, авторами не использована\n`);
for (const id of onlyDerived) {
  const p = derived[id];
  console.log(`  ${id.padEnd(28)} kind=${(p.kind || "?").padEnd(10)} mainEntity=${p.mainEntity || "-"}`);
}

console.log(`\n## (b) Shared id — field-level diff (что override'ят авторы)\n`);

const fieldOverrides = {};  // { fieldName: count }
for (const id of shared) {
  const a = stripDerived(PROJECTIONS[id]);
  const d = stripDerived(derived[id]);
  const allKeys = new Set([...Object.keys(a), ...Object.keys(d)]);
  const diffs = [];
  for (const k of allKeys) {
    const va = a[k];
    const vd = d[k];
    if (JSON.stringify(va) !== JSON.stringify(vd)) {
      diffs.push({ k, authored: va, derived: vd });
      fieldOverrides[k] = (fieldOverrides[k] || 0) + 1;
    }
  }
  if (diffs.length === 0) {
    console.log(`  ${id.padEnd(28)} ✓ identical`);
  } else {
    console.log(`  ${id}`);
    for (const df of diffs) {
      const a = Array.isArray(df.authored) ? `[${df.authored.length}]` : JSON.stringify(df.authored)?.slice(0, 60);
      const d = Array.isArray(df.derived)  ? `[${df.derived.length}]`  : JSON.stringify(df.derived)?.slice(0, 60);
      console.log(`    ${df.k.padEnd(18)} authored: ${a}   derived: ${d}`);
    }
  }
}

console.log(`\n## Сводка: какие поля авторы override'ят чаще всего\n`);
const sorted = Object.entries(fieldOverrides).sort((a, b) => b[1] - a[1]);
for (const [field, count] of sorted) {
  console.log(`  ${field.padEnd(20)} ${count} проекц${count === 1 ? "ия" : "ий"}`);
}
