import { describe, it, expect } from "vitest";
const policy = require("./readerGapPolicy.cjs");

describe("server/schema/readerGapPolicy.cjs — thin re-export", () => {
  it("exposes Phase 4 reader gap policy API", () => {
    expect(typeof policy.DEFAULT_READER_POLICIES).toBe("object");
    expect(policy.DEFAULT_PLACEHOLDER).toBe("—");
    expect(typeof policy.getReaderPolicy).toBe("function");
    expect(typeof policy.detectFieldGap).toBe("function");
    expect(typeof policy.resolveGap).toBe("function");
    expect(typeof policy.resolveFieldGap).toBe("function");
    expect(typeof policy.scanEntityGaps).toBe("function");
  });

  it("exposes Phase 5 drift detector API", () => {
    expect(typeof policy.computeCanonicalGapSet).toBe("function");
    expect(typeof policy.compareReaderObservations).toBe("function");
    expect(typeof policy.detectReaderEquivalenceDrift).toBe("function");
  });

  it("getReaderPolicy('agent') matches spec §4.5 defaults", () => {
    const agentPolicy = policy.getReaderPolicy("agent");
    expect(agentPolicy).toEqual({
      missingField: "omit",
      unknownEnumValue: "passthrough",
      removedEntityRef: "broken-link",
    });
  });

  it("computeCanonicalGapSet detects missingField in legacy-style row", () => {
    const ontology = {
      entities: {
        Task: {
          fields: {
            title: { type: "string" },
            priority: { type: "string" },
          },
        },
      },
    };
    const world = { Task: [{ id: "t1", title: "Hi" }] };
    const result = policy.computeCanonicalGapSet(world, ontology);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({
      entity: "Task",
      entityId: "t1",
      field: "priority",
      kind: "missingField",
    });
  });
});

describe("agent /world response shape — gap policy meta integration", () => {
  // Smoke: убеждаемся, что shape, который agent route добавляет в response,
  // соответствует ReaderObservation для detectReaderEquivalenceDrift.
  it("agent meta block is consumable by detectReaderEquivalenceDrift", () => {
    const ontology = {
      entities: {
        Task: { fields: { title: { type: "string" }, priority: { type: "string" } } },
      },
    };
    const filteredWorld = { Task: [{ id: "t1", title: "Hi" }] }; // missing priority

    // Симулируем то, что agent route кладёт в meta:
    const gapPolicy = policy.getReaderPolicy("agent");
    const gapsObserved = policy.computeCanonicalGapSet(filteredWorld, ontology).cells;

    expect(gapPolicy).toBeDefined();
    expect(gapsObserved).toHaveLength(1);

    // Подаём в Layer 4 detector как ReaderObservation
    const report = policy.detectReaderEquivalenceDrift(filteredWorld, ontology, [
      { reader: "agent", gapCells: gapsObserved },
      { reader: "pixels", gapCells: gapsObserved },
    ]);
    expect(report.equivalent).toBe(true);
    expect(report.summary.perReaderGapCount).toEqual({ agent: 1, pixels: 1 });
  });
});
