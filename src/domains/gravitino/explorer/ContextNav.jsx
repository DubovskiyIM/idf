/**
 * ContextNav — in-metalake context-nav strip (A1 partial, U-context-nav).
 *
 * Рендерится внутри CatalogExplorer (metalake_workspace canvas) — между
 * HeaderBar (V2Shell-level) и Breadcrumb. Web-v2 nav паритет: клик по
 * metalake row → workspace показывает 4-tab nav (Catalogs / Jobs / Data
 * Compliance / Access), Metalakes — только breadcrumb.
 */
const TABS = [
  { key: "catalogs",   label: "Catalogs",        target: null /* current */ },
  { key: "jobs",       label: "Jobs",            target: "jobs_hub" },
  { key: "compliance", label: "Data Compliance", target: "compliance_hub" },
  { key: "access",     label: "Access",          target: "access_hub" },
];

export default function ContextNav({ active = "catalogs", onNavigate = () => {} }) {
  return (
    <div role="tablist" style={{
      display: "flex", gap: 0,
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      padding: "0 16px",
    }}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              if (isActive || !tab.target) return;
              onNavigate(tab.target);
            }}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid var(--idf-primary, #6478f7)" : "2px solid transparent",
              color: isActive ? "var(--idf-primary, #6478f7)" : "var(--idf-text)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              cursor: isActive ? "default" : "pointer",
              marginBottom: -1,
            }}
          >{tab.label}</button>
        );
      })}
    </div>
  );
}
