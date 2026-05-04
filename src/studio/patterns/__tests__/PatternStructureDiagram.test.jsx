// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PatternStructureDiagram from "../PatternStructureDiagram.jsx";

afterEach(cleanup);

const FULL = {
  id: "lineage-graph-canvas",
  archetype: "detail",
  trigger: {
    requires: [
      { kind: "sub-entity-exists", "kind:Edge": true, rationale: "entity has Edge sub" },
      { kind: "entity-field", fieldRole: "graphEdge", rationale: "edge typed direction" },
    ],
  },
  structure: {
    slot: "sections",
    description: "Lineage rendered as a directed graph-canvas with current entity centered.",
  },
  rationale: {
    hypothesis: "Tabular lineage forces mental reconstruction; canvas renders DAG natively.",
    evidence: [
      { source: "DataHub", description: "Lineage tab — graph canvas", reliability: "high" },
      { source: "MLflow", description: "Model lineage as DAG", reliability: "medium" },
    ],
    counterexample: [
      { source: "Linear lineage 1 hop", description: "List view sufficient", reliability: "medium" },
    ],
  },
  falsification: {
    shouldMatch: [{ domain: "workflow", projection: "workflow-detail.dag", reason: "DAG" }],
    shouldNotMatch: [
      { domain: "messenger", projection: "conversation-detail", reason: "linear, not graph" },
    ],
  },
};

describe("PatternStructureDiagram (full profile)", () => {
  it("без pattern — показывает hint", () => {
    render(<PatternStructureDiagram pattern={null} />);
    expect(screen.getByText(/Выберите паттерн/)).toBeTruthy();
  });

  it("Trigger — карточки с kind + детали + rationale", () => {
    render(<PatternStructureDiagram pattern={FULL} />);
    expect(screen.getByText(/Trigger · когда срабатывает/)).toBeTruthy();
    expect(screen.getByText("sub-entity-exists")).toBeTruthy();
    expect(screen.getByText("entity-field")).toBeTruthy();
    expect(screen.getByText(/entity has Edge sub/)).toBeTruthy();
  });

  it("Slot transformation — description + slot tag + Before/After колонки", () => {
    render(<PatternStructureDiagram pattern={FULL} />);
    expect(screen.getByText(/Slot transformation/)).toBeTruthy();
    expect(screen.getByText(/Lineage rendered/)).toBeTruthy();
    expect(screen.getByText(/slot: sections/)).toBeTruthy();
    expect(screen.getByText(/Before/)).toBeTruthy();
    expect(screen.getByText(/After · lineage-graph-canvas/)).toBeTruthy();
  });

  it("Hypothesis", () => {
    render(<PatternStructureDiagram pattern={FULL} />);
    expect(screen.getByText(/Hypothesis · зачем/)).toBeTruthy();
    expect(screen.getByText(/Tabular lineage/)).toBeTruthy();
  });

  it("Evidence — карточки с source + description + reliability", () => {
    render(<PatternStructureDiagram pattern={FULL} />);
    expect(screen.getByText(/Evidence · где встречается/)).toBeTruthy();
    expect(screen.getByText("DataHub")).toBeTruthy();
    expect(screen.getByText("MLflow")).toBeTruthy();
  });

  it("Counterexample", () => {
    render(<PatternStructureDiagram pattern={FULL} />);
    expect(screen.getByText(/Counterexample/)).toBeTruthy();
    expect(screen.getByText("Linear lineage 1 hop")).toBeTruthy();
  });

  it("Falsification preview — shouldMatch + shouldNotMatch", () => {
    render(<PatternStructureDiagram pattern={FULL} />);
    expect(screen.getByText(/shouldMatch/)).toBeTruthy();
    expect(screen.getByText(/shouldNotMatch/)).toBeTruthy();
    expect(screen.getByText(/workflow-detail\.dag/)).toBeTruthy();
    expect(screen.getByText(/linear, not graph/)).toBeTruthy();
  });

  it("без trigger.requires — empty hint в Trigger секции", () => {
    render(<PatternStructureDiagram pattern={{ id: "x", structure: { slot: "body" } }} />);
    expect(screen.getByText(/Нет declared requires/)).toBeTruthy();
  });

  it("без structure.slot — warning", () => {
    render(<PatternStructureDiagram pattern={{ id: "x", trigger: { requires: [] }, structure: {} }} />);
    expect(screen.getByText(/не декларирует structure\.slot/)).toBeTruthy();
  });
});
