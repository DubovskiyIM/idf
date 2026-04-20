/**
 * Derivation spec-debt — подсчёт crystallize-rule witnesses и override-coefficient
 * по 10 доменам.
 *
 * crystallize-rule witness возникает, когда R1..R8 срабатывает на деривации
 * проекции (origin) или её обогащении (subCollection/hub/field-union).
 * Каждый такой witness — observable trail, говорящий «что и почему было
 * выведено». Без него debugging derived UI — чёрный ящик.
 *
 * Override-coefficient: доля авторских проекций (в PROJECTIONS) к числу
 * derived-проекций. Низкое значение → формат сам покрывает структуру;
 * высокое → автору приходится переопределять много, сигнал о недоспеке онтологии.
 *
 * Спецификация: idf-manifest-v2.1/docs/design/debugging-derived-ui-spec.md
 *
 * Импорт SDK — прямо из worktree dist/index.mjs, чтобы не менять
 * node_modules в idf/ (SDK 0.16.0+derivedBy ещё не published).
 */
// Требует @intent-driven/core >= 0.17 (PR #61) с witness trail.
import { crystallizeV2, deriveProjections } from "@intent-driven/core";

/**
 * Повторяет host V2Shell merge: derived + authored, authored wins.
 * Derived-only ids сохраняют derivedBy metadata → R-rule witnesses видны.
 */
function composedProjections(I, O, authored) {
  const intentsArr = Object.entries(I).map(([id, i]) => ({ id, ...i }));
  let derived = {};
  try { derived = deriveProjections(intentsArr, O); } catch {}
  return { ...derived, ...authored };
}

import { INTENTS as bookingI, PROJECTIONS as bookingP, ONTOLOGY as bookingO } from "../src/domains/booking/domain.js";
import { INTENTS as planningI, PROJECTIONS as planningP, ONTOLOGY as planningO } from "../src/domains/planning/domain.js";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as messengerI, PROJECTIONS as messengerP, ONTOLOGY as messengerO } from "../src/domains/messenger/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";
import { INTENTS as lifequestI, PROJECTIONS as lifequestP, ONTOLOGY as lifequestO } from "../src/domains/lifequest/domain.js";
import { INTENTS as reflectI, PROJECTIONS as reflectP, ONTOLOGY as reflectO } from "../src/domains/reflect/domain.js";
import { INTENTS as investI, PROJECTIONS as investP, ONTOLOGY as investO } from "../src/domains/invest/domain.js";
import { INTENTS as deliveryI, PROJECTIONS as deliveryP, ONTOLOGY as deliveryO } from "../src/domains/delivery/domain.js";
import { INTENTS as freelanceI, PROJECTIONS as freelanceP, ONTOLOGY as freelanceO } from "../src/domains/freelance/domain.js";

const DOMAINS = [
  { id: "booking",   I: bookingI,   P: bookingP,   O: bookingO },
  { id: "planning",  I: planningI,  P: planningP,  O: planningO },
  { id: "workflow",  I: workflowI,  P: workflowP,  O: workflowO },
  { id: "messenger", I: messengerI, P: messengerP, O: messengerO },
  { id: "sales",     I: salesI,     P: salesP,     O: salesO },
  { id: "lifequest", I: lifequestI, P: lifequestP, O: lifequestO },
  { id: "reflect",   I: reflectI,   P: reflectP,   O: reflectO },
  { id: "invest",    I: investI,    P: investP,    O: investO },
  { id: "delivery",  I: deliveryI,  P: deliveryP,  O: deliveryO },
  { id: "freelance", I: freelanceI, P: freelanceP, O: freelanceO },
];

const RULE_IDS = ["R1", "R2", "R3", "R4", "R6", "R7", "R8"];

let grandTotalWitnesses = 0;
let grandAuthored = 0;
let grandDerivations = 0;

console.log("## Derivation witness trail + override-coefficient по 10 доменам\n");
console.log(`${"domain".padEnd(12)} ${"proj".padStart(4)} ${"derived".padStart(8)} ${"auth".padStart(5)} ${RULE_IDS.map(r => r.padStart(4)).join(" ")} ${"ratio".padStart(6)}`);
console.log("-".repeat(80));

for (const d of DOMAINS) {
  const art = crystallizeV2(d.I, composedProjections(d.I, d.O, d.P), d.O, d.id);
  const projIds = Object.keys(art);
  const perRule = Object.fromEntries(RULE_IDS.map(r => [r, 0]));
  let derivedProjCount = 0;
  let authoredProjCount = 0;
  let totalCrystallizeRuleWitnesses = 0;

  for (const projId of projIds) {
    const a = art[projId];
    if (!a?.witnesses) continue;
    const ruleWitnesses = a.witnesses.filter(w => w.basis === "crystallize-rule");

    if (ruleWitnesses.length > 0) {
      derivedProjCount++;
      totalCrystallizeRuleWitnesses += ruleWitnesses.length;
      for (const w of ruleWitnesses) {
        if (perRule[w.ruleId] !== undefined) perRule[w.ruleId]++;
      }
    } else {
      authoredProjCount++;
    }
  }

  // override-coefficient = authored / (derived + authored); 0 = всё выведено, 1 = всё авторское
  const total = derivedProjCount + authoredProjCount;
  const ratio = total > 0 ? (authoredProjCount / total).toFixed(2) : "n/a";

  const ruleCounts = RULE_IDS.map(r => String(perRule[r]).padStart(4)).join(" ");
  console.log(
    `${d.id.padEnd(12)} ${String(projIds.length).padStart(4)} ${String(derivedProjCount).padStart(8)} ${String(authoredProjCount).padStart(5)} ${ruleCounts} ${String(ratio).padStart(6)}`
  );

  grandTotalWitnesses += totalCrystallizeRuleWitnesses;
  grandDerivations += derivedProjCount;
  grandAuthored += authoredProjCount;
}

console.log("-".repeat(80));
const grandRatio = (grandAuthored + grandDerivations) > 0
  ? (grandAuthored / (grandAuthored + grandDerivations)).toFixed(2)
  : "n/a";
console.log(
  `${"TOTAL".padEnd(12)} ${"".padStart(4)} ${String(grandDerivations).padStart(8)} ${String(grandAuthored).padStart(5)} ${"".padStart(5 * 7 + 6)} ${grandRatio.padStart(6)}`
);

console.log(`\n# Всего crystallize-rule witnesses: ${grandTotalWitnesses}`);
console.log(`# Проекций derived / authored / всего: ${grandDerivations} / ${grandAuthored} / ${grandDerivations + grandAuthored}`);
console.log(`# Override-coefficient (authored / total): ${grandRatio}`);
console.log(`\n# Цель: ratio монотонно убывающий по минорным версиям формата.`);
console.log(`# Скачок вверх при добавлении домена → сигнал о пробеле в правилах R1–R8.`);

// Top-3 проекции по числу witnesses (потенциальные hub/enrichment точки)
console.log(`\n## Top проекции по числу crystallize-rule witnesses:\n`);
const topByWitnesses = [];
for (const d of DOMAINS) {
  const art = crystallizeV2(d.I, composedProjections(d.I, d.O, d.P), d.O, d.id);
  for (const [projId, a] of Object.entries(art)) {
    if (!a?.witnesses) continue;
    const count = a.witnesses.filter(w => w.basis === "crystallize-rule").length;
    if (count > 0) topByWitnesses.push({ domain: d.id, projId, count, a });
  }
}
topByWitnesses.sort((a, b) => b.count - a.count);
for (const w of topByWitnesses.slice(0, 8)) {
  const ruleBreakdown = w.a.witnesses
    .filter(x => x.basis === "crystallize-rule")
    .map(x => x.ruleId)
    .reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const summary = Object.entries(ruleBreakdown).map(([r, c]) => `${r}×${c}`).join(" ");
  console.log(`  ${w.domain.padEnd(12)} ${w.projId.padEnd(36)} ${String(w.count).padStart(3)}  [${summary}]`);
}
