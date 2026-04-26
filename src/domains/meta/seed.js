/**
 * Seed meta-домена: трансформирует meta-snapshot.json в host-format
 * effects (`{intent_id:"_seed", alpha:"add", target:"<plural>", ...}`).
 *
 * Snapshot регенерируется через `node scripts/build-meta-snapshot.mjs`
 * перед dev/build (вручную в L1; в L2 — Vite-plugin или backend route).
 */

import { SNAPSHOT as snapshot } from "./meta-snapshot.js";

const NOW = snapshot.snapshottedAt || Date.now();

function ef(target, ctx, idPrefix = "seed_meta") {
  return {
    id: `${idPrefix}_${target}_${ctx.id}`,
    intent_id: "_seed",
    alpha: "add",
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: NOW,
    resolved_at: NOW,
    target,
    value: null,
    context: { ...ctx, createdAt: ctx.createdAt || NOW },
  };
}

function compositeId(parts) {
  return parts.filter(Boolean).join("__");
}

export function getSeedEffects() {
  const out = [];

  // ── Domains ────────────────────────────────────────────────────
  for (const d of snapshot.domains || []) {
    out.push(
      ef("domains", {
        id: d.id,
        name: d.name,
        title: d.title,
        adapter: d.adapter,
        fieldTestNumber: d.fieldTestNumber,
        domainScope: d.domainScope,
        entityCount: d.entityCount,
        roleCount: d.roleCount,
        invariantCount: d.invariantCount,
        ruleCount: d.ruleCount,
        intentCount: d.intentCount,
        projectionCount: d.projectionCount,
        snapshottedAt: d.snapshottedAt,
      }),
    );
  }

  // ── Intents ────────────────────────────────────────────────────
  for (const it of snapshot.intents || []) {
    const cid = compositeId([it.domainId, it.intentId]);
    out.push(
      ef("intents", {
        id: cid,
        domainId: it.domainId,
        intentId: it.intentId,
        name: it.name || it.intentId,
        alpha: it.alpha,
        target: it.target,
        confirmation: it.confirmation,
        category: null,
        hasIrr: !!it.hasIrr,
        irrPoint: it.irrPoint,
      }),
    );
  }

  // ── Projections ────────────────────────────────────────────────
  for (const p of snapshot.projections || []) {
    const cid = compositeId([p.domainId, p.projectionId]);
    out.push(
      ef("projections", {
        id: cid,
        domainId: p.domainId,
        projectionId: p.projectionId,
        title: p.title || p.projectionId,
        archetype: p.archetype,
        mainEntity: p.mainEntity,
        derived: false,
        forRoles: p.forRoles,
        witnessCount: p.witnessCount || 0,
      }),
    );
  }

  // ── Patterns ───────────────────────────────────────────────────
  // GAP-meta-1: patternId не уникален между stable и candidate банками
  // (один и тот же паттерн может одновременно быть в SDK stable и в
  // pattern-bank/candidate как «новое наблюдение в другом продукте»).
  // Composite-id `${status}__${patternId}__${source?}` снимает коллизию
  // на уровне Φ.
  for (const pt of [...(snapshot.stablePatterns || []), ...(snapshot.candidatePatterns || [])]) {
    const cid = compositeId([pt.status, pt.patternId, pt.sourceProduct]);
    out.push(
      ef("patterns", {
        id: cid,
        patternId: pt.patternId,
        name: pt.name,
        status: pt.status,
        axis: pt.axis,
        archetypeScope: pt.archetypeScope,
        hasApply: !!pt.hasApply,
        version: pt.version || 0,
        bankPath: pt.bankPath,
        sourceProduct: pt.sourceProduct,
      }),
    );
  }

  // ── Witnesses ──────────────────────────────────────────────────
  for (const w of snapshot.witnesses || []) {
    out.push(
      ef("witnesses", {
        id: w.witnessId,
        domainId: w.domainId,
        projectionId: w.projectionId,
        archetype: w.archetype,
        slotPath: w.slotPath,
        basis: w.basis,
        reliability: w.reliability,
        patternId: w.patternId,
        ruleId: w.ruleId,
        rationale: w.rationale,
        origin: w.origin,
      }),
    );
  }

  // ── Rules ──────────────────────────────────────────────────────
  for (const r of snapshot.rules || []) {
    out.push(
      ef("rRules", {
        id: r.ruleId,
        domainId: r.domainId,
        name: r.name,
        kind: r.kind,
        trigger: r.trigger,
      }),
    );
  }

  // ── Adapters ───────────────────────────────────────────────────
  for (const a of snapshot.adapters || []) {
    out.push(
      ef("adapters", {
        id: a.id,
        packageName: a.packageName,
        version: a.version,
        license: a.license,
        style: a.style,
        defaultFor: a.defaultFor,
      }),
    );
  }

  // ── Capabilities ───────────────────────────────────────────────
  for (const c of snapshot.capabilities || []) {
    out.push(
      ef("capabilities", {
        id: c.capabilityId,
        adapterId: c.adapterId,
        namespace: c.namespace,
        key: c.key,
        supported: !!c.supported,
        variant: c.variant,
      }),
    );
  }

  return out;
}

export const SEED_SUMMARY = snapshot.summary;
