import React, { useState } from "react";
import { requestPromotion } from "../api/promotions.js";

const ARCHETYPES = ["catalog", "cross", "detail", "feed"];

export default function PromotionRequestForm({ pattern, onSubmitted, onCancel }) {
  const [targetArchetype, setTargetArchetype] = useState(
    pattern?.archetype || "catalog"
  );
  const [rationale, setRationale] = useState("");
  const [falsificationFixtures, setFalsificationFixtures] = useState("");
  const [weight, setWeight] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!pattern?.id) {
      setError("Pattern не выбран");
      return;
    }
    if (rationale.trim().length < 10) {
      setError("Rationale: минимум 10 символов (≥3 продукта / apply / falsification)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPromotion({
        candidateId: pattern.id,
        targetArchetype,
        rationale: rationale.trim(),
        falsificationFixtures: falsificationFixtures.trim(),
        weight,
      });
      onSubmitted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = { fontSize: 11, color: "#94a3b8", marginBottom: 4, display: "block" };
  const inputStyle = {
    width: "100%",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 4,
    padding: "6px 8px",
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: "ui-monospace, monospace",
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={onSubmit} style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={labelStyle}>Candidate</span>
        <div
          style={{
            ...inputStyle,
            background: "#020617",
            color: "#fbbf24",
          }}
        >
          {pattern?.id || "(не выбран)"}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Target archetype</label>
        <select
          value={targetArchetype}
          onChange={(e) => setTargetArchetype(e.target.value)}
          style={inputStyle}
        >
          {ARCHETYPES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Rationale (≥3 продукта · apply · falsification)</label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Где паттерн встречается, что даёт apply, как falsifiable…"
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Falsification fixtures (опц)</label>
        <textarea
          value={falsificationFixtures}
          onChange={(e) => setFalsificationFixtures(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="shouldMatch / shouldNotMatch fixture refs"
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Curator weight ({weight}/100) — tie-breaker среди competing patterns одного archetype'a
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
          <span>0 — anti-default</span>
          <span>50 — neutral</span>
          <span>100 — strong-prefer</span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d", color: "#fef2f2", padding: 8, fontSize: 12, borderRadius: 4, marginBottom: 8 }}>
          ✗ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            background: busy ? "#334155" : "#3b82f6",
            border: "none",
            color: "#f8fafc",
            padding: "8px 14px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {busy ? "…" : "Request promotion"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#94a3b8",
              padding: "8px 14px",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
