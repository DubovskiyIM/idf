import React, { useMemo, useState } from "react";
import { computeAlgebra } from "@intent-driven/core";
import useDomainModule from "./useDomainModule.js";

const RELATION_META = {
  parallel: { label: "∥ параллельны", color: "#60a5fa", desc: "Могут быть запущены одновременно — не трогают общий state." },
  sequentialOut: { label: "▷ до", color: "#22c55e", desc: "Выполнение этого intent делает conditions этих истинными." },
  sequentialIn: { label: "◁ после", color: "#8b5cf6", desc: "Эти intents делают conditions текущего истинными." },
  antagonists: { label: "⊗ антагонист", color: "#f59e0b", desc: "Отменяет эффект этого intent (reverse operation)." },
  excluding: { label: "⊥ исключают", color: "#ef4444", desc: "Нельзя выполнить одновременно — пересекающиеся effects/conditions." },
};

function RelationPill({ kind, ids, allIntents, onPick }) {
  const meta = RELATION_META[kind];
  if (!meta || !ids || ids.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
      <div style={{ minWidth: 140, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{meta.label}</div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{meta.desc}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
        {ids.map((id) => (
          <button
            key={id}
            onClick={() => onPick?.(id)}
            style={{
              padding: "2px 10px", fontSize: 11, borderRadius: 12,
              background: "#1e293b", border: "1px solid #334155",
              color: "#cbd5e1", cursor: "pointer", fontFamily: "ui-monospace, monospace",
            }}
            title={allIntents[id]?.name || id}
          >{id}</button>
        ))}
      </div>
    </div>
  );
}

export default function AlgebraView({ domainId }) {
  const { domain, loading, error } = useDomainModule(domainId);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");

  const algebra = useMemo(() => {
    if (!domain?.INTENTS || !domain?.ONTOLOGY) return {};
    try { return computeAlgebra(domain.INTENTS, domain.ONTOLOGY); }
    catch { return {}; }
  }, [domain]);

  const intentIds = useMemo(() => Object.keys(algebra).sort(), [algebra]);
  const filteredIds = useMemo(() => {
    if (!filter) return intentIds;
    const q = filter.toLowerCase();
    return intentIds.filter((id) =>
      id.toLowerCase().includes(q) || (domain?.INTENTS?.[id]?.name || "").toLowerCase().includes(q)
    );
  }, [intentIds, filter, domain]);

  const counts = useMemo(() => {
    let parallel = 0, seq = 0, anta = 0, excl = 0;
    for (const id of intentIds) {
      const a = algebra[id] || {};
      parallel += (a.parallel || []).length;
      seq += (a.sequentialOut || []).length;
      anta += (a.antagonists || []).length;
      excl += (a.excluding || []).length;
    }
    return { parallel: parallel / 2, seq, anta, excl: excl / 2 }; // unordered → /2
  }, [algebra, intentIds]);

  if (!domainId) return <Placeholder>Выбери домен во вкладке «Граф»</Placeholder>;
  if (loading) return <Placeholder>Загружаю домен…</Placeholder>;
  if (error) return <Placeholder color="#f87171">{error}</Placeholder>;
  if (intentIds.length === 0) return <Placeholder>Алгебра пуста — в домене нет намерений</Placeholder>;

  const selectedData = selected ? algebra[selected] : null;
  const selectedIntent = selected ? domain?.INTENTS?.[selected] : null;

  return (
    <div style={{ height: "100%", display: "flex", background: "#0b1220", color: "#e2e8f0", fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      {/* Левая колонка — список intents с filter */}
      <div style={{ width: 320, borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            Алгебра · {intentIds.length} intents
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
            <div>∥ parallel: <span style={{ color: "#60a5fa" }}>{Math.round(counts.parallel)}</span></div>
            <div>▷ sequential: <span style={{ color: "#22c55e" }}>{counts.seq}</span></div>
            <div>⊗ antagonists: <span style={{ color: "#f59e0b" }}>{counts.anta}</span></div>
            <div>⊥ excluding: <span style={{ color: "#ef4444" }}>{Math.round(counts.excl)}</span></div>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск intent'а…"
            style={{
              width: "100%", padding: "7px 10px",
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 5, color: "#e2e8f0", fontSize: 12,
              fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          {filteredIds.map((id) => {
            const a = algebra[id] || {};
            const hasConflict = (a.excluding || []).length > 0;
            const hasAntagonist = (a.antagonists || []).length > 0;
            const active = id === selected;
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 10px", marginBottom: 4,
                  background: active ? "#4338ca" : "transparent",
                  border: `1px solid ${active ? "#6366f1" : "#1e293b"}`,
                  borderRadius: 5, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 12, color: active ? "white" : "#e2e8f0", fontWeight: active ? 600 : 400, marginBottom: 2, fontFamily: "ui-monospace, monospace" }}>
                  {id}
                </div>
                <div style={{ fontSize: 10, color: active ? "#c7d2fe" : "#64748b", display: "flex", gap: 8 }}>
                  {hasConflict && <span style={{ color: active ? "#fca5a5" : "#ef4444" }}>⊥ {a.excluding.length}</span>}
                  {hasAntagonist && <span style={{ color: active ? "#fde68a" : "#f59e0b" }}>⊗ {a.antagonists.length}</span>}
                  {(a.parallel || []).length > 0 && <span>∥ {a.parallel.length}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Правая панель — relations выбранного intent */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {!selected ? (
          <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", marginTop: 80, lineHeight: 1.6 }}>
            Выбери intent слева — увидишь его позицию в алгебре.<br/>
            <span style={{ fontSize: 11 }}>параллели · последовательности · антагонисты · исключения</span>
          </div>
        ) : !selectedData ? (
          <div style={{ color: "#f87171", fontSize: 13 }}>Данных нет для {selected}</div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Intent</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "ui-monospace, monospace", marginTop: 4 }}>{selected}</div>
              {selectedIntent?.name && <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{selectedIntent.name}</div>}
            </div>

            <RelationPill kind="parallel" ids={selectedData.parallel} allIntents={domain.INTENTS} onPick={setSelected} />
            <RelationPill kind="sequentialOut" ids={selectedData.sequentialOut} allIntents={domain.INTENTS} onPick={setSelected} />
            <RelationPill kind="sequentialIn" ids={selectedData.sequentialIn} allIntents={domain.INTENTS} onPick={setSelected} />
            <RelationPill kind="antagonists" ids={selectedData.antagonists} allIntents={domain.INTENTS} onPick={setSelected} />
            <RelationPill kind="excluding" ids={selectedData.excluding} allIntents={domain.INTENTS} onPick={setSelected} />

            {/* Particles */}
            {selectedIntent?.particles && (
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #1e293b" }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Particles</div>
                <pre style={{
                  fontSize: 11, lineHeight: 1.55, color: "#cbd5e1",
                  background: "#0f172a", border: "1px solid #1e293b",
                  borderRadius: 6, padding: 14, overflow: "auto",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  whiteSpace: "pre-wrap",
                }}>
                  {JSON.stringify(selectedIntent.particles, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Placeholder({ children, color = "#94a3b8" }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 14, fontFamily: "Inter, system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
