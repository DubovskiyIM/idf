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
 * Functions tab — backlog (U-functions).
 */
import { useState } from "react";
import { ChipsAssoc, OwnerBlock } from "./DetailPaneCommon.jsx";
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
