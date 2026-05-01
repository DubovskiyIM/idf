import React from "react";

export default function JsonPanel({ ontology }) {
  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <pre style={{
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontSize: 11, lineHeight: 1.5, color: "#9f9faa",
        background: "#0d0d10", padding: 16, borderRadius: 4,
        maxHeight: 600, overflow: "auto", margin: 0,
      }}>
        {JSON.stringify(ontology, null, 2)}
      </pre>
    </div>
  );
}
