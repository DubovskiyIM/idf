/**
 * Tabs — тонкий tab-bar компонент для detail-pane'ов (U4).
 * Не AntD-зависимый, native button[role=tab].
 */
export default function Tabs({ tabs = [], active, onChange = () => {}, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div role="tablist" style={{
        display: "flex", borderBottom: "1px solid var(--idf-border, #e5e7eb)",
        background: "var(--idf-card, #fff)",
      }}>
        {tabs.map(tab => {
          const sel = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={sel}
              aria-label={tab.label}
              onClick={() => onChange(tab.key)}
              style={{
                padding: "8px 14px", fontSize: 12,
                background: "transparent", border: "none",
                borderBottom: sel ? "2px solid var(--idf-primary, #6478f7)" : "2px solid transparent",
                color: sel ? "var(--idf-primary, #6478f7)" : "var(--idf-text-muted)",
                fontWeight: sel ? 600 : 400, cursor: "pointer",
              }}
            >{tab.label}</button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>{children}</div>
    </div>
  );
}
