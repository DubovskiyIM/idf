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

export default function HeatmapView({ onPickPattern }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [sortBy, setSortBy] = useState("match"); // match | miss | undecidable | id

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
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <HeatmapTable
          patterns={sorted}
          projections={data.projections}
          onPickPattern={onPickPattern}
        />
      </div>
    </div>
  );
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

function HeatmapTable({ patterns, projections, onPickPattern }) {
  if (patterns.length === 0) {
    return (
      <div style={{ padding: 24, color: "#64748b", fontSize: 12 }}>
        Нет результатов под фильтр.
      </div>
    );
  }
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
            style={{
              ...stickyTh,
              left: 0,
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
          <tr key={p.id}>
            <td
              style={{
                ...stickyCell,
                left: 0,
                background: "#0b1220",
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
