import React from "react";

/**
 * Сводка-карточка как на Fold Studio screenshot: заголовок домена
 * (`meta`), описание, отделённые counts (Сущности / Действия / Роли /
 * Инварианты).
 */
export default function SummaryCard({ domain }) {
  const counts = [
    { label: "Сущности", value: domain.entityCount || 0 },
    { label: "Действия", value: domain.intentCount || 0 },
    { label: "Роли", value: domain.roleCount || 0 },
    { label: "Инварианты", value: domain.invariantCount || 0 },
  ];

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
        Домен
      </div>
      <h2 style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: 32, fontWeight: 400, margin: "0 0 12px", color: "#f0f0f4" }}>
        {domain.name || domain.id || "—"}
      </h2>
      {domain.description && (
        <p style={{ fontSize: 13, color: "#9f9faa", lineHeight: 1.6, margin: "0 0 32px", maxWidth: 720 }}>
          {domain.description}
        </p>
      )}
      <div style={{ borderTop: "1px solid #2a2a32" }}>
        {counts.map((c) => (
          <div key={c.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            padding: "16px 0", borderBottom: "1px dashed #2a2a32",
          }}>
            <span style={{ fontSize: 14, color: "#bababd" }}>{c.label}</span>
            <span style={{ fontSize: 24, fontWeight: 300, color: "#f0f0f4" }}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
