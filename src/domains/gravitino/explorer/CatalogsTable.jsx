/**
 * CatalogsTable — right-pane default для CatalogExplorer (U2.1).
 * Простая таблица всех catalogs текущего metalake. Tags/Policies колонки —
 * U2.5 (cross-cutting popovers).
 */
export default function CatalogsTable({ catalogs = [], onSelect = () => {} }) {
  if (catalogs.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: "center",
        color: "var(--idf-text-muted)", fontSize: 13,
      }}>
        Нет catalogs в этом metalake
      </div>
    );
  }
  return (
    <table style={{
      width: "100%", borderCollapse: "collapse", fontSize: 13,
      color: "var(--idf-text)",
    }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={cellStyle}>Catalog Name</th>
          <th style={cellStyle}>Provider</th>
          <th style={cellStyle}>Type</th>
          <th style={cellStyle}>Comment</th>
        </tr>
      </thead>
      <tbody>
        {catalogs.map(cat => (
          <tr
            key={cat.id}
            onClick={() => onSelect(cat)}
            style={{
              cursor: "pointer",
              borderBottom: "1px solid var(--idf-border, #e5e7eb)",
            }}
          >
            <td style={{ ...cellStyle, fontWeight: 500 }}>{cat.name}</td>
            <td style={cellStyle}>{cat.provider}</td>
            <td style={cellStyle}>{cat.type}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{cat.comment || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cellStyle = {
  padding: "10px 14px",
  textAlign: "left",
  borderBottom: "1px solid var(--idf-border, #e5e7eb)",
};
