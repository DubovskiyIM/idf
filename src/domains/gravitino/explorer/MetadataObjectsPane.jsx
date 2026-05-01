/**
 * MetadataObjectsPane — список metadata objects ассоциированных с tag или
 * policy (U-tag-policy-objects). Reverse-scan world.{catalogs|schemas|...}
 * по entity.tags/.policies. Колонки: Metadata Object Name (fullName) /
 * Type / Unlink action.
 */
const KINDS = [
  { key: "catalogs", type: "catalog", parentMap: () => null },
  {
    key: "schemas",
    type: "schema",
    parentMap: (s, world) => (world.catalogs || []).find(c => c.id === s.catalogId)?.name,
  },
  {
    key: "tables",
    type: "table",
    parentMap: (t, world) => {
      const sch = (world.schemas || []).find(s => s.id === t.schemaId);
      if (!sch) return null;
      const cat = (world.catalogs || []).find(c => c.id === sch.catalogId);
      return cat ? `${cat.name}.${sch.name}` : sch.name;
    },
  },
  {
    key: "filesets",
    type: "fileset",
    parentMap: (f, world) => {
      const sch = (world.schemas || []).find(s => s.id === f.schemaId);
      if (!sch) return null;
      const cat = (world.catalogs || []).find(c => c.id === sch.catalogId);
      return cat ? `${cat.name}.${sch.name}` : sch.name;
    },
  },
  {
    key: "topics",
    type: "topic",
    parentMap: (t, world) => {
      const sch = (world.schemas || []).find(s => s.id === t.schemaId);
      if (!sch) return (world.catalogs || []).find(c => c.id === t.catalogId)?.name || null;
      const cat = (world.catalogs || []).find(c => c.id === sch.catalogId);
      return cat ? `${cat.name}.${sch.name}` : sch.name;
    },
  },
  {
    key: "models",
    type: "model",
    parentMap: (m, world) => {
      const sch = (world.schemas || []).find(s => s.id === m.schemaId);
      if (!sch) return null;
      const cat = (world.catalogs || []).find(c => c.id === sch.catalogId);
      return cat ? `${cat.name}.${sch.name}` : sch.name;
    },
  },
];

function fullName(item, parentPath) {
  return parentPath ? `${parentPath}.${item.name}` : item.name;
}

function scanAssociations(world, kind, name) {
  const field = kind === "tag" ? "tags" : "policies";
  const out = [];
  for (const k of KINDS) {
    const items = world[k.key] || [];
    for (const it of items) {
      if ((it[field] || []).includes(name)) {
        const parent = k.parentMap(it, world);
        out.push({
          entityType: k.type,        // "catalog" / "schema" / ...
          collectionKey: k.key,      // "catalogs" / "schemas" / ...
          entity: it,
          fullName: fullName(it, parent),
        });
      }
    }
  }
  return out;
}

export default function MetadataObjectsPane({ kind, name, world = {}, onUnlink = () => {} }) {
  const items = scanAssociations(world, kind, name);
  const titleLabel = kind === "tag" ? `tag ${name}` : `policy ${name}`;

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto", color: "var(--idf-text)" }}>
      <button
        type="button"
        onClick={() => typeof window !== "undefined" && window.history.back()}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--idf-text-muted)",
          marginBottom: 8,
        }}
      >↩</button>
      <h2 style={{
        margin: "4px 0 4px",
        fontSize: 22,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        Metadata Objects
        <span style={{
          padding: "2px 10px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          background: kind === "tag" ? "rgba(100,120,247,0.18)" : "rgba(255,171,0,0.18)",
          color: kind === "tag" ? "var(--idf-primary, #6478f7)" : "#FFAB00",
        }}>{name}</span>
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--idf-text-muted)" }}>
        This table lists the metadata objects associated with {titleLabel}.
      </p>
      {items.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--idf-text-muted)" }}>
          Нет metadata-объектов с этим {kind === "tag" ? "тегом" : "политикой"}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead>
            <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
              <th style={cellH}>Metadata Object Name</th>
              <th style={cellH}>Type</th>
              <th style={{ ...cellH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={`${it.collectionKey}:${it.entity.id}`} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={cellTd}>{it.fullName}</td>
                <td style={{ ...cellTd, color: "var(--idf-text-muted)", fontFamily: "monospace", fontSize: 12 }}>{it.entityType}</td>
                <td style={{ ...cellTd, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => onUnlink({
                      kind,
                      name,
                      entityType: it.entityType,
                      collectionKey: it.collectionKey,
                      entity: it.entity,
                    })}
                    title="Unlink"
                    aria-label={`unlink-${it.fullName}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#FF3E1D",
                      fontSize: 14,
                      padding: "0 8px",
                    }}
                  >⌫</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const cellH = { padding: "8px 12px", textAlign: "left", fontWeight: 600 };
const cellTd = { padding: "10px 12px", textAlign: "left" };
