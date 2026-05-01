/**
 * HubGrid — generic tile-grid для navigation-hub'ов (U2.6).
 *
 * Используется access_hub / compliance_hub canvas-проекциями: вместо
 * 6 flat-tabs в top-nav (Users/Groups/Roles/Tags/Policies + Metalakes)
 * группируем IAM и governance в 2 hubs. Каждый tile — ссылка на
 * inner projection (/gravitino/<projectionId>).
 */
export default function HubGrid({ title, subtitle, tiles = [] }) {
  return (
    <div style={{ padding: 32, height: "100%", overflow: "auto", color: "var(--idf-text)" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--idf-text)" }}>{title}</h2>
        {subtitle && <div style={{ marginTop: 4, fontSize: 13, color: "var(--idf-text-muted)" }}>{subtitle}</div>}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 14,
      }}>
        {tiles.map(tile => (
          <a
            key={tile.projectionId}
            href={`/gravitino/${tile.projectionId}`}
            style={{
              display: "flex", flexDirection: "column", gap: 8,
              padding: 16,
              background: "var(--idf-card, #fff)",
              border: "1px solid var(--idf-border, #e5e7eb)",
              borderRadius: 8,
              textDecoration: "none",
              color: "var(--idf-text)",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--idf-primary, #6478f7)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--idf-border, #e5e7eb)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {tile.icon && <span style={{ fontSize: 22 }}>{tile.icon}</span>}
              <span style={{ fontSize: 15, fontWeight: 600 }}>{tile.label}</span>
            </div>
            {tile.description && (
              <div style={{ fontSize: 12, color: "var(--idf-text-muted)", lineHeight: 1.4 }}>
                {tile.description}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
