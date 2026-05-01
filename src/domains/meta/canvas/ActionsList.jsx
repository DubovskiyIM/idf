import React from "react";

const ROW_STYLE = {
  display: "grid", gridTemplateColumns: "240px 80px 1fr 100px",
  padding: "12px 0", borderBottom: "1px dashed #2a2a32",
  fontSize: 13, color: "#bababd",
};

export default function ActionsList({ intents }) {
  const entries = Object.entries(intents || {});
  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={ROW_STYLE}>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>Intent</span>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>α</span>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>target</span>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>confirm</span>
      </div>
      {entries.map(([id, intent]) => (
        <div key={id} style={ROW_STYLE}>
          <span style={{ color: "#f0f0f4", fontWeight: 500 }}>{id}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace", fontSize: 12 }}>{intent.α || "—"}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace", fontSize: 12 }}>{intent.target || "—"}</span>
          <span style={{ color: "#9f9faa" }}>{intent.confirmation || "—"}</span>
        </div>
      ))}
    </div>
  );
}
