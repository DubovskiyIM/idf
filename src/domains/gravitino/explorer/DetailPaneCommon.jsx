/**
 * DetailPaneCommon — переиспользуемые header / chip / associate-блоки
 * для Schema/Table detail pane'ов (U6.3, B3/B4/C2/B14).
 *
 * Вынесены отдельно ради LOC-budget'а в *DetailPane.jsx (<300 LOC).
 */
import { useState } from "react";
import { AssociatePopover } from "@intent-driven/renderer";

export function OwnerBlock({ owner, onSetOwner }) {
  if (!owner) {
    return (
      <button
        type="button"
        onClick={onSetOwner}
        aria-label="Edit owner"
        style={{
          padding: "3px 10px", fontSize: 11,
          border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
          background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer",
        }}
      >+ Set Owner</button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--idf-text)" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: "50%",
        background: "var(--idf-primary, #6478f7)", color: "white", fontSize: 10, fontWeight: 600,
      }}>{owner.slice(0, 1).toUpperCase()}</span>
      <span style={{ color: "var(--idf-text)" }}>{owner}</span>
      <button
        type="button"
        onClick={onSetOwner}
        title="Set owner"
        aria-label="Edit owner"
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 11, color: "var(--idf-text-muted)", padding: "0 4px",
        }}
      >✎</button>
    </span>
  );
}

export function ChipsAssoc({ entityId, type, selected = [], available = [], onAssociate = () => {} }) {
  const [open, setOpen] = useState(false);
  const isTag = type === "tags";
  const label = isTag ? "Associate Tag" : "Associate Policy";
  const colors = isTag
    ? { bg: "rgba(100, 120, 247, 0.15)", text: "var(--idf-primary, #6478f7)" }
    : { bg: "rgba(255, 171, 0, 0.18)", text: "#FFAB00" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", position: "relative" }}>
      {selected.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>
          {isTag ? "Тегов не назначено" : "Политик не назначено"}
        </span>
      )}
      {selected.map(name => (
        <span key={name} style={{
          padding: "3px 10px", fontSize: 12, fontWeight: 500, borderRadius: 4,
          background: colors.bg, color: colors.text,
        }}>{name}</span>
      ))}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "3px 10px", fontSize: 11,
          border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
          background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer",
        }}
      >+ {label}</button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50 }}>
          <AssociatePopover
            title={label}
            available={available}
            selected={selected}
            onApply={(names) => { onAssociate(entityId, type, names); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
