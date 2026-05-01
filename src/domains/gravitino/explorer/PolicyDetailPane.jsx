/**
 * PolicyDetailPane — read-only display Policy entity (U-polish-3, B15).
 *
 * Tabs: Rules / Properties.
 * Rules — два уровня: human-readable summary chips (per policyType heuristic)
 * + raw JSON content в pre-block. Read-only — editing rules в U-polish-3b.
 */
import { useState } from "react";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "rules", label: "Rules" },
  { key: "properties", label: "Properties" },
];

export default function PolicyDetailPane({ policy }) {
  const [active, setActive] = useState("rules");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header
        name={policy.name}
        type={policy.policyType}
        enabled={policy.enabled}
        comment={policy.comment}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "rules" && <RulesView content={policy.content} type={policy.policyType} />}
          {active === "properties" && <PropsTable obj={policy.properties} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ name, type, enabled, comment }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 16 }}>📜</span>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
        {type && (
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4,
            background: "var(--idf-bg-subtle, #f9fafb)", color: "var(--idf-text-muted)",
            fontFamily: "monospace",
          }}>{type}</span>
        )}
        <span style={{
          fontSize: 11, padding: "2px 10px", borderRadius: 12, fontWeight: 600,
          background: enabled ? "rgba(113,221,55,0.18)" : "rgba(255,62,29,0.18)",
          color: enabled ? "#71DD37" : "#FF3E1D",
        }}>{enabled ? "✓ Enabled" : "× Disabled"}</span>
      </div>
      {comment && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 4 }}>{comment}</div>}
    </div>
  );
}

function RulesView({ content, type }) {
  if (!content || Object.keys(content).length === 0) {
    return <Empty>Нет правил — content пуст</Empty>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Summary content={content} type={type} />
      <Section title="Raw content (JSON)">
        <pre style={{
          background: "var(--idf-bg-subtle, #f9fafb)", color: "var(--idf-text)",
          padding: 14, borderRadius: 6, fontSize: 12, lineHeight: 1.5,
          overflow: "auto", margin: 0,
          border: "1px solid var(--idf-border-subtle, #f3f4f6)",
        }}>{JSON.stringify(content, null, 2)}</pre>
      </Section>
    </div>
  );
}

function Summary({ content, type }) {
  const items = humanReadable(content, type);
  return (
    <Section title="Summary">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((it, i) => (
          <span key={i} style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 12,
            background: "rgba(100,120,247,0.12)", color: "var(--idf-primary, #6478f7)",
            fontWeight: 500,
          }}>{it}</span>
        ))}
      </div>
    </Section>
  );
}

function humanReadable(content, type) {
  // Эвристика per policyType — читаемые chips для типичных полей.
  const items = [];
  if (type === "data_masking") {
    if (Array.isArray(content.columns)) {
      items.push(`Mask columns: ${content.columns.join(", ")}`);
    }
    if (content.algorithm) items.push(`Algorithm: ${content.algorithm}`);
  } else if (type === "data_lifecycle") {
    if (content.days) items.push(`Retention: ${content.days} days`);
    if (content.action) items.push(`Action: ${content.action}`);
  } else if (type === "access_control" || type === "rbac") {
    if (content.effect) items.push(`Effect: ${content.effect}`);
    if (Array.isArray(content.roles)) items.push(`Roles: ${content.roles.join(", ")}`);
    if (Array.isArray(content.actions)) items.push(`Actions: ${content.actions.join(", ")}`);
    if (Array.isArray(content.allow)) items.push(`Allow: ${content.allow.join(", ")}`);
    if (Array.isArray(content.deny)) items.push(`Deny: ${content.deny.join(", ")}`);
  } else if (type === "data_quality" || type === "quality") {
    if (Array.isArray(content.checks)) items.push(`Checks: ${content.checks.join(", ")}`);
    if (content.threshold) items.push(`Threshold: ${content.threshold}`);
  }
  // Fallback — любые top-level скалярные поля.
  if (items.length === 0) {
    for (const [k, v] of Object.entries(content)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        items.push(`${k}: ${v}`);
      } else if (Array.isArray(v)) {
        items.push(`${k}: ${v.join(", ")}`);
      }
    }
  }
  return items;
}

function Section({ title, children }) {
  return (
    <div>
      <h4 style={{
        margin: "0 0 8px", fontSize: 11, textTransform: "uppercase",
        letterSpacing: "0.05em", color: "var(--idf-text-muted)",
      }}>{title}</h4>
      {children}
    </div>
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
