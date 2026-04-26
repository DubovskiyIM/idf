import React from "react";

/**
 * Аудит — invariant'ы домена + их kind/severity. Из мета-онтологии
 * читаются 8 invariants (referential / expression / transition).
 */
export default function AuditTab({ ontology }) {
  const invariants = ontology?.invariants || [];
  const byKind = {};
  for (const inv of invariants) {
    byKind[inv.kind] = (byKind[inv.kind] || 0) + 1;
  }

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        Инварианты ({invariants.length}) — distribution
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {Object.entries(byKind).map(([kind, n]) => (
          <div key={kind} style={{ padding: "8px 16px", border: "1px solid #2a2a32", borderRadius: 6, background: "#15151a" }}>
            <div style={{ fontSize: 11, color: "#7a7a85" }}>{kind}</div>
            <div style={{ fontSize: 20, color: "#f0f0f4", fontWeight: 300 }}>{n}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 120px 1fr", padding: "10px 0", borderBottom: "1px solid #2a2a32", fontSize: 11, color: "#7a7a85", textTransform: "uppercase" }}>
        <span>Имя</span><span>Kind</span><span>Детали</span>
      </div>
      {invariants.map((inv, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: "240px 120px 1fr", padding: "10px 0", borderBottom: "1px dashed #2a2a32", fontSize: 12 }}>
          <span style={{ color: "#f0f0f4", fontWeight: 500 }}>{inv.name || "—"}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace" }}>{inv.kind}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace", fontSize: 11 }}>
            {inv.kind === "referential" && `${inv.from} → ${inv.to}`}
            {inv.kind === "expression" && `entity=${inv.entity}, predicate=…`}
            {inv.kind === "transition" && `entity=${inv.entity}.${inv.field}, ${Object.keys(inv.transitions || {}).length} states`}
            {inv.kind === "cardinality" && `entity=${inv.entity}, max=${inv.max}`}
            {inv.kind === "aggregate" && `entity=${inv.entity}`}
            {inv.kind === "role-capability" && `role=${inv.role}`}
          </span>
        </div>
      ))}
    </div>
  );
}
