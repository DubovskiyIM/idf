/**
 * TopicDetailPane — простой read-only display Kafka topic (U6.2).
 * Header: name + comment + 📡-icon. Properties section с retention/partitions.
 */
export default function TopicDetailPane({ topic }) {
  const entries = Object.entries(topic.properties || {});
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      <Header name={topic.name} subtitle={topic.comment} />
      <div style={{ padding: 16 }}>
        <h4 style={{
          margin: "0 0 8px", fontSize: 11, textTransform: "uppercase",
          letterSpacing: "0.05em", color: "var(--idf-text-muted)",
        }}>Properties</h4>
        {entries.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>Properties пусты</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500, width: 220 }}>{k}</td>
                  <td style={{ padding: "8px 12px", color: "var(--idf-text-muted)", fontFamily: "monospace" }}>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
      <span style={{ fontSize: 16 }}>📡</span>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>{subtitle}</div>}
    </div>
  );
}
