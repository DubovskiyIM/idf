import React from "react";

// SVG-схема pipeline продвижения паттерна candidate → stable.
// Подсвечивает текущую стадию (по props.currentStage) контрастным fill.
//
// Stage'ы соответствуют meta-ontology lifecycle:
//   candidate (pattern.status="candidate")
//   pending   (PatternPromotion.status="pending")
//   approved  (PatternPromotion.status="approved")
//   shipped   (PatternPromotion.status="shipped", sdkPrUrl set, irreversibility=high)
//   rejected  (PatternPromotion.status="rejected", branch off pending)
//
// currentStage = null → нейтральная диаграмма (для top-level orientation).

const STAGES = [
  { id: "candidate", label: "Candidate", x: 40 },
  { id: "pending", label: "Pending", x: 200 },
  { id: "approved", label: "Approved", x: 360 },
  { id: "shipped", label: "Shipped", x: 520 },
];
const REJECTED = { id: "rejected", label: "Rejected", x: 360, y: 130 };

const COLORS = {
  active: { fill: "#3b82f6", stroke: "#60a5fa", text: "#f8fafc" },
  inactive: { fill: "#1e293b", stroke: "#334155", text: "#94a3b8" },
  shipped: { fill: "#10b981", stroke: "#34d399", text: "#f8fafc" },
  rejected: { fill: "#7f1d1d", stroke: "#dc2626", text: "#fef2f2" },
};

function colorForStage(stageId, currentStage) {
  if (stageId === currentStage) {
    if (stageId === "shipped") return COLORS.shipped;
    if (stageId === "rejected") return COLORS.rejected;
    return COLORS.active;
  }
  return COLORS.inactive;
}

function StageBox({ stage, currentStage, irreversibility }) {
  const c = colorForStage(stage.id, currentStage);
  const w = 130;
  const h = 56;
  const y = stage.y != null ? stage.y : 60;
  return (
    <g transform={`translate(${stage.x}, ${y})`}>
      <rect
        width={w}
        height={h}
        rx={8}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={stage.id === currentStage ? 2 : 1}
      />
      <text
        x={w / 2}
        y={h / 2 + 5}
        textAnchor="middle"
        fontSize={13}
        fontWeight={stage.id === currentStage ? 600 : 500}
        fill={c.text}
        fontFamily="ui-monospace, 'SF Mono', monospace"
      >
        {stage.label}
      </text>
      {irreversibility === "high" && stage.id === "shipped" && (
        <text
          x={w / 2}
          y={h - 6}
          textAnchor="middle"
          fontSize={9}
          fill={c.text}
          opacity={0.85}
        >
          ⚠ irreversibility=high
        </text>
      )}
    </g>
  );
}

function Arrow({ from, to, dashed = false, color = "#475569" }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray={dashed ? "5 4" : undefined}
      markerEnd="url(#arrowhead)"
    />
  );
}

export default function PatternWorkflowDiagram({ currentStage = null, compact = false }) {
  const W = 680;
  const H = compact ? 130 : 220;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{
        background: "#0b1220",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 4,
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="9"
          markerHeight="9"
          refX="8"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#475569" />
        </marker>
      </defs>

      {/* Forward path: candidate → pending → approved → shipped */}
      {STAGES.map((s, i) =>
        i < STAGES.length - 1 ? (
          <Arrow
            key={`arr-${i}`}
            from={{ x: STAGES[i].x + 130, y: 88 }}
            to={{ x: STAGES[i + 1].x, y: 88 }}
            color={
              currentStage === STAGES[i + 1].id ||
              currentStage === STAGES[i].id
                ? "#60a5fa"
                : "#334155"
            }
          />
        ) : null,
      )}

      {/* Reject branch: pending → rejected */}
      <Arrow
        from={{ x: STAGES[1].x + 65, y: 116 }}
        to={{ x: REJECTED.x + 30, y: REJECTED.y - 4 }}
        dashed
        color={currentStage === "rejected" ? "#dc2626" : "#334155"}
      />

      {STAGES.map((s) => (
        <StageBox
          key={s.id}
          stage={s}
          currentStage={currentStage}
          irreversibility="high"
        />
      ))}
      <StageBox stage={REJECTED} currentStage={currentStage} />

      {!compact && (
        <text
          x={W / 2}
          y={H - 12}
          textAnchor="middle"
          fontSize={11}
          fill="#64748b"
          fontFamily="ui-monospace, monospace"
        >
          intent: request_pattern_promotion → approve / reject → ship_pattern_promotion (__irr=high)
        </text>
      )}
    </svg>
  );
}
