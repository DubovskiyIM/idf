#!/usr/bin/env node
/**
 * Seed N heuristic witnesses в Φ для blind H4 protocol.
 *
 * Цель: создать «реальные» witness rows с reliability=heuristic на
 * конкретных (projectionId, slotPath) парах. Эти rows станут targets
 * для iter 7+ blind run'а — workItem обозначает существующий witness
 * с heuristic reliability, и LLM должен решить как его mutate.
 *
 * Структурное давление работает так:
 *   - LLM пытается propose_witness для same (projectionId, slotPath,
 *     reliability) → новый invariant `witness_unique_per_slot_reliability`
 *     блокирует (cardinality max=1)
 *   - LLM пытается propose_witness с другим reliability → semantically
 *     irrelevant (создаст ещё один witness, не mutates existing)
 *   - LLM использует newly-created intent с α=replace → проходит
 *
 * Usage:
 *   node scripts/seed-heuristic-witnesses.mjs        # default 20 witnesses
 *   N=15 node scripts/seed-heuristic-witnesses.mjs
 */

import { randomUUID } from "node:crypto";

const HOST = process.env.HOST_BASE ?? "http://localhost:3001";
const N = Number(process.env.N ?? 20);

async function postEffect(effect) {
  const res = await fetch(`${HOST}/api/effects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(effect),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/effects ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  console.log(`Seeding ${N} heuristic witnesses in Φ at ${HOST}...`);
  const seeded = [];
  for (let i = 1; i <= N; i++) {
    const id = randomUUID();
    const projectionId = `meta:domain_detail`;
    const slotPath = `slots.body.fields.heuristic_${i}`;
    const effect = {
      id,
      intent_id: "_seed_heuristic",
      alpha: "create",
      target: "Witness",
      value: null,
      scope: "account",
      parent_id: null,
      ttl: null,
      context: JSON.stringify({
        id,
        projectionId,
        slotPath,
        basis: "crystallize-rule",
        reliability: "heuristic",
        rationale: `Seeded for blind H4 protocol — heuristic witness ${i}.`,
        origin: "authored",
        source: "seed-heuristic-witnesses",
      }),
      created_at: new Date().toISOString(),
    };
    try {
      const r = await postEffect(effect);
      seeded.push({ id, projectionId, slotPath, status: r.status });
      process.stdout.write(`  ${i}/${N} ${id.slice(0, 8)} → ${r.status}\n`);
    } catch (e) {
      console.error(`  ${i}/${N} FAILED: ${e.message}`);
    }
  }
  const confirmed = seeded.filter((s) => s.status === "confirmed").length;
  console.log(`\n${confirmed}/${seeded.length} confirmed. Witness IDs:`);
  console.log(seeded.filter((s) => s.status === "confirmed").map((s) => s.id).join("\n"));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
