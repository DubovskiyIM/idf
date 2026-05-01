/**
 * TableDetailPane — tabbed detail view для table (U4).
 *
 * Tabs: Columns / Partitioning / Properties.
 * Tags / Policies / Indexes / Sort orders / Distribution / Associated Filesets
 * — backlog (U2.5b / U6).
 */
import { useState } from "react";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "columns", label: "Columns" },
  { key: "partitioning", label: "Partitioning" },
  { key: "properties", label: "Properties" },
];

export default function TableDetailPane({ table }) {
  const [active, setActive] = useState("columns");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={table.name} subtitle={table.comment} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "columns"      && <ColumnsTable columns={table.columns} />}
          {active === "partitioning" && <PartitioningView spec={table.partitioning} />}
          {active === "properties"   && <PropsTable obj={table.properties} />}
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

function ColumnsTable({ columns = [] }) {
  if (columns.length === 0) return <Empty>Нет колонок</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={cellStyle}>Name</th>
          <th style={cellStyle}>Type</th>
          <th style={cellStyle}>Nullable</th>
          <th style={cellStyle}>Comment</th>
        </tr>
      </thead>
      <tbody>
        {columns.map(col => (
          <tr key={col.name} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500 }}>{col.name}</td>
            <td style={{ ...cellStyle, fontFamily: "monospace", color: "var(--idf-primary, #6478f7)" }}>{col.type}</td>
            <td style={cellStyle}>{col.nullable === false ? "NOT NULL" : "NULL"}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{col.comment || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PartitioningView({ spec }) {
  if (!spec || (Array.isArray(spec) && spec.length === 0)) return <Empty>Не партиционирована</Empty>;
  return (
    <pre style={{
      background: "var(--idf-surface, #f3f4f6)", padding: 12, borderRadius: 4,
      fontSize: 12, color: "var(--idf-text)",
      overflow: "auto",
    }}>{JSON.stringify(spec, null, 2)}</pre>
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
