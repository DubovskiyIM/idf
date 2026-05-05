import React, { useState } from "react";

// Recovery-fallback: куратор сам слил PR в idf-sdk до auto-persistence
// patch'а, или auto-record упал. Кнопка "Mark as shipped" принимает
// PR URL и записывает PatternPromotion(status=shipped) в Φ — lifecycle
// chip двигается, Inbox показывает запись.

export default function MarkShippedRecovery({ pattern, onRecorded }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function go() {
    if (!url.trim().match(/^https?:\/\/.+/)) {
      setError("URL должен начинаться с http(s)://");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/patterns/mark-shipped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patternId: pattern.id,
          sdkPrUrl: url.trim(),
          archetype: pattern.archetype || null,
          rationale: `Recovery: PR смержен до auto-persistence patch'а или независимо.`,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.message || data.error || `HTTP ${r.status}`);
      } else {
        setOpen(false);
        setUrl("");
        onRecorded?.();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "1px solid #475569",
          color: "#94a3b8",
          padding: "6px 12px",
          borderRadius: 4,
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
          marginBottom: 12,
        }}
        title="Если PR в idf-sdk уже создан/смержен, но lifecycle всё ещё Candidate"
      >
        Mark as shipped (recovery)
      </button>
    );
  }
  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid #334155",
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
        Запиши shipped-promotion ретроспективно (если auto-promote не записал в Φ).
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/.../pull/N"
        style={{
          width: "100%",
          background: "#020617",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 4,
          padding: "6px 8px",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          marginBottom: 8,
          boxSizing: "border-box",
        }}
      />
      {error && (
        <div style={{ color: "#fca5a5", fontSize: 11, marginBottom: 6 }}>✗ {error}</div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={go}
          disabled={busy || !url.trim()}
          style={{
            background: busy || !url.trim() ? "#1e293b" : "#10b981",
            border: "none",
            color: busy || !url.trim() ? "#64748b" : "#020617",
            padding: "6px 12px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: busy || !url.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {busy ? "…" : "Записать"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setUrl("");
            setError(null);
          }}
          style={{
            background: "transparent",
            border: "1px solid #334155",
            color: "#94a3b8",
            padding: "6px 12px",
            borderRadius: 4,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
