/**
 * GrantRoleDialog — modal: Grant the role to user/group X.
 * Multi-select roles. Pre-populated с currentRoles.
 */
import { useEffect, useState } from "react";
import { Modal, Footer } from "./dialogPrimitives.jsx";

export default function GrantRoleDialog({ visible, target, availableRoles = [], currentRoles = [], onClose = () => {}, onSubmit = () => {} }) {
  const [selected, setSelected] = useState(new Set(currentRoles));
  useEffect(() => { if (visible) setSelected(new Set(currentRoles)); }, [visible, currentRoles]);
  if (!visible || !target) return null;

  const toggle = (name) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  return (
    <Modal title="Grant Role" subtitle={`Grant the role to ${target.kind} ${target.name}.`} width={420} onClose={onClose}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Roles</label>
      <div style={{ marginBottom: 8, padding: 8, border: "1px solid var(--idf-border)", borderRadius: 6, background: "var(--idf-card)", maxHeight: 220, overflow: "auto" }}>
        {availableRoles.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>Нет ролей</div>
        ) : availableRoles.map(r => (
          <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 12, cursor: "pointer", background: selected.has(r.name) ? "rgba(100,120,247,0.10)" : "transparent", borderRadius: 4 }}>
            <input type="checkbox" checked={selected.has(r.name)} onChange={() => toggle(r.name)} aria-label={r.name} />
            <span>{r.name}</span>
          </label>
        ))}
      </div>
      <Footer onClose={onClose} onSubmit={() => onSubmit(Array.from(selected))} disabled={false} />
    </Modal>
  );
}
