import React, { useEffect, useState } from "react";
import { listDomains } from "./api/domains.js";

export default function DomainPicker({ onPick, onNewDomain }) {
  const [domains, setDomains] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    listDomains().then(setDomains).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ padding: 24, color: "#f87171" }}>Ошибка: {err}</div>;
  if (!domains) return <div style={{ padding: 24 }}>Загрузка…</div>;

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>IDF Studio</h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>Выбери домен для авторства или создай новый.</p>
      <div style={{ display: "grid", gap: 8 }}>
        {domains.map((d) => (
          <button key={d.name} onClick={() => onPick(d.name)}
            style={{ textAlign: "left", padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{d.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {d.intents} intents · {d.entities} entities
              {d.warnings > 0 && <span style={{ color: "#eab308" }}> · ⚠ {d.warnings} warnings</span>}
              {d.error && <span style={{ color: "#f87171" }}> · {d.error}</span>}
            </div>
          </button>
        ))}
        <button onClick={onNewDomain}
          style={{ marginTop: 16, padding: 14, background: "transparent", border: "1px dashed #475569", borderRadius: 6, color: "#cbd5e1" }}>
          + Новый домен
        </button>
      </div>
    </div>
  );
}
