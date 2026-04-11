export default function Breadcrumbs({ history, current, canGoBack, onBack, projectionNames }) {
  if (!current) return null;

  const names = projectionNames || {};
  const crumbs = [...history, current];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 16px", background: "#f9fafb",
      borderBottom: "1px solid #e5e7eb",
      fontSize: 13, color: "#6b7280",
      fontFamily: "system-ui, sans-serif",
    }}>
      {canGoBack && (
        <button
          onClick={onBack}
          style={{
            padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db",
            background: "#fff", cursor: "pointer", fontSize: 12,
          }}
        >← Назад</button>
      )}
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const name = names[crumb.projectionId] || crumb.projectionId;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: isLast ? "#1a1a2e" : "#9ca3af", fontWeight: isLast ? 600 : 400 }}>
              {name}
            </span>
            {!isLast && <span style={{ color: "#d1d5db" }}>/</span>}
          </span>
        );
      })}
    </div>
  );
}
