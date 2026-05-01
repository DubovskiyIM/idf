/**
 * MetalakesTable — host-rendered версия metalake_list (U5.5).
 *
 * Заменяет SDK dataGrid metalake_list (из U1) — даёт нам полный контроль:
 * Owner avatar + ✎ edit (вызывает SetOwnerDialog), In-Use toggle
 * (optimistic), Delete с typed-name ConfirmDialog (D6).
 *
 * Колонки: Name (clickable → workspace) / Creator / Owner / Created /
 * Properties (compact JSON) / Comment / In Use / Actions (Delete).
 */

export default function MetalakesTable({
  metalakes = [],
  onSelect = () => {},
  onSetOwner = () => {},
  onToggleInUse = () => {},
  onDelete = () => {},
  onCreate = () => {},
}) {
  const Header = () => (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <button
        type="button"
        onClick={onCreate}
        style={{
          padding: "6px 14px", fontSize: 12, fontWeight: 600,
          border: "1px solid var(--idf-primary, #6478f7)",
          background: "var(--idf-primary, #6478f7)", color: "white",
          borderRadius: 4, cursor: "pointer",
        }}
      >+ Create Metalake</button>
    </div>
  );

  if (metalakes.length === 0) {
    return (
      <>
        <Header />
        <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)", fontSize: 13 }}>
          Нет metalakes — создайте первый top-level контейнер для каталогов.
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <table style={{
        width: "100%", borderCollapse: "collapse", fontSize: 13,
        color: "var(--idf-text)",
      }}>
        <thead>
          <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Name</th>
            <th style={cellStyle}>Creator</th>
            <th style={cellStyle}>Owner</th>
            <th style={cellStyle}>Created At</th>
            <th style={cellStyle}>Properties</th>
            <th style={cellStyle}>Comment</th>
            <th style={cellStyle}>In Use</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {metalakes.map(m => (
            <tr key={m.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)", verticalAlign: "middle" }}>
              <td
                style={{ ...cellStyle, fontWeight: 500, cursor: "pointer", color: "var(--idf-primary, #6478f7)" }}
                onClick={() => onSelect(m)}
              >{m.name}</td>
              <td style={cellStyle}>{m.audit?.creator ?? "—"}</td>
              <td style={cellStyle}>
                {m.owner ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <Avatar name={m.owner} />
                    <span>{m.owner}</span>
                    <button
                      type="button"
                      onClick={() => onSetOwner(m.id)}
                      aria-label="Edit owner"
                      title="Edit owner"
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        fontSize: 10, color: "var(--idf-text-muted)", padding: "0 4px",
                      }}
                    >✎</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetOwner(m.id)}
                    aria-label="+ Set Owner"
                    style={{
                      padding: "2px 8px", fontSize: 11,
                      border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
                      background: "transparent", color: "var(--idf-text-muted)",
                      cursor: "pointer",
                    }}
                  >+ Set Owner</button>
                )}
              </td>
              <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontSize: 12 }}>
                {fmtTime(m.audit?.createTime)}
              </td>
              <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace", fontSize: 11 }}>
                {Object.keys(m.properties || {}).length === 0 ? "—" : JSON.stringify(m.properties).slice(0, 60)}
              </td>
              <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{m.comment || "—"}</td>
              <td style={cellStyle}>
                <button
                  type="button"
                  onClick={() => onToggleInUse(m.id, !m.inUse)}
                  aria-label={m.inUse ? "In Use" : "Disabled"}
                  style={{
                    padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 12,
                    border: m.inUse ? "1px solid #71DD37" : "1px solid var(--idf-border, #e5e7eb)",
                    background: m.inUse ? "rgba(113,221,55,0.18)" : "transparent",
                    color: m.inUse ? "#71DD37" : "var(--idf-text-muted)",
                    cursor: "pointer",
                  }}
                >{m.inUse ? "✓ In Use" : "× Disabled"}</button>
              </td>
              <td style={{ ...cellStyle, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => onDelete(m)}
                  aria-label="Delete"
                  style={{
                    padding: "4px 10px", fontSize: 11,
                    border: "1px solid #FF3E1D", borderRadius: 4,
                    background: "transparent", color: "#FF3E1D",
                    cursor: "pointer",
                  }}
                >Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Avatar({ name }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, borderRadius: "50%",
      background: "var(--idf-primary, #6478f7)", color: "white",
      fontSize: 10, fontWeight: 600,
    }}>{(name || "?").slice(0, 1).toUpperCase()}</span>
  );
}

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

const cellStyle = { padding: "10px 14px", textAlign: "left" };
