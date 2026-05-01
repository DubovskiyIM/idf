import React, { useState, useEffect, useRef } from "react";

/**
 * Live — SSE stream /api/effects/stream. Показывает effect:confirmed /
 * effect:rejected события в реальном времени.
 */
export default function LiveTab() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("idle");
  const sseRef = useRef(null);

  useEffect(() => {
    setStatus("connecting");
    const es = new EventSource("/api/effects/stream");
    sseRef.current = es;

    es.onopen = () => setStatus("connected");
    es.onerror = () => setStatus("error");

    const handle = (kind) => (ev) => {
      let payload;
      try { payload = JSON.parse(ev.data); } catch { payload = ev.data; }
      setEvents((prev) => [
        { id: `${Date.now()}-${Math.random()}`, kind, ts: Date.now(), payload },
        ...prev.slice(0, 99),
      ]);
    };

    for (const k of ["effect:confirmed", "effect:rejected", "effect:proposed", "effect:batch"]) {
      es.addEventListener(k, handle(k));
    }

    return () => es.close();
  }, []);

  const statusColor = { connected: "#3fb950", connecting: "#daa520", error: "#e85a5a", idle: "#7a7a85" };

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 4,
          background: statusColor[status], display: "inline-block",
        }} />
        <span style={{ fontSize: 13, color: "#bababd" }}>SSE: {status}</span>
        <span style={{ fontSize: 11, color: "#7a7a85", marginLeft: "auto" }}>
          {events.length} events (last 100)
        </span>
      </div>
      {events.length === 0 && status === "connected" && (
        <div style={{ color: "#5a5a64", fontSize: 13, textAlign: "center", marginTop: 60 }}>
          Слушаю /api/effects/stream… Создай эффект чтобы увидеть.
        </div>
      )}
      {events.map((e) => (
        <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px dashed #2a2a32", fontSize: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ color: "#7a7a85", fontFamily: "monospace" }}>
              {new Date(e.ts).toISOString().slice(11, 19)}
            </span>
            <span style={{
              color: e.kind === "effect:confirmed" ? "#3fb950"
                : e.kind === "effect:rejected" ? "#e85a5a" : "#7c8aff",
              fontFamily: "monospace",
            }}>
              {e.kind}
            </span>
            <span style={{ color: "#bababd", fontFamily: "monospace", fontSize: 11 }}>
              {typeof e.payload === "object" ? (e.payload?.id || JSON.stringify(e.payload).slice(0, 80)) : String(e.payload).slice(0, 80)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
