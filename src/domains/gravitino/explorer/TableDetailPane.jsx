/**
 * TableDetailPane — tabbed detail view для table (U4 + U6.3).
 *
 * Header: name + comment + owner avatar + ✎ Set Owner.
 * Tabs (conditional show — пустые не показываются):
 *   - Columns           — всегда
 *   - Partitioning      — если table.partitioning
 *   - Distribution      — если table.distribution (U6.3, B4)
 *   - Sort Order        — если table.sortOrders.length > 0 (U6.3, B4)
 *   - Indexes           — если table.indexes.length > 0 (U6.3, B4)
 *   - Tags / Policies   — всегда (U6.3, B14)
 *   - Properties        — всегда
 *
 * Associated Filesets (cross-link) — backlog (U-cross).
 */
import { useState } from "react";
import { ChipsAssoc, OwnerBlock } from "./DetailPaneCommon.jsx";
import Tabs from "./Tabs.jsx";

export default function TableDetailPane({
  table,
  world = {},
  onSetOwner = () => {},
  onAssociate = () => {},
}) {
  const tabs = [
    { key: "columns", label: "Columns", show: true },
    { key: "partitioning", label: "Partitioning",
      show: !!table.partitioning && (!Array.isArray(table.partitioning) || table.partitioning.length > 0) },
    { key: "distribution", label: "Distribution", show: !!table.distribution },
    { key: "sortOrders", label: "Sort Order", show: (table.sortOrders || []).length > 0 },
    { key: "indexes", label: "Indexes", show: (table.indexes || []).length > 0 },
    { key: "tags", label: "Tags", show: true },
    { key: "policies", label: "Policies", show: true },
    { key: "properties", label: "Properties", show: true },
  ].filter(t => t.show);
  const [active, setActive] = useState("columns");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header table={table} onSetOwner={() => onSetOwner(table.id)} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={tabs} active={active} onChange={setActive}>
          {active === "columns"      && <ColumnsTable columns={table.columns} />}
          {active === "partitioning" && <PartitioningView spec={table.partitioning} />}
          {active === "distribution" && <DistributionView dist={table.distribution} />}
          {active === "sortOrders"   && <SortOrdersView orders={table.sortOrders} />}
          {active === "indexes"      && <IndexesTable indexes={table.indexes} />}
          {active === "tags" && (
            <ChipsAssoc entityId={table.id} type="tags"
              selected={table.tags || []} available={world.tags || []} onAssociate={onAssociate} />
          )}
          {active === "policies" && (
            <ChipsAssoc entityId={table.id} type="policies"
              selected={table.policies || []} available={world.policies || []} onAssociate={onAssociate} />
          )}
          {active === "properties"   && <PropsTable obj={table.properties} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ table, onSetOwner }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{table.name}</div>
        {table.comment && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 2 }}>{table.comment}</div>}
      </div>
      <OwnerBlock owner={table.owner} onSetOwner={onSetOwner} />
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
      fontSize: 12, color: "var(--idf-text)", overflow: "auto",
    }}>{JSON.stringify(spec, null, 2)}</pre>
  );
}

function DistributionView({ dist }) {
  if (!dist) return <Empty>Distribution не задан</Empty>;
  const expr = (dist.expressions || []).map(e => Array.isArray(e) ? e.join(".") : String(e));
  return (
    <div style={{ fontSize: 13, color: "var(--idf-text)" }}>
      <Row label="Strategy">
        <span style={chipMonoStyle("var(--idf-primary, #6478f7)")}>{dist.strategy}</span>
      </Row>
      {dist.number != null && (
        <Row label="Buckets">
          <span style={chipMonoStyle("#FFAB00")}>{dist.number}</span>
        </Row>
      )}
      {expr.length > 0 && (
        <Row label="Expressions">
          {expr.map((e, i) => (
            <span key={i} style={{ ...chipMonoStyle("var(--idf-text)"), marginRight: 6 }}>{e}</span>
          ))}
        </Row>
      )}
    </div>
  );
}

function SortOrdersView({ orders = [] }) {
  if (orders.length === 0) return <Empty>Sort order не задан</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={cellStyle}>Expression</th>
          <th style={cellStyle}>Direction</th>
          <th style={cellStyle}>Null Order</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o, i) => (
          <tr key={i} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500, fontFamily: "monospace" }}>{String(o.expression)}</td>
            <td style={{ ...cellStyle, color: "var(--idf-primary, #6478f7)" }}>{o.direction || "ASC"}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{o.nullOrder || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IndexesTable({ indexes = [] }) {
  if (indexes.length === 0) return <Empty>Индексов нет</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={cellStyle}>Name</th>
          <th style={cellStyle}>Type</th>
          <th style={cellStyle}>Fields</th>
        </tr>
      </thead>
      <tbody>
        {indexes.map(idx => {
          const fields = (idx.fieldNames || []).map(f => Array.isArray(f) ? f.join(".") : String(f));
          return (
            <tr key={idx.name} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
              <td style={{ ...cellStyle, fontWeight: 500 }}>{idx.name}</td>
              <td style={{ ...cellStyle, color: "var(--idf-primary, #6478f7)", fontFamily: "monospace" }}>{idx.type}</td>
              <td style={{ ...cellStyle, fontFamily: "monospace" }}>{fields.join(", ")}</td>
            </tr>
          );
        })}
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

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <div style={{ width: 120, fontWeight: 500, color: "var(--idf-text-muted)", fontSize: 12 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function chipMonoStyle(color) {
  return {
    padding: "3px 10px", fontSize: 12, fontWeight: 500, borderRadius: 4,
    background: "var(--idf-surface, #f3f4f6)", color, fontFamily: "monospace",
  };
}

function Empty({ children }) {
  return <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
