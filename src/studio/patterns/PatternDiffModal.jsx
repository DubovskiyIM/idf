import React from "react";

// Side-by-side сравнение candidate vs stable: куратор решает по дубликату
// прямо из карточки, не уходя в stable pattern.
//
// Diff-логика:
//   trigger.requires kinds:
//     shared        → зелёный chip в обеих колонках
//     candidate-only → жёлтый в left
//     stable-only    → красный в right
//   structure.slot match: зелёная плашка если совпадает, жёлтая если нет.
//   archetype match: same.
//   rationale.evidence: side-by-side список (без diff'а — informational).
//
// Esc / клик по backdrop / X → onClose.

function kinds(p) {
  return new Set((p?.trigger?.requires || []).map((r) => r?.kind).filter(Boolean));
}

function Chip({ children, color, faint }) {
  const palette = {
    green: { bg: "#064e3b", border: "#10b981", text: "#bbf7d0" },
    yellow: { bg: "#422006", border: "#fbbf24", text: "#fde68a" },
    red: { bg: "#7f1d1d", border: "#dc2626", text: "#fecaca" },
    grey: { bg: "#0f172a", border: "#334155", text: "#94a3b8" },
  };
  const c = palette[color] || palette.grey;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        margin: "0 4px 4px 0",
        background: faint ? "transparent" : c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        borderRadius: 12,
        fontSize: 11,
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {children}
    </span>
  );
}

function MatchPill({ match, label }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        background: match ? "#064e3b" : "#422006",
        border: `1px solid ${match ? "#10b981" : "#fbbf24"}`,
        color: match ? "#bbf7d0" : "#fde68a",
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {match ? "✓" : "≠"} {label}
    </span>
  );
}

function Column({ title, pattern, sharedKinds, onlyKinds, side }) {
  const slot = pattern?.structure?.slot || pattern?.structure?.target || "—";
  const evidence = pattern?.rationale?.evidence || [];
  const ownKindColor = side === "left" ? "yellow" : "red";
  return (
    <div style={{ flex: 1, padding: 14, minWidth: 0 }}>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "ui-monospace, monospace",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#e2e8f0",
          fontFamily: "ui-monospace, monospace",
          marginBottom: 10,
          wordBreak: "break-all",
        }}
      >
        {pattern?.id || "—"}
      </div>

      <Section title="archetype">
        <code style={{ color: "#cbd5e1" }}>{pattern?.archetype || "—"}</code>
      </Section>
      <Section title="slot">
        <code style={{ color: "#cbd5e1" }}>{slot}</code>
      </Section>

      <Section title="trigger.requires kinds">
        {sharedKinds.size > 0 || onlyKinds.size > 0 ? (
          <>
            {[...sharedKinds].map((k) => (
              <Chip key={`s-${k}`} color="green">
                ✓ {k}
              </Chip>
            ))}
            {[...onlyKinds].map((k) => (
              <Chip key={`o-${k}`} color={ownKindColor}>
                {side === "left" ? "+" : "−"} {k}
              </Chip>
            ))}
          </>
        ) : (
          <span style={{ color: "#475569", fontSize: 12 }}>—</span>
        )}
      </Section>

      {evidence.length > 0 && (
        <Section title="evidence">
          {evidence.slice(0, 5).map((ev, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: "#cbd5e1",
                marginBottom: 3,
              }}
            >
              <strong>{ev.source || "—"}</strong>
              <span style={{ color: "#64748b" }}> · {ev.reliability || "?"}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          fontFamily: "ui-monospace, monospace",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function PatternDiffModal({ candidate, stable, similarity, onClose, onOpenInWorkspace }) {
  if (!candidate || !stable) return null;
  const candKinds = kinds(candidate);
  const stableKinds = kinds(stable);
  const shared = new Set([...candKinds].filter((k) => stableKinds.has(k)));
  const onlyCand = new Set([...candKinds].filter((k) => !stableKinds.has(k)));
  const onlyStable = new Set([...stableKinds].filter((k) => !candKinds.has(k)));
  const slotMatch =
    (candidate.structure?.slot || candidate.structure?.target) ===
    (stable.structure?.slot || stable.structure?.target);
  const archMatch = candidate.archetype && stable.archetype && candidate.archetype === stable.archetype;
  const pct = Math.round((similarity || 0) * 100);

  // Esc-handler
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#020617",
          border: "1px solid #1e293b",
          borderRadius: 8,
          width: "90%",
          maxWidth: 960,
          maxHeight: "85vh",
          overflowY: "auto",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Diff: candidate vs stable</span>
          <span
            style={{
              padding: "2px 8px",
              background: pct >= 65 ? "#422006" : "#0f172a",
              border: `1px solid ${pct >= 65 ? "#fbbf24" : "#334155"}`,
              color: pct >= 65 ? "#fde68a" : "#94a3b8",
              borderRadius: 12,
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            similarity {pct}%
          </span>
          <MatchPill match={archMatch} label="archetype" />
          <MatchPill match={slotMatch} label="slot" />
          <div style={{ flex: 1 }} />
          {onOpenInWorkspace && (
            <button
              onClick={() => onOpenInWorkspace(stable.id)}
              style={{
                background: "transparent",
                border: "1px solid #334155",
                color: "#94a3b8",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Открыть stable →
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#94a3b8",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Esc"
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid #1e293b" }}>
          <Column
            title="Candidate (your)"
            pattern={candidate}
            sharedKinds={shared}
            onlyKinds={onlyCand}
            side="left"
          />
          <div style={{ width: 1, background: "#1e293b" }} />
          <Column
            title="Stable (existing)"
            pattern={stable}
            sharedKinds={shared}
            onlyKinds={onlyStable}
            side="right"
          />
        </div>
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid #1e293b",
            fontSize: 10,
            color: "#475569",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          ✓ shared · + candidate-only · − stable-only · Esc — закрыть
        </div>
      </div>
    </div>
  );
}
