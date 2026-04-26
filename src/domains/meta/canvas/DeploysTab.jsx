import React from "react";

/**
 * Деплои — версии SDK packages из текущего snapshot, плюс ссылка на
 * compile target (`docs/sdk-improvements-backlog.md` блок backlog-inbox).
 */
export default function DeploysTab({ adapters = [] }) {
  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        SDK adapters ({adapters.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "240px 100px 100px 1fr", padding: "10px 0", borderBottom: "1px solid #2a2a32", fontSize: 11, color: "#7a7a85", textTransform: "uppercase" }}>
        <span>Пакет</span><span>Версия</span><span>License</span><span>Default for</span>
      </div>
      {adapters.map((a) => (
        <div key={a.id} style={{ display: "grid", gridTemplateColumns: "240px 100px 100px 1fr", padding: "10px 0", borderBottom: "1px dashed #2a2a32", fontSize: 12 }}>
          <span style={{ color: "#f0f0f4", fontFamily: "monospace", fontSize: 11 }}>{a.packageName}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace" }}>{a.version || "—"}</span>
          <span style={{ color: "#9f9faa", fontFamily: "monospace", fontSize: 11 }}>{a.license || "—"}</span>
          <span style={{ color: "#9f9faa", fontSize: 11 }}>{a.defaultFor || "—"}</span>
        </div>
      ))}

      <div style={{ marginTop: 32, fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 8 }}>
        Compile targets
      </div>
      <div style={{ padding: "12px 16px", border: "1px solid #2a2a32", borderRadius: 6, background: "#15151a", fontSize: 12 }}>
        <div style={{ color: "#bababd", marginBottom: 4 }}>
          <strong style={{ color: "#f0f0f4" }}>backlog-inbox</strong> → <code style={{ color: "#7c8aff" }}>docs/sdk-improvements-backlog.md</code>
        </div>
        <div style={{ color: "#9f9faa", fontSize: 11, fontFamily: "monospace" }}>
          npm run meta-compile
        </div>
        <div style={{ color: "#7a7a85", fontSize: 11, marginTop: 4 }}>
          Idempotent. Φ → markdown patch между маркерами <code>{"<!-- meta-compile: backlog-inbox -->"}</code>.
        </div>
      </div>
    </div>
  );
}
