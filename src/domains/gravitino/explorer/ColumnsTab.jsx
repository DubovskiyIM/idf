/**
 * ColumnsTab — Columns-tab для TableDetailPane (B5).
 *
 * Каждая complex-type строка имеет ▸/▼ expand button → inline indented
 * NestedTypeView с recursive rendering полей / element / key+value.
 * Парсинг типов делегирован columnTypeParser.
 */
import { useState } from "react";
import { isComplex, parseColumnType } from "./columnTypeParser.js";

export default function ColumnsTab({ columns = [] }) {
  if (columns.length === 0) {
    return <div style={emptyStyle}>Нет колонок</div>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={{ ...cellStyle, width: 24 }}></th>
          <th style={cellStyle}>Name</th>
          <th style={cellStyle}>Type</th>
          <th style={cellStyle}>Nullable</th>
          <th style={cellStyle}>Comment</th>
        </tr>
      </thead>
      <tbody>
        {columns.map(col => <ColumnRow key={col.name} col={col} />)}
      </tbody>
    </table>
  );
}

function ColumnRow({ col }) {
  const [expanded, setExpanded] = useState(false);
  const node = parseColumnType(col.type);
  const complex = isComplex(node);
  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
        <td style={{ ...cellStyle, padding: "8px 4px", textAlign: "center" }}>
          {complex ? (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              aria-label={`expand-${col.name}`}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--idf-text-muted)", fontSize: 11, padding: 0,
              }}
            >{expanded ? "▼" : "▸"}</button>
          ) : null}
        </td>
        <td style={{ ...cellStyle, fontWeight: 500 }}>{col.name}</td>
        <td style={{ ...cellStyle, fontFamily: "monospace", color: "var(--idf-primary, #6478f7)" }}>{col.type}</td>
        <td style={cellStyle}>{col.nullable === false ? "NOT NULL" : "NULL"}</td>
        <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{col.comment || "—"}</td>
      </tr>
      {expanded && complex && (
        <tr>
          <td colSpan={5} style={{
            padding: 0,
            borderBottom: "1px solid var(--idf-border, #e5e7eb)",
            background: "var(--idf-bg-subtle, #f9fafb)",
          }}>
            <NestedTypeView node={node} depth={1} />
          </td>
        </tr>
      )}
    </>
  );
}

function NestedTypeView({ node, depth }) {
  const padLeft = 12 + depth * 14;
  if (node.kind === "struct") {
    return (
      <div>
        {node.fields.map(f => (
          <div key={f.name}>
            <div style={nestedRowStyle(padLeft)}>
              <span style={{ flex: 1, fontWeight: 500 }}>{f.name}</span>
              <span style={nestedTypeStyle}>{stringifyType(f.type)}</span>
            </div>
            {isComplex(f.type) && <NestedTypeView node={f.type} depth={depth + 1} />}
          </div>
        ))}
      </div>
    );
  }
  if (node.kind === "array") {
    return (
      <div>
        <div style={nestedRowStyle(padLeft)}>
          <span style={italicMutedStyle}>(element)</span>
          <span style={nestedTypeStyle}>{stringifyType(node.element)}</span>
        </div>
        {isComplex(node.element) && <NestedTypeView node={node.element} depth={depth + 1} />}
      </div>
    );
  }
  if (node.kind === "map") {
    return (
      <div>
        <div style={nestedRowStyle(padLeft)}>
          <span style={italicMutedStyle}>(key)</span>
          <span style={nestedTypeStyle}>{stringifyType(node.key)}</span>
        </div>
        <div style={nestedRowStyle(padLeft)}>
          <span style={italicMutedStyle}>(value)</span>
          <span style={nestedTypeStyle}>{stringifyType(node.value)}</span>
        </div>
        {isComplex(node.value) && <NestedTypeView node={node.value} depth={depth + 1} />}
      </div>
    );
  }
  return null;
}

function stringifyType(node) {
  if (!node) return "";
  if (node.kind === "scalar") return node.type;
  if (node.kind === "array")  return `array<${stringifyType(node.element)}>`;
  if (node.kind === "map")    return `map<${stringifyType(node.key)}, ${stringifyType(node.value)}>`;
  if (node.kind === "struct") return `struct<${node.fields.map(f => `${f.name}: ${stringifyType(f.type)}`).join(", ")}>`;
  return "?";
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
const emptyStyle = { padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" };
const nestedRowStyle = (padLeft) => ({
  display: "flex", padding: "5px 0", paddingLeft: padLeft, fontSize: 12,
});
const nestedTypeStyle = {
  fontFamily: "monospace", color: "var(--idf-text-muted)", paddingRight: 14,
};
const italicMutedStyle = {
  flex: 1, color: "var(--idf-text-muted)", fontStyle: "italic",
};
