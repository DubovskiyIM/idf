/**
 * Breadcrumb — navigation path для CatalogExplorer (U6.2 split-out).
 *
 * Уровни: Metalakes › <metalake> › [catalog › [schema › [leaf]]].
 * leaf — table / model / fileset / function / topic.
 */
export default function Breadcrumb({
  metalake, catalog, schema, table, model, fileset, fn, topic,
  onMetalakeClick, onCatalogClick, onSchemaClick,
}) {
  const leaf = table || model || fileset || fn || topic || null;
  const items = [
    { label: "Metalakes", href: "/gravitino/metalake_list" },
    { label: metalake.name, onClick: onMetalakeClick, active: !catalog },
    ...(catalog ? [{ label: catalog.name, onClick: onCatalogClick, active: !schema && !leaf }] : []),
    ...(schema  ? [{ label: schema.name,  onClick: onSchemaClick,  active: !leaf }] : []),
    ...(leaf    ? [{ label: leaf.name, active: true }] : []),
  ];
  return (
    <nav aria-label="breadcrumb" style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "10px 16px", fontSize: 12,
      background: "var(--idf-card, #fff)",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      color: "var(--idf-text-muted)",
    }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span>›</span>}
          {it.href ? (
            <a href={it.href} style={{ color: "var(--idf-text-muted)", textDecoration: "none" }}>{it.label}</a>
          ) : it.onClick ? (
            <button type="button" onClick={it.onClick} style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: it.active ? "var(--idf-text)" : "var(--idf-text-muted)",
              fontWeight: it.active ? 500 : 400, fontSize: 12,
            }}>{it.label}</button>
          ) : (
            <span style={{ color: "var(--idf-text)", fontWeight: 500 }}>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
