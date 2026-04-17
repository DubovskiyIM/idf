import React from "react";

// Stub: реальный вызов runFalsification(patternId) — в следующих тасках.
export default function FalsificationPanel({ patternId }) {
  return (
    <div style={{ padding: 20, color: "#888" }}>{patternId || "—"}</div>
  );
}
