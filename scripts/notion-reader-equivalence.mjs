#!/usr/bin/env node
/**
 * Reader-equivalence smoke для notion-домена (§23 axiom 5 manual check).
 *
 * Проверяет, что 4 материализации (pixels via crystallize → artifact,
 * agent-API via filterWorldForRole → world, document via materializeAsDocument,
 * voice via materializeAsVoice) на одном срезе Φ возвращают
 * изоморфный information-content на ROOT-уровне.
 */

import { fold, crystallizeV2, materializeAsDocument, materializeAsVoice, filterWorldForRole } from "@intent-driven/core";
import { ONTOLOGY, INTENTS, PROJECTIONS, getSeedEffects } from "../src/domains/notion/domain.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "/tmp/notion-reader-equivalence";
mkdirSync(OUT_DIR, { recursive: true });

console.log("═══ Notion Reader-Equivalence Smoke ═══\n");

// 1. Build world
const effects = getSeedEffects();
const world = fold(effects);
console.log(`✓ Φ → world: ${effects.length} effects → ${Object.keys(world).length} collections`);

// 2. Crystallize
const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "notion");
console.log(`✓ crystallizeV2: ${Object.keys(artifacts).length} artifacts (включая synthesized _edit/_create)`);

// 3. Pick виewer
const viewer = { id: "u-anna", roles: ["workspaceOwner"], role: "workspaceOwner" };

// 4. Filter world per viewer
const visibleWorld = filterWorldForRole(world, ONTOLOGY, viewer.role, viewer.id);
console.log(`✓ filterWorldForRole(workspaceOwner): pages=${Object.keys(visibleWorld.pages || {}).length}, blocks=${Object.keys(visibleWorld.blocks || {}).length}`);

// 5. Materialize 3 readers для sidebar_workspace
const proj = { ...PROJECTIONS.sidebar_workspace, id: "sidebar_workspace" };
const projDetail = { ...PROJECTIONS.page_detail, id: "page_detail" };

console.log("\n── sidebar_workspace ──");

const docOut = materializeAsDocument(proj, visibleWorld, viewer);
console.log(`  document: ${docOut.body?.items?.length ?? "?"} items`);

const voiceOut = materializeAsVoice(proj, visibleWorld, viewer, { format: "json" });
console.log(`  voice: ${voiceOut.turns?.length ?? "?"} turns`);

// Сохраним outputs
writeFileSync(join(OUT_DIR, "sidebar-document.json"), JSON.stringify(docOut, null, 2));
writeFileSync(join(OUT_DIR, "sidebar-voice.json"), JSON.stringify(voiceOut, null, 2));
writeFileSync(join(OUT_DIR, "sidebar-artifact.json"), JSON.stringify(artifacts.sidebar_workspace, null, 2));

// 6. Page detail (на конкретной p-onboarding)
console.log("\n── page_detail (p-onboarding) ──");

const detailDoc = materializeAsDocument(projDetail, visibleWorld, viewer, { routeParams: { pageId: "p-onboarding" } });
const detailVoice = materializeAsVoice(projDetail, visibleWorld, viewer, { format: "json", routeParams: { pageId: "p-onboarding" } });

console.log(`  document: title=${detailDoc.header?.title ?? "?"}, sections=${detailDoc.sections?.length ?? "?"}`);
console.log(`  voice: ${detailVoice.turns?.length ?? "?"} turns`);

writeFileSync(join(OUT_DIR, "detail-document.json"), JSON.stringify(detailDoc, null, 2));
writeFileSync(join(OUT_DIR, "detail-voice.json"), JSON.stringify(detailVoice, null, 2));
writeFileSync(join(OUT_DIR, "detail-artifact.json"), JSON.stringify(artifacts.page_detail, null, 2));

// 7. Manual axiom-5 check для sidebar: top-titles должны совпасть
const docTitles = (docOut.body?.items || []).map(it => it.title || it.name).filter(Boolean).slice(0, 5);
const voiceTexts = (voiceOut.turns || []).map(t => t.text).filter(Boolean).slice(0, 5);

console.log("\n── Axiom 5 manual check ──");
console.log(`  doc titles (top 5): ${JSON.stringify(docTitles)}`);
console.log(`  voice excerpts:     ${JSON.stringify(voiceTexts.map(t => t.slice(0, 50)))}`);

// 8. Per-role view comparison
console.log("\n── Role-restriction smoke ──");
for (const role of ["workspaceOwner", "editor", "commenter", "viewer"]) {
  const v = { id: "u-anna", roles: [role], role };
  const w = filterWorldForRole(world, ONTOLOGY, role, v.id);
  const pageCount = Object.keys(w.pages || {}).length;
  const blockCount = Object.keys(w.blocks || {}).length;
  const memberFieldCount = Object.values(w.workspaceMembers || {})[0] ? Object.keys(Object.values(w.workspaceMembers)[0]).length : 0;
  console.log(`  ${role}: pages=${pageCount}, blocks=${blockCount}, member-fields-visible=${memberFieldCount}`);
}

console.log(`\nOutputs saved to ${OUT_DIR}/`);
