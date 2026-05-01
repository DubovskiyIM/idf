/**
 * TwoPaneLayout — shared 2-pane shell для AccessHub/ComplianceHub (U-iam2.a).
 *
 * Left: vertical submenu (sections с label + opt. disabled).
 * Right: children (active section content).
 *
 * Паритет gravitino/web-v2: левый рейл с tabs Tags/Policies/Row Filters/
 * Column Masks (или Users/User Groups/Roles).
 */
export default function TwoPaneLayout({
  sections = [], active, onSelect = () => {},
  title, children,
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", height: "100%", minHeight: 0, background: "var(--idf-surface, #f8fafc)" }}>
      <aside style={{
        borderRight: "1px solid var(--idf-border, #e5e7eb)",
        background: "var(--idf-card, #fff)",
        padding: "12px 8px", overflow: "auto",
      }}>
        {title && (
          <div style={{
            padding: "4px 12px 12px", fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: "var(--idf-text-muted)",
          }}>{title}</div>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sections.map(s => {
            const isActive = s.key === active;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={s.disabled}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => !s.disabled && onSelect(s.key)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 12px", fontSize: 13,
                    background: isActive ? "var(--idf-bg-subtle, #f9fafb)" : "transparent",
                    border: "none", borderLeft: isActive ? "2px solid var(--idf-primary, #6478f7)" : "2px solid transparent",
                    color: s.disabled ? "var(--idf-text-muted)" : isActive ? "var(--idf-primary, #6478f7)" : "var(--idf-text)",
                    fontWeight: isActive ? 600 : 400,
                    cursor: s.disabled ? "not-allowed" : "pointer",
                    opacity: s.disabled ? 0.5 : 1,
                  }}
                >{s.label}</button>
              </li>
            );
          })}
        </ul>
      </aside>
      <main style={{ overflow: "auto", padding: 16, background: "var(--idf-card, #fff)" }}>
        {children}
      </main>
    </div>
  );
}
