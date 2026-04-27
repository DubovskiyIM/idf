import React from "react";

export default function StudioHeader({ domain, onBack, onDelete }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 24,
      padding: "16px 24px", borderBottom: "1px solid #2a2a32",
      background: "#0d0d10",
    }}>
      <button
        onClick={onBack}
        style={{
          background: "transparent", border: "none", color: "#9f9faa",
          fontSize: 13, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        ← проекты
      </button>
      <div style={{ flex: 1 }}>
        <h1 style={{
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: 24, fontWeight: 400, color: "#f0f0f4",
          margin: 0,
        }}>
          {domain.title || domain.name || "—"}
        </h1>
        <div style={{
          fontSize: 11, color: "#7a7a85", fontFamily: "ui-monospace, monospace",
          marginTop: 2,
        }}>
          {domain.id || "—"}
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", border: "1px solid #2a2a32", borderRadius: 6,
        fontSize: 13, color: "#9f9faa", fontFamily: "ui-monospace, monospace",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 4, background: "#3fb950",
          display: "inline-block",
        }} />
        {domain.id}.app.intent-design.tech
      </div>
      <button
        onClick={onDelete}
        style={{
          padding: "10px 18px",
          background: "transparent", color: "#e85a5a",
          border: "1px solid #5a2a2a", borderRadius: 6,
          fontSize: 13, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Удалить
      </button>
    </div>
  );
}
