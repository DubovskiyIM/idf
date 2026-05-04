import React, { useState } from "react";

// "Promote → SDK PR" — одна кнопка которая делает full pipeline:
// POST /api/patterns/promote-and-pr {patternId, summary} → server копирует
// JSON в idf-sdk/.../candidate/<archetype>/<id>.js, патчит curated.js,
// пишет .changeset/, git push, gh pr create. Возвращает PR URL.
//
// Server gating: CURATOR_PR_ENABLED=1 + IDF_SDK_PATH + gh auth.
// При 403/503 показываем причину прямо в UI — куратор не угадывает env.

const VALID_ARCHETYPES = ["catalog", "detail", "feed", "cross"];

export default function PromoteToPrButton({ pattern, onPrCreated }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showLog, setShowLog] = useState(false);
  // Если pattern.archetype отсутствует или не из whitelist — куратор должен
  // явно выбрать. Pre-fill значение из pattern.archetype если оно валидное.
  const initialArchetype = VALID_ARCHETYPES.includes(pattern.archetype)
    ? pattern.archetype
    : "";
  const [archetype, setArchetype] = useState(initialArchetype);

  const summary =
    pattern.rationale?.hypothesis ||
    pattern.structure?.description ||
    `Promote candidate \`${pattern.id}\` from idf refs.`;

  async function go() {
    if (busy) return;
    if (!archetype) {
      setError({ error: "archetype-missing", message: "Выбери archetype перед промоцией" });
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/patterns/promote-and-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId: pattern.id, summary, archetype }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError({ status: r.status, ...data });
      } else {
        setResult(data);
        onPrCreated?.(data);
      }
    } catch (e) {
      setError({ status: "network", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {!result && !error && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={go}
              disabled={busy || !archetype}
              style={{
                background: busy || !archetype ? "#1e293b" : "#10b981",
                border: "none",
                color: busy || !archetype ? "#64748b" : "#020617",
                padding: "8px 14px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: busy || !archetype ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {busy ? "Делаю PR…" : "↑ Promote → SDK PR"}
            </button>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
              archetype:
              <select
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
                style={{
                  background: "#0f172a",
                  color: archetype ? "#e2e8f0" : "#fbbf24",
                  border: `1px solid ${archetype ? "#334155" : "#fbbf24"}`,
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontFamily: "inherit",
                }}
              >
                <option value="">— выбери —</option>
                {VALID_ARCHETYPES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            {!archetype && (
              <span style={{ fontSize: 11, color: "#fbbf24" }}>
                pattern.archetype отсутствует — выбери вручную
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            git push в idf-sdk + gh pr create. Полностью автоматически.
            Файл попадёт в <code>candidate/{archetype || "<archetype>"}/{pattern.id}.js</code>.
          </div>
        </div>
      )}

      {result && (
        <div
          style={{
            background: "#064e3b",
            border: "1px solid #10b981",
            borderRadius: 4,
            padding: 10,
          }}
        >
          <div style={{ color: "#86efac", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            ✓ PR создан в ветке <code>{result.branch}</code>
          </div>
          {result.prUrl && (
            <a
              href={result.prUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#60a5fa", fontSize: 12, fontFamily: "ui-monospace, monospace" }}
            >
              {result.prUrl}
            </a>
          )}
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => setShowLog(!showLog)}
              style={logBtn}
            >
              {showLog ? "Hide log" : "Show log"}
            </button>
          </div>
          {showLog && <LogView log={result.log} />}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#7f1d1d",
            border: "1px solid #dc2626",
            borderRadius: 4,
            padding: 10,
          }}
        >
          <div style={{ color: "#fecaca", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            ✗ {error.error || "error"}: {error.message || ""}
          </div>
          {error.error === "disabled" && (
            <div style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.5 }}>
              На сервере не задан <code>CURATOR_PR_ENABLED=1</code>. Запусти server
              c флагом: <code>CURATOR_PR_ENABLED=1 IDF_SDK_PATH=/абс/путь/к/idf-sdk npm run server</code>.
            </div>
          )}
          {error.error === "sdk-path-missing" && (
            <div style={{ fontSize: 11, color: "#fca5a5" }}>
              <code>IDF_SDK_PATH</code> не задан или не указывает на существующий
              idf-sdk worktree.
            </div>
          )}
          {error.error === "collision" && (
            <div style={{ fontSize: 11, color: "#fca5a5" }}>
              Файл уже существует в idf-sdk — паттерн раньше уже промоутили.
              Открой ветку с предыдущей попыткой.
            </div>
          )}
          {error.log && (
            <div style={{ marginTop: 6 }}>
              <button onClick={() => setShowLog(!showLog)} style={logBtn}>
                {showLog ? "Hide log" : "Show log"}
              </button>
              {showLog && <LogView log={error.log} />}
            </div>
          )}
          <button
            onClick={() => {
              setError(null);
              setResult(null);
            }}
            style={{ ...logBtn, marginTop: 6, marginLeft: 6 }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function LogView({ log }) {
  if (!log || log.length === 0) return null;
  return (
    <pre
      style={{
        marginTop: 6,
        background: "#020617",
        color: "#cbd5e1",
        fontSize: 10,
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        padding: 8,
        borderRadius: 4,
        maxHeight: 240,
        overflow: "auto",
        whiteSpace: "pre-wrap",
      }}
    >
      {log.join("\n")}
    </pre>
  );
}

const logBtn = {
  background: "transparent",
  border: "1px solid #334155",
  color: "#94a3b8",
  padding: "2px 8px",
  borderRadius: 3,
  fontSize: 10,
  cursor: "pointer",
  fontFamily: "inherit",
};
