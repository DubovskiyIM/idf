/**
 * SchemaDetailPane — tabbed detail view для schema (U4).
 *
 * Header: schema name + comment.
 * Tabs (зависят от catalog.type):
 *   - relational → Tables / Properties
 *   - fileset    → Filesets / Properties
 *   - model      → Models / Properties
 *   - default    → Properties only
 *
 * Каждый children-tab — простая таблица (Name / Comment).
 * Tags / Policies / Functions tabs — backlog (U2.5b / U6).
 */
import { useState } from "react";
import Tabs from "./Tabs.jsx";

export default function SchemaDetailPane({ schema, catalog, world = {} }) {
  const childKind = catalog?.type === "relational" ? "tables"
                  : catalog?.type === "fileset"    ? "filesets"
                  : catalog?.type === "model"      ? "models"
                  : null;
  const childLabel = { tables: "Tables", filesets: "Filesets", models: "Models" }[childKind];
  const tabs = [
    ...(childKind ? [{ key: childKind, label: childLabel }] : []),
    { key: "properties", label: "Properties" },
  ];
  const [active, setActive] = useState(tabs[0].key);
  const children = childKind ? (world[childKind] || []).filter(it => it.schemaId === schema.id) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={schema.name} subtitle={schema.comment} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={tabs} active={active} onChange={setActive}>
          {active === childKind && <ChildTable items={children} />}
          {active === "properties" && <PropsTable obj={schema.properties || {}} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ name, subtitle }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 2 }}>{subtitle}</div>}
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
