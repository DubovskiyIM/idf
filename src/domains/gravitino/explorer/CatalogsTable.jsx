/**
 * CatalogsTable — right-pane для CatalogExplorer (U2.1 + Tags/Policies в U2.5).
 *
 * Колонки: Catalog Name / Provider / Type / Comment / Tags / Policies.
 * Tags/Policies — chip-list assignments + кнопка «+ Associate Tag/Policy»
 * → AssociatePopover (multiselect из availableTags/availablePolicies).
 *
 * onAssociate(catalogId, type, names) — UI-callback, бэкенд optimistic-update
 * лежит на caller (CatalogExplorer).
 */
import { useState } from "react";
import AssociatePopover from "./AssociatePopover.jsx";

export default function CatalogsTable({
  catalogs = [],
  availableTags = [],
  availablePolicies = [],
  onSelect = () => {},
  onAssociate = () => {},
}) {
  const [popover, setPopover] = useState(null); // { catalogId, type: "tags"|"policies" }

  if (catalogs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)", fontSize: 13 }}>
        Нет catalogs в этом metalake
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-surface, #f3f4f6)" }}>
          <th style={cellStyle}>Catalog Name</th>
          <th style={cellStyle}>Provider</th>
          <th style={cellStyle}>Type</th>
          <th style={cellStyle}>Comment</th>
          <th style={cellStyle}>Tags</th>
          <th style={cellStyle}>Policies</th>
        </tr>
      </thead>
      <tbody>
        {catalogs.map(cat => (
          <tr
            key={cat.id}
            style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)", verticalAlign: "top" }}
          >
            <td style={{ ...cellStyle, fontWeight: 500, cursor: "pointer" }} onClick={() => onSelect(cat)}>{cat.name}</td>
            <td style={cellStyle}>{cat.provider}</td>
            <td style={cellStyle}>{cat.type}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{cat.comment || "—"}</td>
            <td style={{ ...cellStyle, position: "relative" }}>
              <ChipList items={cat.tags || []} variant="tag" />
              <AssociateButton label="+ Associate Tag" onClick={() => setPopover({ catalogId: cat.id, type: "tags" })} />
              {popover?.catalogId === cat.id && popover?.type === "tags" && (
                <FloatingPopover>
                  <AssociatePopover
                    title="Associate Tag"
                    available={availableTags}
                    selected={cat.tags || []}
                    onApply={(names) => { onAssociate(cat.id, "tags", names); setPopover(null); }}
                    onClose={() => setPopover(null)}
                  />
                </FloatingPopover>
              )}
            </td>
            <td style={{ ...cellStyle, position: "relative" }}>
              <ChipList items={cat.policies || []} variant="policy" />
              <AssociateButton label="+ Associate Policy" onClick={() => setPopover({ catalogId: cat.id, type: "policies" })} />
              {popover?.catalogId === cat.id && popover?.type === "policies" && (
                <FloatingPopover>
                  <AssociatePopover
                    title="Associate Policy"
                    available={availablePolicies}
                    selected={cat.policies || []}
                    onApply={(names) => { onAssociate(cat.id, "policies", names); setPopover(null); }}
                    onClose={() => setPopover(null)}
                  />
                </FloatingPopover>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChipList({ items = [], variant = "tag" }) {
  if (items.length === 0) return null;
  const colors = variant === "tag"
    ? { bg: "rgba(100, 120, 247, 0.15)", text: "var(--idf-primary, #6478f7)" }
    : { bg: "rgba(255, 171, 0, 0.18)", text: "#FFAB00" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
      {items.map(name => (
        <span key={name} style={{
          padding: "2px 8px", borderRadius: 4, fontSize: 11,
          background: colors.bg, color: colors.text, fontWeight: 500,
        }}>{name}</span>
      ))}
    </div>
  );
}

function AssociateButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "2px 8px", fontSize: 11,
        border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
        background: "transparent", color: "var(--idf-text-muted)",
        cursor: "pointer",
      }}
    >{label}</button>
  );
}

function FloatingPopover({ children }) {
  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50,
    }}>{children}</div>
  );
}

const cellStyle = {
  padding: "10px 14px",
  textAlign: "left",
  borderBottom: "1px solid var(--idf-border, #e5e7eb)",
};
