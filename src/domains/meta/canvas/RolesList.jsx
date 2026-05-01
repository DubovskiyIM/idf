import React from "react";

export default function RolesList({ ontology }) {
  const entries = Object.entries(ontology?.roles || {});
  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      {entries.map(([roleId, role]) => (
        <div key={roleId} style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px dashed #2a2a32" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <span style={{ color: "#f0f0f4", fontSize: 16, fontWeight: 500 }}>{roleId}</span>
            <span style={{ color: "#7a7a85", fontSize: 11, textTransform: "uppercase" }}>
              base · {role.base || "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#9f9faa" }}>
            <strong style={{ color: "#bababd" }}>canExecute</strong> ({role.canExecute?.length || 0}):{" "}
            <span style={{ fontFamily: "monospace" }}>
              {(role.canExecute || []).join(", ") || "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#9f9faa", marginTop: 4 }}>
            <strong style={{ color: "#bababd" }}>visibleFields</strong>:{" "}
            <span style={{ fontFamily: "monospace" }}>
              {Object.keys(role.visibleFields || {}).join(", ") || "—"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
