import { useState, useMemo } from "react";

const TYPE_COLORS = {
  internal: "#22c55e",
  mirror: "#60a5fa",
};

export default function OntologyInspector({ world, domain }) {
  const ONTOLOGY = domain?.ONTOLOGY || { entities: {}, predicates: {} };
  const INTENTS = domain?.INTENTS || {};
  const PROJECTIONS = domain?.PROJECTIONS || {};
  const [expandedEntity, setExpandedEntity] = useState(null);

  // Связи: какие намерения используют какую сущность
  const entityIntents = useMemo(() => {
    const map = {};
    for (const [id, intent] of Object.entries(INTENTS)) {
      for (const e of intent.particles.entities) {
        const typeName = e.split(":").pop().trim().replace(/\(.*\)/, "");
        if (!map[typeName]) map[typeName] = [];
        map[typeName].push({ id, name: intent.name, role: e.split(":")[0].trim() });
      }
    }
    return map;
  }, []);

  // Связи: какие проекции показывают какую сущность
  const entityProjections = useMemo(() => {
    const map = {};
    // Простая эвристика: проекция упоминает сущность если witnesses содержат её поля
    for (const [id, proj] of Object.entries(PROJECTIONS)) {
      for (const [entityName, entity] of Object.entries(ONTOLOGY.entities)) {
        const hasField = proj.witnesses.some(w => {
          const field = w.split(".").pop();
          return entity.fields.includes(field) || entity.fields.some(f => w.includes(f));
        });
        if (hasField) {
          if (!map[entityName]) map[entityName] = [];
          map[entityName].push({ id, name: proj.name });
        }
      }
    }
    return map;
  }, []);

  // Связи: какие предикаты используются в каких намерениях
  const predicateIntents = useMemo(() => {
    const map = {};
    for (const [predName, predDef] of Object.entries(ONTOLOGY.predicates)) {
      map[predName] = [];
      for (const [id, intent] of Object.entries(INTENTS)) {
        if (intent.particles.conditions.some(c => c.includes(predDef.split("=")[0].trim().split(".").pop()))) {
          map[predName].push({ id, name: intent.name });
        }
      }
    }
    return map;
  }, []);

  // Статистика мира
  const worldStats = useMemo(() => {
    const stats = {};
    for (const entityName of Object.keys(ONTOLOGY.entities)) {
      const plural = entityName.toLowerCase() + "s";
      const items = world[plural] || [];
      stats[entityName] = {
        count: items.length,
        byStatus: {},
      };
      for (const item of items) {
        if (item.status) {
          stats[entityName].byStatus[item.status] = (stats[entityName].byStatus[item.status] || 0) + 1;
        }
      }
    }
    return stats;
  }, [world]);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>
        Онтология домена
      </h2>

      {/* Сущности */}
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>
        Сущности ({Object.keys(ONTOLOGY.entities).length})
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {Object.entries(ONTOLOGY.entities).map(([name, entity]) => {
          const isExpanded = expandedEntity === name;
          const stats = worldStats[name];
          const intents = entityIntents[name] || [];
          const projections = entityProjections[name] || [];

          return (
            <div key={name} style={{
              background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
              borderLeft: `3px solid ${TYPE_COLORS[entity.type]}`,
              overflow: "hidden",
            }}>
              {/* Заголовок */}
              <div onClick={() => setExpandedEntity(isExpanded ? null : name)}
                style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "system-ui, sans-serif", color: "#1a1a2e" }}>
                  {isExpanded ? "▾" : "▸"} {name}
                </span>
                <span style={{ fontSize: 10, color: TYPE_COLORS[entity.type], fontWeight: 600, textTransform: "uppercase",
                  background: `${TYPE_COLORS[entity.type]}15`, padding: "2px 6px", borderRadius: 4 }}>
                  {entity.type}
                </span>
                <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "system-ui, sans-serif", marginLeft: "auto" }}>
                  {stats.count} экз.
                </span>
                {Object.keys(stats.byStatus).length > 0 && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {Object.entries(stats.byStatus).map(([status, count]) => (
                      <span key={status} style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Детали */}
              {isExpanded && (
                <div style={{ padding: "0 16px 14px", fontFamily: "system-ui, sans-serif" }}>
                  {/* Поля */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Поля</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {entity.fields.map(f => (
                        <span key={f} style={{ fontSize: 11, color: "#1a1a2e", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>{f}</span>
                      ))}
                    </div>
                  </div>

                  {/* Статусы */}
                  {entity.statuses && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Статусы</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {entity.statuses.map(s => (
                          <span key={s} style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 8px", borderRadius: 4 }}>
                            {s} {stats.byStatus[s] ? `(${stats.byStatus[s]})` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Связанные намерения */}
                  {intents.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Намерения ({intents.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {intents.map(i => (
                          <div key={i.id} style={{ fontSize: 11, color: "#1a1a2e" }}>
                            <span style={{ color: "#6366f1", fontWeight: 600 }}>{i.name}</span>
                            <span style={{ color: "#9ca3af", marginLeft: 6 }}>как {i.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Связанные проекции */}
                  {projections.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>Проекции</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {projections.map(p => (
                          <span key={p.id} style={{ fontSize: 11, color: "#8b5cf6", background: "#f5f3ff", padding: "2px 8px", borderRadius: 4 }}>{p.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Предикаты */}
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>
        Предикаты ({Object.keys(ONTOLOGY.predicates).length})
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {Object.entries(ONTOLOGY.predicates).map(([name, definition]) => {
          const intents = predicateIntents[name] || [];
          return (
            <div key={name} style={{
              background: "#fff", borderRadius: 8, padding: "10px 16px",
              border: "1px solid #e5e7eb", fontFamily: "system-ui, sans-serif",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: intents.length ? 6 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>{name}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>≡ {definition}</span>
              </div>
              {intents.length > 0 && (
                <div style={{ fontSize: 10, color: "#9ca3af" }}>
                  Используют: {intents.map(i => i.name).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Статистика мира */}
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>
        World(t) — живая статистика
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Object.entries(worldStats).map(([name, stats]) => (
          <div key={name} style={{
            background: "#fff", borderRadius: 8, padding: "12px 16px",
            border: "1px solid #e5e7eb", minWidth: 120, fontFamily: "system-ui, sans-serif",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1" }}>{stats.count}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{name}</div>
            {Object.keys(stats.byStatus).length > 0 && (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 1 }}>
                {Object.entries(stats.byStatus).map(([s, c]) => (
                  <div key={s} style={{ fontSize: 10, color: "#9ca3af" }}>{s}: {c}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
