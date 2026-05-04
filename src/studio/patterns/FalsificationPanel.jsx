import React, { useEffect, useState } from "react";
import { runFalsification } from "../api/patterns.js";

// Falsification view с per-require breakdown.
//
// Server возвращает per-fixture: { domain, projection, expected, actual,
// perRequire: [{ kind, ok, reason }], error? }. Каждая fixture-карточка
// разворачивается в expandable список requires с цветовым код'ом
// (true=зелёный, false=красный, "unknown"=жёлтый), а fixture-row красится
// по итоговому actual vs expected.
//
// Регрессии включают только cases где actual !== expected и actual !== null.
// "actual: null" (live-undecidable) — серая нейтральная строка, не regression.

const ROW_COLORS = {
  match: { bg: "#0f291f", border: "#10b981", text: "#bbf7d0" }, // actual=expected
  miss: { bg: "#3a0e10", border: "#dc2626", text: "#fecaca" }, // actual=other expected
  undecidable: { bg: "#1e293b", border: "#475569", text: "#94a3b8" }, // actual=null
  error: { bg: "#3b2a04", border: "#fbbf24", text: "#fef3c7" }, // domain/projection-not-found
};

const REQ_COLORS = {
  true: { bg: "#0f291f", border: "#10b981", text: "#bbf7d0", icon: "✓" },
  false: { bg: "#3a0e10", border: "#dc2626", text: "#fecaca", icon: "✗" },
  unknown: { bg: "#1e293b", border: "#fbbf24", text: "#fde68a", icon: "?" },
};

export default function FalsificationPanel({ patternId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [patternId]);

  async function run() {
    if (!patternId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await runFalsification(patternId);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!patternId) {
    return <div style={{ padding: 20, color: "#64748b", fontSize: 13 }}>—</div>;
  }

  return (
    <div style={{ padding: 16, overflowY: "auto", fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button
          onClick={run}
          disabled={loading}
          style={{
            background: loading ? "#1e293b" : "#1d4ed8",
            color: "#e0e7ff",
            border: "1px solid #334155",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            cursor: loading ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {loading ? "Running…" : "Run falsification"}
        </button>
        {result?.note && (
          <span style={{ fontSize: 11, color: "#64748b" }}>{result.note}</span>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, color: "#f87171", fontSize: 12 }}>
          Ошибка: {error}
        </div>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

function classifyFixture(c) {
  if (c.error && c.actual === null) return "error";
  if (c.actual === null) return "undecidable";
  return c.actual === c.expected ? "match" : "miss";
}

function FixtureCard({ fixture }) {
  const [open, setOpen] = useState(false);
  const klass = classifyFixture(fixture);
  const c = ROW_COLORS[klass];
  const hasReqs = Array.isArray(fixture.perRequire) && fixture.perRequire.length > 0;
  const verdict =
    klass === "match"
      ? "✓ matches expected"
      : klass === "miss"
        ? `✗ actual=${fixture.actual}, expected=${fixture.expected}`
        : klass === "undecidable"
          ? "⊘ undecidable"
          : `⚠ ${fixture.error}`;

  return (
    <div
      style={{
        background: c.bg,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 4,
        padding: "8px 10px",
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          cursor: hasReqs ? "pointer" : "default",
        }}
        onClick={() => hasReqs && setOpen(!open)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              color: "#e2e8f0",
              fontSize: 12,
            }}
          >
            <span style={{ color: c.text, fontWeight: 600 }}>
              {fixture.domain || "—"}
            </span>
            <span style={{ color: "#475569" }}> · </span>
            <span style={{ color: "#94a3b8" }}>{fixture.projection || "?"}</span>
          </div>
          {fixture.reason && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
              {fixture.reason}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: c.text,
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
          }}
        >
          {verdict}
          {hasReqs && (
            <span style={{ marginLeft: 6, color: "#475569" }}>
              {open ? "▾" : "▸"}
            </span>
          )}
        </div>
      </div>

      {open && hasReqs && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e293b" }}>
          {fixture.perRequire.map((r, i) => {
            const okStr = String(r.ok); // "true" | "false" | "unknown"
            const rc = REQ_COLORS[okStr] || REQ_COLORS.unknown;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 11,
                  marginBottom: 4,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                <span
                  style={{
                    width: 14,
                    color: rc.text,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {rc.icon}
                </span>
                <span
                  style={{
                    background: rc.bg,
                    border: `1px solid ${rc.border}`,
                    borderRadius: 8,
                    padding: "0 6px",
                    color: rc.text,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {r.kind}
                </span>
                <span style={{ color: "#94a3b8", flex: 1 }}>{r.reason}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FixtureGroup({ title, fixtures, accent }) {
  if (!fixtures || fixtures.length === 0) {
    return (
      <div style={{ marginBottom: 14 }}>
        <Header accent={accent}>{title} (0)</Header>
        <div style={{ color: "#475569", fontSize: 12 }}>—</div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <Header accent={accent}>
        {title} ({fixtures.length})
      </Header>
      {fixtures.map((f, i) => (
        <FixtureCard key={i} fixture={f} />
      ))}
    </div>
  );
}

function Header({ children, accent }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "ui-monospace, monospace",
        color: accent,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function ResultView({ result }) {
  const shouldMatch = Array.isArray(result.shouldMatch) ? result.shouldMatch : [];
  const shouldNotMatch = Array.isArray(result.shouldNotMatch) ? result.shouldNotMatch : [];
  const regressions = Array.isArray(result.regressions) ? result.regressions : [];
  return (
    <div style={{ marginTop: 8 }}>
      <FixtureGroup title="Should match" fixtures={shouldMatch} accent="#10b981" />
      <FixtureGroup title="Should NOT match" fixtures={shouldNotMatch} accent="#f87171" />
      <div
        style={{
          marginTop: 6,
          padding: "8px 10px",
          borderRadius: 4,
          background: regressions.length ? "#7f1d1d" : "#064e3b",
          color: regressions.length ? "#fecaca" : "#bbf7d0",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        Regressions: {regressions.length}
        {regressions.length === 0 && <span style={{ color: "#86efac" }}> ✓</span>}
      </div>
    </div>
  );
}
