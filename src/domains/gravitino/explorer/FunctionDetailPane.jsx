/**
 * FunctionDetailPane — read-only display Function entity (U6.2).
 *
 * Header: name + comment. Body: functionBody в <pre>. Properties — key-value.
 * Функции — read-only в UI gravitino (web-v2 не имеет edit/create flow).
 */
export default function FunctionDetailPane({ function: fn }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      <Header name={fn.name} subtitle={fn.comment} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Section title="Function body">
          {fn.functionBody ? (
            <pre style={{
              background: "var(--idf-bg-subtle, #f9fafb)", color: "var(--idf-text)",
              padding: 14, borderRadius: 6, fontSize: 12, lineHeight: 1.5,
              overflow: "auto", margin: 0,
              border: "1px solid var(--idf-border-subtle, #f3f4f6)",
            }}>{fn.functionBody}</pre>
          ) : (
            <Empty>Тело функции не указано</Empty>
          )}
        </Section>
        <Section title="Properties">
          <PropsTable obj={fn.properties} />
        </Section>
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
      display: "flex", alignItems: "baseline", gap: 12,
    }}>
      <span style={{ fontSize: 16 }}>𝑓</span>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>{subtitle}</div>}
    </div>
  );
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
            <td style={cellStyle}>{k}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace" }}>{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 16, fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

const cellStyle = { padding: "8px 12px", textAlign: "left", fontWeight: 500 };
