export default function Breadcrumbs({ history, current, canGoBack, onBack, projectionNames }) {
  if (!current) return null;

  const names = projectionNames || {};
  const crumbs = [...history, current];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 16px",
      background: "var(--mantine-color-default)",
      borderBottom: "1px solid var(--mantine-color-default-border)",
      fontSize: 13,
      color: "var(--mantine-color-dimmed)",
      fontFamily: "system-ui, sans-serif",
    }}>
      {canGoBack && (
        <button
          onClick={onBack}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--mantine-color-default-border)",
            background: "var(--mantine-color-default-hover)",
            color: "var(--mantine-color-text)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >← Назад</button>
      )}
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const name = names[crumb.projectionId] || crumb.projectionId;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{
              color: isLast ? "var(--mantine-color-text)" : "var(--mantine-color-dimmed)",
              fontWeight: isLast ? 600 : 400,
            }}>
              {name}
            </span>
            {!isLast && <span style={{ color: "var(--mantine-color-dimmed)" }}>/</span>}
          </span>
        );
      })}
    </div>
  );
}
