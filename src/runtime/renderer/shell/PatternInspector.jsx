// TODO: add component test when @testing-library/react is installed
//
// PatternInspector — dev-time drawer для Pattern Bank:
//   - загружает /api/patterns/explain для текущей (domain, projection)
//   - показывает behavioral pattern, structural matched + near-miss
//   - позволяет выбрать pattern и переключиться в режим preview
//     (через onPreviewChange → artifactOverride в V2Shell → renderer)
//   - commit enable/disable/clear через /api/patterns/preference
//
// Не покрыт compoment-тестом: в репо нет @testing-library/react + jsdom
// на момент v1.8 preview. Ручная валидация в браузере.

import { useState, useEffect, useCallback, useRef } from "react";

export default function PatternInspector({ domain, projectionId, onClose, onPreviewChange, initialSelectedPatternId = null }) {
  const [explain, setExplain] = useState(null);
  const [mode, setMode] = useState("off"); // "off" | "preview"
  // initialSelectedPatternId — deep-link seed из ?inspect=<patternId>. Применяется
  // только при первом mount; последующие смены пропа игнорируются, чтобы не
  // конкурировать с пользовательским выбором через radio.
  const [selectedPatternId, setSelectedPatternId] = useState(initialSelectedPatternId);

  const load = useCallback(async (preview = null) => {
    if (!domain || !projectionId) return;
    const params = new URLSearchParams({
      domain,
      projection: projectionId,
      includeNearMiss: "1",
    });
    if (preview) params.set("previewPatternId", preview);
    try {
      const r = await fetch(`/api/patterns/explain?${params}`);
      if (!r.ok) {
        setExplain(null);
        return;
      }
      const data = await r.json();
      setExplain(data);
    } catch {
      setExplain(null);
    }
  }, [domain, projectionId]);

  // Reload при смене domain/projection/mode/selectedPatternId.
  // Передаём previewPatternId только если mode === "preview" И выбран pattern.
  useEffect(() => {
    if (mode === "preview" && selectedPatternId) {
      load(selectedPatternId);
    } else {
      load(null);
    }
  }, [mode, selectedPatternId, load]);

  // Сбрасываем selection при смене projection — иначе preview зависнет
  // на id, которого нет в новой projection. Первый mount пропускаем, чтобы
  // не затереть initialSelectedPatternId (deep-link из ?inspect=).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSelectedPatternId(null);
    setMode("off");
  }, [domain, projectionId]);

  // Пробрасываем artifactAfter в V2Shell → renderer override.
  useEffect(() => {
    if (mode === "preview" && explain?.artifactAfter) {
      onPreviewChange?.(explain.artifactAfter);
    } else {
      onPreviewChange?.(null);
    }
  }, [mode, explain, onPreviewChange]);

  const commit = useCallback(async (action) => {
    if (!selectedPatternId) return;
    try {
      await fetch("/api/patterns/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          projection: projectionId,
          patternId: selectedPatternId,
          action,
        }),
      });
    } catch {
      /* ignore — surface не критичный */
    }
    setMode("off");
    await load(null);
  }, [domain, projectionId, selectedPatternId, load]);

  if (!projectionId) {
    return (
      <aside style={drawerStyle}>
        <header style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Pattern inspector</h3>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </header>
        <div style={{ color: "#888", marginTop: 24, fontSize: 12 }}>
          Select a pattern
        </div>
      </aside>
    );
  }

  if (!explain) {
    return (
      <aside style={drawerStyle}>
        <header style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Pattern inspector</h3>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </header>
        <div style={{ color: "#888", marginTop: 24, fontSize: 12 }}>Loading…</div>
      </aside>
    );
  }

  const matched = explain.structural?.matched || [];
  const nearMiss = explain.structural?.nearMiss || [];

  return (
    <aside style={drawerStyle}>
      <header style={headerStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Pattern inspector</h3>
        <button onClick={onClose} style={closeBtnStyle} title="Close">✕</button>
      </header>

      <div style={metaStyle}>projection: <code>{projectionId}</code></div>
      <div style={metaStyle}>archetype: <code>{explain.archetype || "—"}</code></div>

      <section style={sectionStyle}>
        <h4 style={h4Style}>Behavioral</h4>
        {explain.behavioral?.pattern ? (
          <div style={{ fontSize: 12 }}>
            <b>{explain.behavioral.pattern}</b>
            <span style={{ fontSize: 10, color: "#888", marginLeft: 8 }}>
              score {explain.behavioral.score} [{explain.behavioral.confidence}]
            </span>
          </div>
        ) : (
          <div style={{ color: "#888", fontSize: 12 }}>—</div>
        )}
      </section>

      <section style={sectionStyle}>
        <h4 style={h4Style}>Structural — matched ({matched.length})</h4>
        {matched.length === 0 ? (
          <div style={{ color: "#888", fontSize: 12 }}>—</div>
        ) : (
          matched.map(({ pattern, explain: exp }) => {
            const reqs = exp?.requirements || [];
            const passed = reqs.filter(r => r.ok).length;
            const total = reqs.length;
            return (
              <label
                key={pattern.id}
                style={{ display: "block", marginBottom: 4, cursor: "pointer", fontSize: 12 }}
              >
                <input
                  type="radio"
                  name="pi-selected-pattern"
                  checked={selectedPatternId === pattern.id}
                  onChange={() => setSelectedPatternId(pattern.id)}
                  style={{ marginRight: 6 }}
                />
                {pattern.id}
                <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>
                  ✓ {passed}/{total}
                </span>
                {pattern.hasApply === true && (
                  <span style={{ fontSize: 10, color: "#fd8", marginLeft: 4 }}>apply</span>
                )}
              </label>
            );
          })
        )}
      </section>

      <section style={sectionStyle}>
        <h4 style={h4Style}>Structural — near-miss ({nearMiss.length})</h4>
        {nearMiss.length === 0 ? (
          <div style={{ color: "#888", fontSize: 12 }}>—</div>
        ) : (
          nearMiss.map(({ pattern, explain: exp }) => {
            const reqs = exp?.requirements || [];
            const passed = reqs.filter(r => r.ok).length;
            const total = reqs.length;
            return (
              <details key={pattern.id} style={{ marginBottom: 4, fontSize: 12 }}>
                <summary style={{ cursor: "pointer" }}>
                  {pattern.id}
                  <span style={{ fontSize: 10, color: "#fd8", marginLeft: 6 }}>
                    ⚠ {passed}/{total}
                  </span>
                </summary>
                <ul style={{ fontSize: 11, margin: "4px 0 4px 16px", padding: 0, listStyle: "none" }}>
                  {reqs.map((r, i) => (
                    <li key={i} style={{ color: r.ok ? "#4f4" : "#f44" }}>
                      {r.ok ? "✓" : "✗"} {r.kind}
                      {!r.ok && r.spec ? ` ${JSON.stringify(r.spec)}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })
        )}
      </section>

      {selectedPatternId && (() => {
        // hasApply берём из matched/nearMiss — сервер аннотирует флаг на каждой
        // записи. Если паттерн выбран через deep-link и его нет ни в matched,
        // ни в nearMiss (редко, но возможно при смене проекции), считаем apply
        // недоступным — безопаснее заблокировать Preview, чем молча пустить.
        const entry =
          matched.find(m => m.pattern.id === selectedPatternId) ||
          nearMiss.find(m => m.pattern.id === selectedPatternId);
        const hasApply = entry?.pattern?.hasApply === true;
        return (
        <section style={{ ...sectionStyle, borderTop: "1px solid #333", paddingTop: 12 }}>
          <h4 style={h4Style}>Apply preview</h4>
          <div style={{ fontSize: 12 }}>
            pattern: <b>{selectedPatternId}</b>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}>
            <label style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="pi-mode"
                checked={mode === "off"}
                onChange={() => setMode("off")}
                style={{ marginRight: 4 }}
              /> Off
            </label>
            <label
              style={{
                cursor: hasApply ? "pointer" : "not-allowed",
                opacity: hasApply ? 1 : 0.5,
              }}
            >
              <input
                type="radio"
                name="pi-mode"
                checked={mode === "preview"}
                disabled={!hasApply}
                onChange={() => setMode("preview")}
                style={{ marginRight: 4 }}
              /> Preview
            </label>
          </div>
          {!hasApply && (
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 6, lineHeight: 1.4 }}>
              У паттерна нет <code>structure.apply</code> — preview недоступен,
              доступны только Commit enable/disable/clear.
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => commit("enable")} style={btnStyle}>Commit enable</button>
            <button onClick={() => commit("disable")} style={btnStyle}>Disable</button>
            <button onClick={() => commit("clear")} style={btnStyle}>Clear</button>
          </div>
          <div style={{ fontSize: 11, marginTop: 10 }}>
            <a
              href={`/studio#patterns/${selectedPatternId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#8af" }}
            >
              Open in Studio ↗
            </a>
          </div>
        </section>
        );
      })()}
    </aside>
  );
}

const drawerStyle = {
  position: "fixed",
  right: 0,
  top: 0,
  height: "100vh",
  width: 420,
  background: "#1a1a1a",
  color: "#eee",
  padding: 16,
  overflowY: "auto",
  borderLeft: "1px solid #333",
  zIndex: 1000,
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.4)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #333",
  paddingBottom: 8,
  marginBottom: 8,
};

const closeBtnStyle = {
  background: "transparent",
  border: "1px solid #444",
  color: "#eee",
  width: 24,
  height: 24,
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1,
};

const metaStyle = {
  fontSize: 11,
  color: "#888",
  marginBottom: 2,
};

const sectionStyle = {
  marginTop: 16,
};

const h4Style = {
  margin: "0 0 6px 0",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#aaa",
};

const btnStyle = {
  background: "#2a2a2a",
  color: "#eee",
  border: "1px solid #444",
  padding: "4px 10px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
};
