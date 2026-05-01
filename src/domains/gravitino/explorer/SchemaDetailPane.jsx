/**
 * SchemaDetailPane — tabbed detail view для schema (U4 + U6.3).
 *
 * Header: schema name + comment + owner avatar + ✎ Set Owner.
 * Tabs (зависят от catalog.type + всегда tags/policies/properties):
 *   - relational → Tables / Tags / Policies / Properties
 *   - fileset    → Filesets / Tags / Policies / Properties
 *   - model      → Models / Tags / Policies / Properties
 *   - default    → Tags / Policies / Properties
 *
 * Tags / Policies — chip-list + AssociatePopover (U6.3, B3/B14).
 * Functions tab — backlog.
 */
import { useState } from "react";
import AssociatePopover from "./AssociatePopover.jsx";
import Tabs from "./Tabs.jsx";

export default function SchemaDetailPane({
  schema,
  catalog,
  world = {},
  onSetOwner = () => {},
  onAssociate = () => {},
}) {
  const childKind = catalog?.type === "relational" ? "tables"
                  : catalog?.type === "fileset"    ? "filesets"
                  : catalog?.type === "model"      ? "models"
                  : null;
  const childLabel = { tables: "Tables", filesets: "Filesets", models: "Models" }[childKind];
  const tabs = [
    ...(childKind ? [{ key: childKind, label: childLabel }] : []),
    { key: "tags", label: "Tags" },
    { key: "policies", label: "Policies" },
    { key: "properties", label: "Properties" },
  ];
  const [active, setActive] = useState(tabs[0].key);
  const children = childKind ? (world[childKind] || []).filter(it => it.schemaId === schema.id) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header schema={schema} onSetOwner={() => onSetOwner(schema.id)} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={tabs} active={active} onChange={setActive}>
          {active === childKind && <ChildTable items={children} />}
          {active === "tags" && (
            <ChipsAssoc
              entityId={schema.id}
              type="tags"
              selected={schema.tags || []}
              available={world.tags || []}
              onAssociate={onAssociate}
            />
          )}
          {active === "policies" && (
            <ChipsAssoc
              entityId={schema.id}
              type="policies"
              selected={schema.policies || []}
              available={world.policies || []}
              onAssociate={onAssociate}
            />
          )}
          {active === "properties" && <PropsTable obj={schema.properties || {}} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ schema, onSetOwner }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{schema.name}</div>
        {schema.comment && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 2 }}>{schema.comment}</div>}
      </div>
      <OwnerBlock owner={schema.owner} onSetOwner={onSetOwner} />
    </div>
  );
}

function OwnerBlock({ owner, onSetOwner }) {
  if (!owner) {
    return (
      <button
        type="button"
        onClick={onSetOwner}
        aria-label="Edit owner"
        style={{
          padding: "3px 10px", fontSize: 11,
          border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
          background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer",
        }}
      >+ Set Owner</button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: "50%",
        background: "var(--idf-primary, #6478f7)", color: "white", fontSize: 10, fontWeight: 600,
      }}>{owner.slice(0, 1).toUpperCase()}</span>
      <span>{owner}</span>
      <button
        type="button"
        onClick={onSetOwner}
        title="Set owner"
        aria-label="Edit owner"
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 11, color: "var(--idf-text-muted)", padding: "0 4px",
        }}
      >✎</button>
    </span>
  );
}

export function ChipsAssoc({ entityId, type, selected = [], available = [], onAssociate }) {
  const [open, setOpen] = useState(false);
  const isTag = type === "tags";
  const label = isTag ? "Associate Tag" : "Associate Policy";
  const colors = isTag
    ? { bg: "rgba(100, 120, 247, 0.15)", text: "var(--idf-primary, #6478f7)" }
    : { bg: "rgba(255, 171, 0, 0.18)", text: "#FFAB00" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", position: "relative" }}>
      {selected.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>
          {isTag ? "Тегов не назначено" : "Политик не назначено"}
        </span>
      )}
      {selected.map(name => (
        <span key={name} style={{
          padding: "3px 10px", fontSize: 12, fontWeight: 500, borderRadius: 4,
          background: colors.bg, color: colors.text,
        }}>{name}</span>
      ))}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "3px 10px", fontSize: 11,
          border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
          background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer",
        }}
      >+ {label}</button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50 }}>
          <AssociatePopover
            title={label}
            available={available}
            selected={selected}
            onApply={(names) => { onAssociate(entityId, type, names); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function ChildTable({ items }) {
  if (items.length === 0) return <Empty>Нет дочерних объектов</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={cellStyle}>Name</th>
          <th style={cellStyle}>Comment</th>
        </tr>
      </thead>
      <tbody>
        {items.map(it => (
          <tr key={it.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500 }}>{it.name}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{it.comment || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PropsTable({ obj }) {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) return <Empty>Properties пусты</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500, width: 200 }}>{k}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace" }}>{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
