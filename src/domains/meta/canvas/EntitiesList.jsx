import React from "react";

const ROW_STYLE = {
  display: "grid", gridTemplateColumns: "180px 100px 1fr",
  padding: "12px 0", borderBottom: "1px dashed #2a2a32",
  fontSize: 13, color: "#bababd",
};

export default function EntitiesList({ ontology }) {
  const entries = Object.entries(ontology?.entities || {});
  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={ROW_STYLE}>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>Имя</span>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>Kind</span>
        <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>Поля (top-5)</span>
      </div>
      {entries.map(([name, ent]) => (
        <div key={name} style={ROW_STYLE}>
          <span style={{ color: "#f0f0f4", fontWeight: 500 }}>{name}</span>
          <span style={{ color: "#9f9faa" }}>{ent.kind || "—"}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace", fontSize: 12 }}>
            {Object.keys(ent.fields || {}).slice(0, 5).join(", ")}
            {Object.keys(ent.fields || {}).length > 5 ? "…" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
