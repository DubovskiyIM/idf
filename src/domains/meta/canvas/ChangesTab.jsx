import React from "react";

/**
 * Изменения — лог BacklogItem state-transitions, derived из Φ.
 * Comparable to git log для мета-домена.
 */
export default function ChangesTab({ items = [] }) {
  const events = [];
  for (const it of items) {
    events.push({
      ts: it.createdAt,
      kind: "create",
      title: it.title,
      detail: `section=${it.section}, status=${it.status}`,
      id: `${it.id}-create`,
    });
    if (it.status !== "open" && it.compiledAt) {
      events.push({
        ts: it.compiledAt,
        kind: "transition",
        title: it.title,
        detail: `→ ${it.status}`,
        id: `${it.id}-transition`,
      });
    }
  }
  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        Журнал Φ ({events.length} событий)
      </div>
      {events.length === 0 && (
        <div style={{ color: "#5a5a64", fontSize: 13, textAlign: "center", marginTop: 60 }}>
          Φ пуст. Добавь BacklogItem через chat-history.
        </div>
      )}
      {events.map((ev) => (
        <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "120px 100px 1fr", padding: "10px 0", borderBottom: "1px dashed #2a2a32", fontSize: 12 }}>
          <span style={{ color: "#7a7a85", fontFamily: "monospace" }}>
            {ev.ts ? new Date(ev.ts).toISOString().slice(0, 16).replace("T", " ") : "—"}
          </span>
          <span style={{
            color: ev.kind === "create" ? "#3fb950" : "#daa520",
            fontFamily: "monospace", fontSize: 11,
          }}>
            {ev.kind}
          </span>
          <span style={{ color: "#bababd" }}>
            <strong style={{ color: "#f0f0f4" }}>{ev.title}</strong>
            <span style={{ color: "#7a7a85", marginLeft: 8 }}>{ev.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
