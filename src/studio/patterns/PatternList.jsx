import React, { useMemo, useState } from "react";

// Статусы упорядочены: stable → candidate → anti (от «проверенных» к «анти»).
const STATUS_ORDER = ["stable", "candidate", "anti"];
const STATUS_LABEL = {
  stable: "Stable",
  candidate: "Candidate",
  anti: "Anti",
};
const STATUS_COLOR = {
  stable: "#34d399",
  candidate: "#fbbf24",
  anti: "#f87171",
};

// Левая колонка: поиск, группировка по status → archetype, apply-badge.
// Скроллится независимо — overflowY:auto; shell PatternsView не скроллится.
export default function PatternList({ patterns, selected, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return patterns;
    const q = query.trim().toLowerCase();
    return patterns.filter((p) => {
      const hay = [
        p.id,
        p.archetype,
        p.status,
        p.structure?.slot,
        p.rationale,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [patterns, query]);

  // Двухуровневая группировка: сначала status, потом archetype.
  const grouped = useMemo(() => {
    const byStatus = {};
    for (const p of filtered) {
      const s = p.status || "candidate";
      if (!byStatus[s]) byStatus[s] = {};
      const a = p.archetype || "—";
      if (!byStatus[s][a]) byStatus[s][a] = [];
      byStatus[s][a].push(p);
    }
    return byStatus;
  }, [filtered]);

  return (
    <div
      style={{
        borderRight: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #1e293b",
          background: "#0b1220",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по id, archetype, slot…"
          style={{
            width: "100%",
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid #334155",
            borderRadius: 4,
            padding: "6px 8px",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
          {filtered.length} из {patterns.length}
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
        {STATUS_ORDER.map((status) => {
          const archetypes = grouped[status];
          if (!archetypes) return null;
          return (
            <div key={status} style={{ marginBottom: 8 }}>
              <div
                style={{
                  padding: "8px 12px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: STATUS_COLOR[status],
                }}
              >
                {STATUS_LABEL[status]}
              </div>
              {Object.entries(archetypes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([archetype, items]) => (
                  <div key={`${status}:${archetype}`}>
                    <div
                      style={{
                        padding: "4px 12px",
                        fontSize: 10,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                      }}
                    >
                      {archetype}
                    </div>
                    {items.map((p) => {
                      const isSelected = p.id === selected;
                      return (
                        <div
                          key={p.id}
                          onClick={() => onSelect(p.id)}
                          style={{
                            padding: "6px 12px",
                            cursor: "pointer",
                            background: isSelected ? "#1e3a8a" : "transparent",
                            borderLeft: isSelected
                              ? "3px solid #60a5fa"
                              : "3px solid transparent",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: isSelected ? "#e0e7ff" : "#cbd5e1",
                            }}
                          >
                            {p.id}
                          </span>
                          {p.hasApply && (
                            <span
                              title="Есть structure.apply — паттерн может обогащать слоты"
                              style={{
                                fontSize: 9,
                                background: "#1d4ed8",
                                color: "#dbeafe",
                                padding: "1px 5px",
                                borderRadius: 3,
                                fontWeight: 600,
                                letterSpacing: 0.3,
                                flexShrink: 0,
                              }}
                            >
                              APPLY
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: "#64748b" }}>
            Ничего не найдено
          </div>
        )}
      </div>
    </div>
  );
}
