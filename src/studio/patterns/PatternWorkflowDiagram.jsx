import React from "react";

// Компактный progress-tracker (~22px high). Заменяет старую hero-SVG, которая
// доминировала экран без actionable value. Stage'ы — chips с активной
// подсветкой; rejected branch — inline chip после shipped с dashed connector.
//
// Stage'ы соответствуют meta-ontology lifecycle:
//   candidate → pending → approved → shipped (irreversibility=high)
//                       └→ rejected (dashed off pending)

const STAGES = [
  { id: "candidate", label: "Candidate" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "shipped", label: "Shipped" },
];

const COLORS = {
  candidate: "#fbbf24",
  pending: "#fbbf24",
  approved: "#34d399",
  shipped: "#10b981",
  rejected: "#f87171",
};

function Chip({ id, label, current, irr }) {
  const active = current === id;
  const accent = COLORS[id];
  return (
    <span
      title={irr && active ? "irreversibility=high" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 10px",
        borderRadius: 12,
        fontSize: 11,
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        background: active ? accent : "#0f172a",
        color: active ? "#020617" : "#64748b",
        border: `1px solid ${active ? accent : "#1e293b"}`,
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {active && irr && <span style={{ marginLeft: 4, fontSize: 9 }}>⚠</span>}
    </span>
  );
}

function Arrow({ dashed = false, faint = false }) {
  return (
    <span
      aria-hidden
      style={{ color: faint ? "#334155" : "#475569", fontSize: 11, margin: "0 6px" }}
    >
      {dashed ? "⤳" : "→"}
    </span>
  );
}

export default function PatternWorkflowDiagram({ currentStage = null }) {
  const isRejected = currentStage === "rejected";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap" }}>
      <Chip id="candidate" label="Candidate" current={currentStage} />
      <Arrow />
      <Chip id="pending" label="Pending" current={currentStage} />
      <Arrow />
      <Chip id="approved" label="Approved" current={currentStage} />
      <Arrow />
      <Chip id="shipped" label="Shipped" current={currentStage} irr />
      <Arrow dashed faint={!isRejected} />
      <Chip id="rejected" label="Rejected" current={currentStage} />
    </div>
  );
}
