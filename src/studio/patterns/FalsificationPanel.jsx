import React, { useEffect, useState } from "react";
import { runFalsification } from "../api/patterns.js";

// Правая колонка: результат falsification — прогон shouldMatch/shouldNotMatch
// декларативных примеров на реальных проекциях. Кнопка "Run" запускает
// /api/patterns/falsification?id=<patternId>. Строки зелёные когда actual
// совпал с expected, красные — когда нет (регрессия). Внизу — счётчик
// regressions. borderLeft задаёт визуальный разделитель с PatternDetail.
export default function FalsificationPanel({ patternId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Сброс при переключении паттерна — не показывать устаревший результат.
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
    return (
      <div
        style={{
          padding: 20,
          overflowY: "auto",
          borderLeft: "1px solid #1e293b",
          color: "#64748b",
          fontSize: 13,
        }}
      >
        —
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        overflowY: "auto",
        borderLeft: "1px solid #1e293b",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          color: "#e2e8f0",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        Falsification
      </h3>
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
        }}
      >
        {loading ? "Running…" : "Run"}
      </button>

      {error && (
        <div style={{ marginTop: 12, color: "#f87171", fontSize: 12 }}>
          Ошибка: {error}
        </div>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

function Cases({ title, cases }) {
  return (
    <>
      <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>
        <b>{title}</b>
      </div>
      {cases.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>—</div>
      ) : (
        <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
          {cases.map((e, i) => {
            const ok = e.actual === e.expected;
            const color = e.error
              ? "#fbbf24"
              : ok
                ? "#34d399"
                : "#f87171";
            return (
              <li
                key={i}
                style={{ color, marginBottom: 3, fontSize: 12 }}
                title={e.reason || ""}
              >
                <code>
                  {e.domain}/{e.projection}
                </code>
                : {e.error ? `error (${e.error})` : String(e.actual)}
                {!ok && !e.error && " ✗"}
                {ok && !e.error && " ✓"}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ResultView({ result }) {
  const shouldMatch = Array.isArray(result.shouldMatch) ? result.shouldMatch : [];
  const shouldNotMatch = Array.isArray(result.shouldNotMatch)
    ? result.shouldNotMatch
    : [];
  const regressions = Array.isArray(result.regressions) ? result.regressions : [];
  return (
    <div style={{ marginTop: 8 }}>
      <Cases title="Should match" cases={shouldMatch} />
      <Cases title="Should not match" cases={shouldNotMatch} />
      <div
        style={{
          marginTop: 12,
          padding: "6px 10px",
          borderRadius: 4,
          background: regressions.length ? "#7f1d1d" : "#064e3b",
          color: regressions.length ? "#fecaca" : "#bbf7d0",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Regressions: {regressions.length}
      </div>
    </div>
  );
}
