import { describe, it, expect } from "vitest";
import { deriveProjections } from "./deriveProjections.js";

import { INTENTS as BOOKING_INTENTS } from "../../domains/booking/intents.js";
import { ONTOLOGY as BOOKING_ONTOLOGY } from "../../domains/booking/ontology.js";
import { PROJECTIONS as BOOKING_PROJECTIONS } from "../../domains/booking/projections.js";

import { INTENTS as PLANNING_INTENTS } from "../../domains/planning/intents.js";
import { ONTOLOGY as PLANNING_ONTOLOGY } from "../../domains/planning/ontology.js";
import { PROJECTIONS as PLANNING_PROJECTIONS } from "../../domains/planning/projections.js";

import { INTENTS as WORKFLOW_INTENTS } from "../../domains/workflow/intents.js";
import { ONTOLOGY as WORKFLOW_ONTOLOGY } from "../../domains/workflow/ontology.js";
import { PROJECTIONS as WORKFLOW_PROJECTIONS } from "../../domains/workflow/projections.js";

import { INTENTS as MESSENGER_INTENTS } from "../../domains/messenger/intents.js";
import { ONTOLOGY as MESSENGER_ONTOLOGY } from "../../domains/messenger/ontology.js";
import { PROJECTIONS as MESSENGER_PROJECTIONS } from "../../domains/messenger/projections.js";

import { INTENTS as MESHOK_INTENTS } from "../../domains/meshok/intents.js";
import { ONTOLOGY as MESHOK_ONTOLOGY } from "../../domains/meshok/ontology.js";
import { PROJECTIONS as MESHOK_PROJECTIONS } from "../../domains/meshok/projections.js";

function computeCoverage(INTENTS, ONTOLOGY, PROJECTIONS) {
  const derived = deriveProjections(INTENTS, ONTOLOGY);
  const authoredIds = Object.keys(PROJECTIONS);
  const derivedIds = Object.keys(derived);

  const covered = [];
  const uncovered = [];

  for (const id of authoredIds) {
    const exact = derived[id];
    if (exact) {
      covered.push(id);
      continue;
    }
    // Ищем по mainEntity + kind
    const authoredMain = PROJECTIONS[id].mainEntity;
    const authoredKind = PROJECTIONS[id].kind;
    const match = derivedIds.find(did =>
      derived[did].mainEntity === authoredMain && derived[did].kind === authoredKind
    );
    if (match) {
      covered.push(id);
    } else {
      uncovered.push(id);
    }
  }

  return { derived, derivedIds, authoredIds, covered, uncovered };
}

function validateDomain(name, INTENTS, ONTOLOGY, PROJECTIONS) {
  describe(`${name}: deriveProjections`, () => {
    const { derived, derivedIds, authoredIds, covered, uncovered } = computeCoverage(INTENTS, ONTOLOGY, PROJECTIONS);

    it("derives at least some projections", () => {
      expect(derivedIds.length).toBeGreaterThan(0);
    });

    it("kind+mainEntity coverage ≥ 50%", () => {
      const pct = covered.length / authoredIds.length;
      console.log(
        `  ${name}: ${covered.length}/${authoredIds.length} (${(pct * 100).toFixed(0)}%)` +
        ` | derived ${derivedIds.length} total`
      );
      if (uncovered.length > 0) {
        console.log(`  uncovered: ${uncovered.join(", ")}`);
      }
      expect(pct).toBeGreaterThanOrEqual(0.5);
    });

    it("all derived projections have valid kind", () => {
      const validKinds = ["catalog", "detail", "feed"];
      for (const [id, proj] of Object.entries(derived)) {
        expect(validKinds, `${id} has invalid kind: ${proj.kind}`).toContain(proj.kind);
      }
    });

    it("all derived projections have mainEntity in ontology", () => {
      const entityNames = Object.keys(ONTOLOGY.entities || {});
      for (const [id, proj] of Object.entries(derived)) {
        expect(entityNames, `${id}: ${proj.mainEntity} not in ontology`).toContain(proj.mainEntity);
      }
    });
  });
}

validateDomain("booking", BOOKING_INTENTS, BOOKING_ONTOLOGY, BOOKING_PROJECTIONS);
validateDomain("planning", PLANNING_INTENTS, PLANNING_ONTOLOGY, PLANNING_PROJECTIONS);
validateDomain("workflow", WORKFLOW_INTENTS, WORKFLOW_ONTOLOGY, WORKFLOW_PROJECTIONS);
validateDomain("messenger", MESSENGER_INTENTS, MESSENGER_ONTOLOGY, MESSENGER_PROJECTIONS);
validateDomain("meshok", MESHOK_INTENTS, MESHOK_ONTOLOGY, MESHOK_PROJECTIONS);

describe("deriveProjections: summary", () => {
  const domains = [
    { name: "booking", INTENTS: BOOKING_INTENTS, ONTOLOGY: BOOKING_ONTOLOGY, PROJECTIONS: BOOKING_PROJECTIONS },
    { name: "planning", INTENTS: PLANNING_INTENTS, ONTOLOGY: PLANNING_ONTOLOGY, PROJECTIONS: PLANNING_PROJECTIONS },
    { name: "workflow", INTENTS: WORKFLOW_INTENTS, ONTOLOGY: WORKFLOW_ONTOLOGY, PROJECTIONS: WORKFLOW_PROJECTIONS },
    { name: "messenger", INTENTS: MESSENGER_INTENTS, ONTOLOGY: MESSENGER_ONTOLOGY, PROJECTIONS: MESSENGER_PROJECTIONS },
    { name: "meshok", INTENTS: MESHOK_INTENTS, ONTOLOGY: MESHOK_ONTOLOGY, PROJECTIONS: MESHOK_PROJECTIONS },
  ];

  it("total coverage ≥ 60%", () => {
    let totalAuthored = 0;
    let totalCovered = 0;

    for (const { name, INTENTS, ONTOLOGY, PROJECTIONS } of domains) {
      const { covered, authoredIds, derivedIds } = computeCoverage(INTENTS, ONTOLOGY, PROJECTIONS);
      console.log(`${name}: ${covered.length}/${authoredIds.length} (${(covered.length / authoredIds.length * 100).toFixed(0)}%) | derived ${derivedIds.length} total`);
      totalAuthored += authoredIds.length;
      totalCovered += covered.length;
    }

    console.log(`\nTOTAL: ${totalCovered}/${totalAuthored} (${(totalCovered / totalAuthored * 100).toFixed(0)}%)`);
    expect(totalCovered / totalAuthored).toBeGreaterThanOrEqual(0.6);
  });
});
