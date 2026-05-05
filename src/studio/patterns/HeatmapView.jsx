import React, { useEffect, useMemo, useState } from "react";

// Match Heatmap — таблица паттерн × проекция, цвет ячейки = actual
// (true=зелёный, false=красный, null=серый). Куратор видит за один взгляд:
//   • "этот паттерн уже подходит к 5 проекциям host'а" → промоут
//   • "ни одного match" → отклонить или больше не выкатывать research
//
// Sort by match-count (default desc) — топ-полезные паттерны вверху.
// Filter — query по pattern-id и min-match'у. Cell-click → выбрать паттерн
// (через onPickPattern callback) — возврат в Patterns mode на этот pattern.

const CELL_COLORS = {
  true: "#10b981",
  false: "#7f1d1d",
  null: "#1e293b",
};

function fetchHeatmap(force = false) {
  return fetch(`/api/patterns/heatmap${force ? "?force=1" : ""}`).then((r) => r.json());
}

export default function HeatmapView({ onPickPattern, onBulkChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [sortBy, setSortBy] = useState("match"); // match | miss | undecidable | id
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchHeatmap()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function reload() {
    setLoading(true);
    fetchHeatmap(true)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const sorted = useMemo(() => {
    if (!data?.patterns) return [];
    let list = data.patterns;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.id || "").toLowerCase().includes(q) ||
          (p.refSource || "").toLowerCase().includes(q),
      );
    }
    if (minMatch > 0) {
      list = list.filter((p) => p.stats.match >= minMatch);
    }
    const cmp = {
      match: (a, b) => b.stats.match - a.stats.match,
      miss: (a, b) => b.stats.miss - a.stats.miss,
      undecidable: (a, b) => b.stats.undecidable - a.stats.undecidable,
      id: (a, b) => (a.id || "").localeCompare(b.id || ""),
    }[sortBy];
    return [...list].sort(cmp);
  }, [data, query, minMatch, sortBy]);

  if (loading && !data) {
    return (
      <div style={{ padding: 24, color: "#64748b", fontSize: 13 }}>
        Считаю heatmap (286 паттернов × 600+ проекций)…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, color: "#f87171", fontSize: 13 }}>
        Heatmap error: {error}
      </div>
    );
  }
  if (!data) return null;

  const totals = {
    match: sorted.reduce((s, p) => s + p.stats.match, 0),
    miss: sorted.reduce((s, p) => s + p.stats.miss, 0),
    undecidable: sorted.reduce((s, p) => s + p.stats.undecidable, 0),
  };

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const visibleIds = sorted.map((p) => p.id);
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
    setBulkResult(null);
    setBulkError(null);
  }

  async function bulkPromote(kind) {
    if (selected.size === 0) return;
    // Один archetype для всех — server разрешает per-pattern overrides
    // через archetypeOverrides. Здесь чистый flow: куратор выбрал patterns
    // одного archetype'а (Heatmap фильтрует — sort/min-match), либо мы
    // позволяем server'у фильтровать и собрать только валидные.
    const ids = Array.from(selected);
    const archetypeMap = {};
    for (const p of sorted) {
      if (selected.has(p.id) && p.archetype) archetypeMap[p.id] = p.archetype;
    }
    const verb = kind === "anti" ? "Mark N → Anti" : "Promote N → Stable";
    if (!window.confirm(`${verb} (${ids.length} patterns). Один PR в idf-sdk. Продолжить?`)) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const r = await fetch("/api/patterns/promote-and-pr-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patternIds: ids,
          archetypeOverrides: archetypeMap,
          kind,
        }),
      });
      const result = await r.json();
      if (!r.ok || !result.ok) {
        setBulkError(result);
      } else {
        setBulkResult(result);
        setSelected(new Set());
        onBulkChange?.(result);
      }
    } catch (e) {
      setBulkError({ error: "network", message: e.message });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar
        query={query}
        setQuery={setQuery}
        minMatch={minMatch}
        setMinMatch={setMinMatch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        loading={loading}
        onReload={reload}
        cached={data.cached}
        totals={totals}
        patternCount={sorted.length}
        projectionCount={data.projections.length}
      />
      {(selected.size > 0 || bulkResult || bulkError) && (
        <BulkActionBar
          count={selected.size}
          busy={bulkBusy}
          result={bulkResult}
          error={bulkError}
          onPromote={() => bulkPromote("stable")}
          onAnti={() => bulkPromote("anti")}
          onClear={clearSelection}
          onDismiss={() => { setBulkResult(null); setBulkError(null); }}
        />
      )}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <HeatmapTable
          patterns={sorted}
          projections={data.projections}
          onPickPattern={onPickPattern}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      </div>
    </div>
  );
}

function BulkActionBar({ count, busy, result, error, onPromote, onAnti, onClear, onDismiss }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 14px",
        background: "#1e3a8a",
        borderBottom: "1px solid #1e293b",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {result ? (
        <>
          <span style={{ color: "#86efac" }}>
            ✓ {result.perPattern.filter((p) => p.ok).length}/{result.perPattern.length} promoted
          </span>
          {result.prUrl && (
            <a href={result.prUrl} target="_blank" rel="noreferrer" style={{ color: "#bfdbfe" }}>
              {result.prUrl}
            </a>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onDismiss} style={bulkBtn("transparent", "#bfdbfe")}>Закрыть</button>
        </>
      ) : error ? (
        <>
          <span style={{ color: "#fecaca" }}>
            ✗ {error.error || "error"}: {error.message || ""}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onDismiss} style={bulkBtn("transparent", "#fecaca")}>Закрыть</button>
        </>
      ) : (
        <>
          <span style={{ color: "#e0e7ff", fontWeight: 600 }}>{count} selected</span>
          <button
            onClick={onPromote}
            disabled={busy}
            style={bulkBtn(busy ? "#1e293b" : "#10b981", busy ? "#64748b" : "#020617")}
          >
            {busy ? "…" : `↑ Promote ${count} → Stable`}
          </button>
          <button
            onClick={onAnti}
            disabled={busy}
            style={bulkBtn(busy ? "#1e293b" : "#7f1d1d", busy ? "#64748b" : "#fecaca")}
          >
            {busy ? "…" : `↓ Mark ${count} → Anti`}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onClear} disabled={busy} style={bulkBtn("transparent", "#bfdbfe")}>
            Clear
          </button>
        </>
      )}
    </div>
  );
}

function bulkBtn(bg, fg) {
  return {
    background: bg,
    color: fg,
    border: bg === "transparent" ? "1px solid #334155" : "none",
    padding: "5px 12px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function Toolbar({
  query,
  setQuery,
  minMatch,
  setMinMatch,
  sortBy,
  setSortBy,
  loading,
  onReload,
  cached,
  totals,
  patternCount,
  projectionCount,
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "8px 14px",
        borderBottom: "1px solid #1e293b",
        background: "#0b1220",
        alignItems: "center",
        flexShrink: 0,
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontSize: 11,
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск pattern-id / refSource…"
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          color: "#e2e8f0",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "inherit",
          width: 220,
        }}
      />
      <label style={{ color: "#94a3b8" }}>
        min-match{" "}
        <input
          type="number"
          min={0}
          value={minMatch}
          onChange={(e) => setMinMatch(Number(e.target.value) || 0)}
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            color: "#e2e8f0",
            padding: "2px 4px",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "inherit",
            width: 50,
          }}
        />
      </label>
      <label style={{ color: "#94a3b8" }}>
        sort{" "}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            color: "#e2e8f0",
            padding: "2px 4px",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "inherit",
          }}
        >
          <option value="match">match desc</option>
          <option value="miss">miss desc</option>
          <option value="undecidable">undecidable desc</option>
          <option value="id">id asc</option>
        </select>
      </label>
      <span style={{ color: "#64748b" }}>·</span>
      <span style={{ color: "#94a3b8" }}>
        {patternCount} × {projectionCount}
      </span>
      <span style={{ color: "#10b981" }}>· match {totals.match}</span>
      <span style={{ color: "#f87171" }}>· miss {totals.miss}</span>
      <span style={{ color: "#64748b" }}>· unk {totals.undecidable}</span>
      <div style={{ flex: 1 }} />
      {cached && <span style={{ color: "#64748b" }}>cached</span>}
      <button
        onClick={onReload}
        disabled={loading}
        style={{
          background: "transparent",
          border: "1px solid #1e293b",
          color: "#94a3b8",
          padding: "3px 10px",
          borderRadius: 4,
          fontSize: 11,
          cursor: loading ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {loading ? "…" : "Re-compute"}
      </button>
    </div>
  );
}

function HeatmapTable({ patterns, projections, onPickPattern, selected, onToggle, onToggleAll }) {
  if (patterns.length === 0) {
    return (
      <div style={{ padding: 24, color: "#64748b", fontSize: 12 }}>
        Нет результатов под фильтр.
      </div>
    );
  }
  const sel = selected || new Set();
  const allVisibleSelected = patterns.length > 0 && patterns.every((p) => sel.has(p.id));
  // Group projections by domain для domain-headers в верхней строке.
  const groups = [];
  let current = null;
  for (const p of projections) {
    if (!current || current.domain !== p.domain) {
      current = { domain: p.domain, projections: [] };
      groups.push(current);
    }
    current.projections.push(p);
  }
  return (
    <table
      style={{
        borderCollapse: "collapse",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontSize: 10,
      }}
    >
      <thead>
        <tr>
          <th
            style={{ ...stickyTh, padding: "6px 6px", zIndex: 3, left: 0, width: 24 }}
          >
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={onToggleAll}
              title={allVisibleSelected ? "Снять выделение" : "Выбрать все видимые"}
            />
          </th>
          <th
            style={{
              ...stickyTh,
              left: 24,
              zIndex: 3,
              minWidth: 280,
              textAlign: "left",
              padding: "6px 8px",
            }}
          >
            pattern
          </th>
          <th style={{ ...stickyTh, padding: "6px 8px", zIndex: 2 }}>match</th>
          <th style={{ ...stickyTh, padding: "6px 8px", zIndex: 2 }}>miss</th>
          <th style={{ ...stickyTh, padding: "6px 8px", zIndex: 2 }}>unk</th>
          {groups.map((g) => (
            <th
              key={g.domain}
              colSpan={g.projections.length}
              style={{
                ...stickyTh,
                padding: "6px 4px",
                borderLeft: "2px solid #1e293b",
                color: "#cbd5e1",
                textAlign: "center",
                fontSize: 11,
              }}
            >
              {g.domain}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {patterns.map((p) => (
          <tr
            key={p.id}
            style={sel.has(p.id) ? { background: "#1e293b" } : undefined}
          >
            <td
              style={{
                ...stickyCell,
                left: 0,
                background: sel.has(p.id) ? "#1e3a8a" : "#0b1220",
                padding: "4px 6px",
                width: 24,
                borderBottom: "1px solid #1e293b",
              }}
            >
              <input
                type="checkbox"
                checked={sel.has(p.id)}
                onChange={() => onToggle?.(p.id)}
              />
            </td>
            <td
              style={{
                ...stickyCell,
                left: 24,
                background: sel.has(p.id) ? "#1e3a8a" : "#0b1220",
                padding: "4px 8px",
                fontSize: 11,
                color: "#cbd5e1",
                borderBottom: "1px solid #1e293b",
                cursor: "pointer",
              }}
              title={p.refSource || ""}
              onClick={() => onPickPattern?.(p.id)}
            >
              {p.id}
            </td>
            <StatCell value={p.stats.match} color="#34d399" />
            <StatCell value={p.stats.miss} color="#f87171" />
            <StatCell value={p.stats.undecidable} color="#94a3b8" />
            {groups.map((g) =>
              g.projections.map((proj, idx) => {
                const v = p.matches[proj.key];
                return (
                  <td
                    key={proj.key}
                    onClick={() => onPickPattern?.(p.id)}
                    title={`${proj.domain}/${proj.projection} — ${v}`}
                    style={{
                      width: 10,
                      minWidth: 10,
                      maxWidth: 10,
                      height: 16,
                      background: CELL_COLORS[v] || "#1e293b",
                      borderLeft:
                        idx === 0 ? "2px solid #1e293b" : "1px solid #0b1220",
                      borderBottom: "1px solid #0b1220",
                      cursor: "pointer",
                    }}
                  />
                );
              }),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatCell({ value, color }) {
  return (
    <td
      style={{
        padding: "4px 8px",
        borderBottom: "1px solid #1e293b",
        color,
        fontWeight: 600,
        textAlign: "right",
        background: "#0b1220",
      }}
    >
      {value}
    </td>
  );
}

const stickyTh = {
  position: "sticky",
  top: 0,
  background: "#020617",
  borderBottom: "1px solid #1e293b",
  color: "#94a3b8",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.04em",
};

const stickyCell = {
  position: "sticky",
  zIndex: 1,
};
