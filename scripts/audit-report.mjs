#!/usr/bin/env node
/**
 * Audit report — unified 7-ось report по 10 доменам.
 *
 * Orthogonal к `scripts/domain-audit.mjs` (conformance-to-lifequest-bar).
 * Этот script — report, включающий:
 *   1. Format conformance (reuses `domain-audit.mjs` exports)
 *   2. Derivation health (override-coefficient, matched patterns, alphabetical-fallback)
 *   3. SDK idiom currency (legacy irreversibility, fieldRole "money", plain entities)
 *   4. Test coverage proxy (.test files, smoke scripts, e2e docs)
 *   5. Cross-domain collisions (shared entities/intents)
 *   6. Pattern application (hasApply vs matching-only, behavioral coverage)
 *   7. Structural health (archetype histogram, dead entities, unclassified intents)
 *
 * Output:
 *   - docs/domain-audit.md (human-readable, authoritative baseline)
 *   - docs/domain-audit.json (machine-readable, CI/diff-friendly)
 *
 * Spec: docs/superpowers/specs/2026-04-20-domain-audit-design.md
 *
 * Usage:
 *   node scripts/audit-report.mjs              # → docs/domain-audit.{md,json}
 *   node scripts/audit-report.mjs --json-only
 *   node scripts/audit-report.mjs --md-only
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  crystallizeV2,
  deriveProjections,
  getDefaultRegistry,
  loadStablePatterns,
  resolvePattern,
} from "@intent-driven/core";
import {
  checkFieldsTyped,
  checkEntityKind,
  checkRoleBase,
  checkOwnerField,
} from "./domain-audit.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const DOMAIN_NAMES = [
  "booking", "planning", "workflow", "messenger", "sales",
  "lifequest", "reflect", "invest", "delivery", "freelance",
];
const SEVERITY_ORDER = { error: 3, warning: 2, info: 1 };

// ---------------------------------------------------------------------------
// Utilities

async function loadDomain(name) {
  const file = path.join(ROOT, "src", "domains", name, "domain.js");
  try {
    const mod = await import(pathToFileURL(file).href);
    return {
      id: name,
      ontology: mod.ONTOLOGY || null,
      intents: mod.INTENTS || {},
      projections: mod.PROJECTIONS || {},
      ok: true,
    };
  } catch (e) {
    return { id: name, ok: false, error: e.message };
  }
}

function intentsAsArray(intents) {
  return Object.entries(intents || {}).map(([id, intent]) => ({ id, ...intent }));
}

function normalizeFields(fields) {
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields.map(f => typeof f === "string" ? { name: f, type: "text" } : f);
  }
  return Object.entries(fields).map(([name, def]) => ({ name, ...(def || {}) }));
}

function finding(severity, axis, message, details = {}) {
  return { severity, axis, message, details };
}

// ---------------------------------------------------------------------------
// Axis 1: Format conformance

function auditFormatConformance(domain) {
  const findings = [];
  const { ontology } = domain;
  const entities = ontology?.entities || {};

  // 1.1 Reuse domain-audit.mjs: fields-array-form, entity-no-type, role-no-base, owner-field-missing
  const fieldsGaps = checkFieldsTyped(ontology);
  for (const g of fieldsGaps) {
    findings.push(finding("warning", "format", `Entity ${g.entity}.fields — legacy string-array`, g));
  }
  const entityKindGaps = checkEntityKind(ontology);
  for (const g of entityKindGaps) {
    findings.push(finding("warning", "format", `Entity ${g.entity} без entity.type (kind)`, g));
  }
  const roleBaseGaps = checkRoleBase(ontology);
  for (const g of roleBaseGaps) {
    const sev = g.kind === "role-no-base" ? "error" : "warning";
    const msg = g.kind === "role-no-base"
      ? `Role "${g.role}" без base-таксономии`
      : `Role "${g.role}" с нестандартным base="${g.value}"`;
    findings.push(finding(sev, "format", msg, g));
  }
  const ownerGaps = checkOwnerField(ontology);
  for (const g of ownerGaps) {
    findings.push(finding("info", "format", `Entity ${g.entity} мог бы иметь ownerField="${g.candidate}"`, g));
  }

  // 1.2 FK-поля как text (не entityRef)
  const entityNames = new Set(Object.keys(entities));
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const fields = normalizeFields(entityDef.fields);
    for (const f of fields) {
      const fkMatch = /^([a-z]+)Id$/.exec(f.name);
      if (!fkMatch) continue;
      const target = [...entityNames].find(e => e.toLowerCase() === fkMatch[1].toLowerCase());
      if (target && f.type === "text") {
        findings.push(finding("error", "format",
          `FK ${entityName}.${f.name} типизировано как text (должно быть entityRef → ${target})`,
          { entity: entityName, field: f.name, targetEntity: target }));
      }
    }
  }

  // 1.3 Multi-owner candidates
  for (const [entityName, entityDef] of Object.entries(entities)) {
    if (!entityDef.ownerField || entityDef.owners) continue;
    const fields = normalizeFields(entityDef.fields);
    const otherOwners = fields
      .filter(f => /^[a-z]+Id$/.test(f.name) && f.name !== entityDef.ownerField)
      .filter(f => /^(customer|executor|owner|client|seller|assigned|organizer|author|buyer|courier|dispatcher|merchant)/.test(f.name))
      .map(f => f.name);
    if (otherOwners.length > 0) {
      findings.push(finding("info", "format",
        `${entityName} single ownerField="${entityDef.ownerField}"; возможно multi-owner с ${otherOwners.join(", ")}`,
        { entity: entityName, ownerField: entityDef.ownerField, candidates: otherOwners }));
    }
  }

  // 1.4 Invariants alt-shapes
  const invariants = Array.isArray(ontology?.invariants) ? ontology.invariants : [];
  for (const inv of invariants) {
    if (inv.kind === "referential" && !inv.from && inv.entity && inv.references) {
      findings.push(finding("warning", "format",
        `Invariant "${inv.name || "?"}" referential в alt-shape {entity,field,references}`, { name: inv.name }));
    }
    if (inv.kind === "aggregate" && !inv.from && inv.formula) {
      findings.push(finding("warning", "format",
        `Invariant "${inv.name || "?"}" aggregate в alt-shape {formula}`, { name: inv.name }));
    }
  }

  return { findings };
}

// ---------------------------------------------------------------------------
// Axis 2: Derivation health

function auditDerivationHealth(domain, registry) {
  const findings = [];
  const { ontology, intents, projections } = domain;
  const intentsArr = intentsAsArray(intents);

  // Host runtime (V2Shell) merges deriveProjections + authored через
  // spread-merge { ...derived, ...authored } — authored-wins, но derived-only
  // ids сохраняют derivedBy metadata и дают R-rule witnesses в artifact.
  // Повторяем ту же логику для аудита — иначе override-coefficient всегда 1.0.
  let derivedProjections = {};
  try {
    derivedProjections = deriveProjections(intentsArr, ontology);
  } catch {
    // Deriva failed — fallback на authored-only, override-coefficient → 1.0.
  }
  const composedProjections = { ...derivedProjections, ...projections };
  const projectionIds = Object.keys(composedProjections);

  let authored = 0;
  let derived = 0;
  const histogramMatched = [0, 0, 0, 0];
  let totalAlphabeticalFallback = 0;
  let totalPatternsWithApply = 0;
  let totalPatternsMatchingOnly = 0;
  let disabledDeclarations = 0;

  for (const [projId, projection] of Object.entries(composedProjections)) {
    const projFullId = { ...projection, id: projId };

    let matched = [];
    try {
      const r = registry.matchPatterns(intentsArr, ontology, projFullId, { includeNearMiss: false });
      matched = Array.isArray(r) ? r : r.matched || [];
    } catch {}

    const bucket = matched.length === 0 ? 0 : matched.length === 1 ? 1 : matched.length === 2 ? 2 : 3;
    histogramMatched[bucket]++;

    for (const entry of matched) {
      const p = entry.pattern || entry;
      if (typeof p?.structure?.apply === "function") totalPatternsWithApply++;
      else totalPatternsMatchingOnly++;
    }

    try {
      const artifacts = crystallizeV2(intents, { [projId]: projFullId }, ontology, domain.id, {});
      const art = artifacts[projId];
      const witnesses = art?.witnesses || [];
      if (witnesses.some(w => w.basis === "crystallize-rule")) derived++; else authored++;
      totalAlphabeticalFallback += witnesses.filter(w => w.basis === "alphabetical-fallback").length;
    } catch {
      authored++;
    }

    const disabled = projection.patterns?.disabled;
    if (Array.isArray(disabled) && disabled.length > 0) disabledDeclarations += disabled.length;
  }

  const overrideCoefficient = projectionIds.length > 0 ? authored / projectionIds.length : 0;

  if (overrideCoefficient > 0.9 && projectionIds.length >= 5) {
    findings.push(finding("info", "derivation",
      `Override-coefficient ${(overrideCoefficient * 100).toFixed(0)}% (${authored}/${projectionIds.length} authored)`,
      { authored, derived, total: projectionIds.length, coefficient: overrideCoefficient }));
  }
  if (histogramMatched[0] > projectionIds.length * 0.3 && projectionIds.length > 0) {
    findings.push(finding("warning", "derivation",
      `${histogramMatched[0]} проекций без matched patterns`,
      { zeroPatterns: histogramMatched[0], total: projectionIds.length }));
  }
  if (totalAlphabeticalFallback > 0) {
    findings.push(finding("warning", "derivation",
      `${totalAlphabeticalFallback} alphabetical-fallback witness'ов (intent.salience не объявлена)`,
      { count: totalAlphabeticalFallback }));
  }

  return {
    findings,
    metrics: {
      authored, derived, total: projectionIds.length,
      overrideCoefficient: Number(overrideCoefficient.toFixed(3)),
      histogramMatched,
      patternsWithApply: totalPatternsWithApply,
      patternsMatchingOnly: totalPatternsMatchingOnly,
      alphabeticalFallbacks: totalAlphabeticalFallback,
      disabledDeclarations,
    },
  };
}

// ---------------------------------------------------------------------------
// Axis 3: SDK idiom currency

function auditSdkIdiom(domain) {
  const findings = [];
  const { intents, ontology } = domain;
  const entities = ontology?.entities || {};

  // 3.1 intent.irreversibility:"high" без context.__irr
  for (const [intentId, intent] of Object.entries(intents || {})) {
    if (intent.irreversibility === "high") {
      const effects = intent.particles?.effects || [];
      const hasIrrContext = effects.some(e => e?.context?.__irr?.point === "high");
      if (!hasIrrContext) {
        findings.push(finding("warning", "idiom",
          `Intent "${intentId}" — legacy irreversibility:"high" без context.__irr`, { intentId }));
      }
    }
  }

  // 3.2 fieldRole:"money"
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const fields = normalizeFields(entityDef.fields);
    for (const f of fields) {
      if (f.fieldRole === "money") {
        findings.push(finding("info", "idiom",
          `Field ${entityName}.${f.name} fieldRole:"money" (v1.6+ "price")`,
          { entity: entityName, field: f.name }));
      }
    }
  }

  // 3.3 plain entities (без "alias: Entity")
  let plainEntitiesCount = 0;
  for (const intent of Object.values(intents || {})) {
    const ents = intent.particles?.entities || [];
    for (const e of ents) {
      if (typeof e === "string" && !e.includes(":")) plainEntitiesCount++;
    }
  }
  if (plainEntitiesCount > 0) {
    findings.push(finding("info", "idiom",
      `${plainEntitiesCount} intent-entities без alias-form`, { count: plainEntitiesCount }));
  }

  // 3.4 Salience coverage
  let withSalience = 0;
  let total = 0;
  for (const intent of Object.values(intents || {})) {
    total++;
    if (intent.salience !== undefined) withSalience++;
  }

  return {
    findings,
    metrics: {
      intentCount: total,
      salienceDeclared: withSalience,
      salienceCoverage: total > 0 ? Number((withSalience / total).toFixed(3)) : 0,
      plainEntities: plainEntitiesCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Axis 4: Test coverage proxy

function auditTestCoverage(domainId) {
  const findings = [];
  const domainDir = path.join(ROOT, "src", "domains", domainId);
  const scriptsDir = path.join(ROOT, "scripts");

  let testFiles = 0;
  if (fs.existsSync(domainDir)) {
    const files = fs.readdirSync(domainDir);
    testFiles = files.filter(f => /\.test\.[jt]sx?$/.test(f)).length;
  }

  const smokeScripts = fs.existsSync(scriptsDir)
    ? fs.readdirSync(scriptsDir).filter(f => f.startsWith(`${domainId}-`) && (f.endsWith(".mjs") || f.endsWith(".js")))
    : [];

  const hasE2EDoc = fs.existsSync(path.join(domainDir, "E2E_TESTING.md"));

  if (testFiles === 0 && smokeScripts.length === 0 && !hasE2EDoc) {
    findings.push(finding("warning", "testing",
      `Домен ${domainId} без тестов/smoke/e2e-docs`, {}));
  }

  return {
    findings,
    metrics: { testFiles, smokeScripts: smokeScripts.length, hasE2EDoc },
  };
}

// ---------------------------------------------------------------------------
// Axis 5: Cross-domain collisions (aggregate)

function auditCrossDomainCollisions(domains) {
  const findings = [];
  const entityToDomains = new Map();
  const intentToDomains = new Map();

  for (const d of domains) {
    if (!d.ok) continue;
    for (const entityName of Object.keys(d.ontology?.entities || {})) {
      if (!entityToDomains.has(entityName)) entityToDomains.set(entityName, []);
      entityToDomains.get(entityName).push(d.id);
    }
    for (const intentId of Object.keys(d.intents || {})) {
      if (!intentToDomains.has(intentId)) intentToDomains.set(intentId, []);
      intentToDomains.get(intentId).push(d.id);
    }
  }

  const SYSTEM_INTENTS = new Set(["schedule_timer", "revoke_timer"]);
  const sharedEntities = [];
  for (const [ent, list] of entityToDomains) {
    if (list.length >= 2) {
      sharedEntities.push({ entity: ent, domains: list });
      const sev = ent === "User" ? "info" : "warning";
      findings.push(finding(sev, "collision",
        `Entity "${ent}" в ${list.length} доменах: ${list.join(", ")}`,
        { entity: ent, domains: list }));
    }
  }

  const sharedIntents = [];
  for (const [intent, list] of intentToDomains) {
    if (list.length >= 2 && !SYSTEM_INTENTS.has(intent)) {
      sharedIntents.push({ intent, domains: list });
      findings.push(finding("info", "collision",
        `Intent "${intent}" в ${list.length} доменах: ${list.join(", ")}`,
        { intent, domains: list }));
    }
  }

  return { findings, inventory: { sharedEntities, sharedIntents } };
}

// ---------------------------------------------------------------------------
// Axis 6: Pattern application

function auditPatternApplication(domain, registry) {
  const findings = [];
  const { ontology, intents, projections } = domain;
  const intentsArr = intentsAsArray(intents);

  const perProjection = [];
  let totalBehavioralNull = 0;
  for (const [projId, projection] of Object.entries(projections)) {
    const projFullId = { ...projection, id: projId };
    let behavioral = null;
    try { behavioral = resolvePattern(intentsArr, ontology, projFullId); } catch {}
    if (!behavioral || !behavioral.pattern) totalBehavioralNull++;

    let matched = [];
    try {
      const r = registry.matchPatterns(intentsArr, ontology, projFullId, { includeNearMiss: false });
      matched = Array.isArray(r) ? r : r.matched || [];
    } catch {}

    const applyCount = matched.filter(entry => {
      const p = entry.pattern || entry;
      return typeof p?.structure?.apply === "function";
    }).length;

    perProjection.push({
      projectionId: projId,
      archetype: projection.kind || projection.archetype,
      behavioral: behavioral?.pattern || null,
      matchedCount: matched.length,
      applyCount,
    });
  }

  const total = Object.keys(projections).length;
  if (totalBehavioralNull > 0 && total > 0) {
    findings.push(finding("info", "patterns",
      `${totalBehavioralNull}/${total} проекций без behavioral-pattern`,
      { count: totalBehavioralNull, total }));
  }

  return { findings, perProjection };
}

// ---------------------------------------------------------------------------
// Axis 7: Structural health

function auditStructuralHealth(domain) {
  const findings = [];
  const { ontology, intents, projections } = domain;
  const entities = ontology?.entities || {};

  const archetypeHistogram = {};
  for (const proj of Object.values(projections)) {
    const k = proj.kind || proj.archetype || "unknown";
    archetypeHistogram[k] = (archetypeHistogram[k] || 0) + 1;
  }

  let unclassified = 0;
  for (const intent of Object.values(intents || {})) {
    const hasCreates = !!intent.creates;
    const effects = intent.particles?.effects || [];
    const hasMutator = effects.some(e => ["replace", "remove", "create"].includes(e.α));
    if (!hasCreates && !hasMutator) unclassified++;
  }
  if (unclassified > 0) {
    findings.push(finding("info", "structural",
      `${unclassified} intents без creates/mutator classification`, { count: unclassified }));
  }

  // Dead entities
  const mainEntities = new Set(Object.values(projections).map(p => p.mainEntity).filter(Boolean));
  const fkRefs = new Set();
  for (const entityDef of Object.values(entities)) {
    const fields = normalizeFields(entityDef.fields);
    for (const f of fields) {
      if ((f.type === "entityRef" || f.type === "foreignKey") && f.refs) fkRefs.add(f.refs);
    }
  }
  const dead = [];
  for (const entityName of Object.keys(entities)) {
    if (entityName === "User") continue;
    if (entities[entityName].kind === "reference" || entities[entityName].type === "reference") continue;
    if (!mainEntities.has(entityName) && !fkRefs.has(entityName)) dead.push(entityName);
  }
  if (dead.length > 0) {
    findings.push(finding("info", "structural",
      `Возможно dead entities: ${dead.join(", ")}`, { dead }));
  }

  return {
    findings,
    metrics: {
      archetypeHistogram,
      entityCount: Object.keys(entities).length,
      intentCount: Object.keys(intents || {}).length,
      projectionCount: Object.keys(projections).length,
      unclassifiedIntents: unclassified,
      deadEntities: dead.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Orchestration

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes("--json-only");
  const mdOnly = args.includes("--md-only");

  const registry = getDefaultRegistry();
  loadStablePatterns(registry);

  const domains = [];
  for (const name of DOMAIN_NAMES) {
    domains.push(await loadDomain(name));
  }

  const perDomain = {};
  const allFindings = [];

  for (const domain of domains) {
    if (!domain.ok) {
      perDomain[domain.id] = { ok: false, error: domain.error };
      allFindings.push({ ...finding("error", "loading", `Домен ${domain.id} не загрузился: ${domain.error}`, { domain: domain.id }), domain: domain.id, axisKey: "loading" });
      continue;
    }

    const result = { ok: true, axes: {} };
    const axes = [
      ["formatConformance", () => auditFormatConformance(domain)],
      ["derivationHealth", () => auditDerivationHealth(domain, registry)],
      ["sdkIdiom", () => auditSdkIdiom(domain)],
      ["testCoverage", () => auditTestCoverage(domain.id)],
      ["patternApplication", () => auditPatternApplication(domain, registry)],
      ["structuralHealth", () => auditStructuralHealth(domain)],
    ];

    for (const [axisName, fn] of axes) {
      try {
        result.axes[axisName] = fn();
      } catch (e) {
        result.axes[axisName] = { error: e.message, findings: [] };
        allFindings.push({ ...finding("error", "internal", `Axis ${axisName} упал: ${e.message}`, {}), domain: domain.id, axisKey: axisName });
      }
    }

    for (const [axisName, axisResult] of Object.entries(result.axes)) {
      for (const f of (axisResult.findings || [])) {
        allFindings.push({ ...f, domain: domain.id, axisKey: axisName });
      }
    }

    perDomain[domain.id] = result;
  }

  const crossDomain = auditCrossDomainCollisions(domains);
  for (const f of crossDomain.findings) {
    allFindings.push({ ...f, domain: "<cross>", axisKey: "crossDomain" });
  }

  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byAxis = {};
  const byDomain = {};
  for (const f of allFindings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byAxis[f.axis] = (byAxis[f.axis] || 0) + 1;
    byDomain[f.domain] = (byDomain[f.domain] || 0) + 1;
  }

  const topDomains = Object.entries(byDomain).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const report = {
    generatedAt: new Date().toISOString(),
    domains: DOMAIN_NAMES,
    summary: { totalFindings: allFindings.length, bySeverity, byAxis, topDomains },
    perDomain,
    crossDomain: crossDomain.inventory,
  };

  const docsDir = path.join(ROOT, "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  if (!mdOnly) {
    const jsonPath = path.join(docsDir, "domain-audit.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`wrote ${path.relative(ROOT, jsonPath)}`);
  }
  if (!jsonOnly) {
    const mdPath = path.join(docsDir, "domain-audit.md");
    fs.writeFileSync(mdPath, renderMarkdown(report));
    console.log(`wrote ${path.relative(ROOT, mdPath)}`);
  }

  console.log(`\nSummary: ${allFindings.length} findings (error:${bySeverity.error}, warning:${bySeverity.warning}, info:${bySeverity.info})`);
}

// ---------------------------------------------------------------------------
// Markdown rendering

function renderMarkdown(report) {
  const { generatedAt, summary, perDomain, crossDomain } = report;
  const lines = [];
  lines.push(`# Domain audit — ${generatedAt.slice(0, 10)}`);
  lines.push("");
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push(`**Total findings:** ${summary.totalFindings} (error: ${summary.bySeverity.error}, warning: ${summary.bySeverity.warning}, info: ${summary.bySeverity.info})`);
  lines.push("");
  lines.push(`> Report-only. Regeneration: \`node scripts/audit-report.mjs\`. Design rationale — \`docs/superpowers/specs/2026-04-20-domain-audit-design.md\` (local).`);
  lines.push("");

  lines.push(`## Summary leaderboard`);
  lines.push("");
  lines.push("| Axis | Findings |");
  lines.push("|------|----------|");
  for (const [axis, count] of Object.entries(summary.byAxis).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${axis} | ${count} |`);
  }
  lines.push("");
  lines.push("**Top доменов по количеству findings:**");
  lines.push("");
  lines.push("| Domain | Findings |");
  lines.push("|--------|----------|");
  for (const [dom, count] of summary.topDomains) {
    lines.push(`| ${dom} | ${count} |`);
  }
  lines.push("");

  // Axis 2
  lines.push(`## Axis 2 — Derivation health`);
  lines.push("");
  lines.push("| Domain | Authored | Derived | Total | Override | 0-patt | 1-patt | 2-patt | 3+patt | Apply/MatchOnly | Alpha-fb | Disabled |");
  lines.push("|--------|----------|---------|-------|----------|--------|--------|--------|--------|------------------|----------|----------|");
  for (const [dom, res] of Object.entries(perDomain)) {
    if (!res.ok) { lines.push(`| ${dom} | — | — | — | — | — | — | — | — | — | — | — |`); continue; }
    const m = res.axes.derivationHealth?.metrics || {};
    const h = m.histogramMatched || [0, 0, 0, 0];
    lines.push(`| ${dom} | ${m.authored ?? "—"} | ${m.derived ?? "—"} | ${m.total ?? "—"} | ${m.overrideCoefficient ?? "—"} | ${h[0]} | ${h[1]} | ${h[2]} | ${h[3]} | ${m.patternsWithApply ?? 0}/${m.patternsMatchingOnly ?? 0} | ${m.alphabeticalFallbacks ?? 0} | ${m.disabledDeclarations ?? 0} |`);
  }
  lines.push("");

  // Axis 3
  lines.push(`## Axis 3 — SDK idiom currency`);
  lines.push("");
  lines.push("| Domain | Intents | Salience | Plain entities |");
  lines.push("|--------|---------|----------|----------------|");
  for (const [dom, res] of Object.entries(perDomain)) {
    if (!res.ok) { lines.push(`| ${dom} | — | — | — |`); continue; }
    const m = res.axes.sdkIdiom?.metrics || {};
    const sal = m.salienceCoverage != null ? `${(m.salienceCoverage * 100).toFixed(0)}% (${m.salienceDeclared}/${m.intentCount})` : "—";
    lines.push(`| ${dom} | ${m.intentCount ?? "—"} | ${sal} | ${m.plainEntities ?? "—"} |`);
  }
  lines.push("");

  // Axis 4
  lines.push(`## Axis 4 — Test coverage proxy`);
  lines.push("");
  lines.push("| Domain | .test files | Smoke scripts | E2E doc |");
  lines.push("|--------|-------------|---------------|---------|");
  for (const [dom, res] of Object.entries(perDomain)) {
    if (!res.ok) { lines.push(`| ${dom} | — | — | — |`); continue; }
    const m = res.axes.testCoverage?.metrics || {};
    lines.push(`| ${dom} | ${m.testFiles ?? "—"} | ${m.smokeScripts ?? "—"} | ${m.hasE2EDoc ? "✓" : "—"} |`);
  }
  lines.push("");

  // Axis 5
  lines.push(`## Axis 5 — Cross-domain collisions`);
  lines.push("");
  if (crossDomain.sharedEntities.length > 0) {
    lines.push("### Shared entities");
    lines.push("");
    lines.push("| Entity | Domains |");
    lines.push("|--------|---------|");
    for (const e of crossDomain.sharedEntities) lines.push(`| ${e.entity} | ${e.domains.join(", ")} |`);
    lines.push("");
  }
  if (crossDomain.sharedIntents.length > 0) {
    lines.push("### Shared intents (non-system)");
    lines.push("");
    lines.push("| Intent | Domains |");
    lines.push("|--------|---------|");
    for (const i of crossDomain.sharedIntents) lines.push(`| ${i.intent} | ${i.domains.join(", ")} |`);
    lines.push("");
  }
  if (crossDomain.sharedEntities.length === 0 && crossDomain.sharedIntents.length === 0) {
    lines.push("_Нет коллизий._");
    lines.push("");
  }

  // Axis 6
  lines.push(`## Axis 6 — Pattern application`);
  lines.push("");
  lines.push("| Domain | Projections | With apply | Behavioral | Matching-only |");
  lines.push("|--------|-------------|------------|------------|---------------|");
  for (const [dom, res] of Object.entries(perDomain)) {
    if (!res.ok) { lines.push(`| ${dom} | — | — | — | — |`); continue; }
    const pp = res.axes.patternApplication?.perProjection || [];
    const total = pp.length;
    const withApply = pp.filter(p => p.applyCount > 0).length;
    const withBehavioral = pp.filter(p => p.behavioral).length;
    const matchingOnly = pp.filter(p => p.matchedCount > 0 && p.applyCount === 0).length;
    lines.push(`| ${dom} | ${total} | ${withApply} | ${withBehavioral} | ${matchingOnly} |`);
  }
  lines.push("");

  // Axis 7
  lines.push(`## Axis 7 — Structural health`);
  lines.push("");
  lines.push("| Domain | Entities | Intents | Projections | Unclassified | Dead |");
  lines.push("|--------|----------|---------|-------------|--------------|------|");
  for (const [dom, res] of Object.entries(perDomain)) {
    if (!res.ok) { lines.push(`| ${dom} | — | — | — | — | — |`); continue; }
    const m = res.axes.structuralHealth?.metrics || {};
    lines.push(`| ${dom} | ${m.entityCount ?? "—"} | ${m.intentCount ?? "—"} | ${m.projectionCount ?? "—"} | ${m.unclassifiedIntents ?? "—"} | ${m.deadEntities ?? "—"} |`);
  }
  lines.push("");

  // Axis 1 (format) table — last, since it's often longest per-domain
  lines.push(`## Axis 1 — Format conformance (severity summary per domain)`);
  lines.push("");
  lines.push("| Domain | Error | Warning | Info |");
  lines.push("|--------|-------|---------|------|");
  for (const [dom, res] of Object.entries(perDomain)) {
    if (!res.ok) { lines.push(`| ${dom} | — | — | — |`); continue; }
    const f = (res.axes.formatConformance?.findings || []);
    const sev = f.reduce((acc, x) => { acc[x.severity] = (acc[x.severity] || 0) + 1; return acc; }, {});
    lines.push(`| ${dom} | ${sev.error || 0} | ${sev.warning || 0} | ${sev.info || 0} |`);
  }
  lines.push("");

  // Per-domain details
  lines.push("---");
  lines.push("");
  lines.push("## Per-domain details");
  lines.push("");
  for (const [dom, res] of Object.entries(perDomain)) {
    lines.push(`### ${dom}`);
    lines.push("");
    if (!res.ok) {
      lines.push(`**Error:** ${res.error}`);
      lines.push("");
      continue;
    }
    const allFindings = [];
    for (const [axisName, axisResult] of Object.entries(res.axes)) {
      for (const f of (axisResult.findings || [])) {
        allFindings.push({ ...f, axisKey: axisName });
      }
    }
    if (allFindings.length === 0) {
      lines.push("_Без findings._");
      lines.push("");
      continue;
    }
    allFindings.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
    for (const f of allFindings) {
      const icon = f.severity === "error" ? "⛔" : f.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`- ${icon} **${f.axisKey}** — ${f.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

main().catch(err => { console.error(err); process.exit(1); });
