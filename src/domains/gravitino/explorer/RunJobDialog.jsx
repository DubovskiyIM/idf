/**
 * RunJobDialog — modal: Template Name select + параметры (mock из template config).
 * Optimistic add to JOBS state.
 */
import { useEffect, useState } from "react";

export default function RunJobDialog({ visible, templates = [], onClose = () => {}, onSubmit = () => {}, onRegisterTemplate = () => {} }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id || "");
  useEffect(() => { if (visible) setSelectedId(templates[0]?.id || ""); }, [visible, templates]);
  if (!visible) return null;
  const tpl = templates.find(t => t.id === selectedId);

  return (
    <div role="dialog" aria-label="Run Job"
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--idf-card, #fff)", color: "var(--idf-text)", border: "1px solid var(--idf-border)", borderRadius: 8, padding: 18, width: 540, maxHeight: "80vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{tpl?.name || "—"}</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--idf-text-muted)" }}>Create a new job by the template.</p>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          Template Name <span style={{ color: "#FF3E1D" }}>*</span>
        </label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            style={{ flex: 1, padding: "6px 10px", fontSize: 13, border: "1px solid var(--idf-border)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)" }}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" onClick={onRegisterTemplate}
            style={{ padding: "6px 12px", fontSize: 11, border: "1px dashed var(--idf-border)", borderRadius: 4, background: "transparent", cursor: "pointer", color: "var(--idf-text-muted)" }}>+ Register Template</button>
        </div>

        {tpl && (
          <div style={{ background: "var(--idf-bg-subtle, #f9fafb)", padding: 12, borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--idf-text-muted)", marginBottom: 4 }}>Description</div>
            <div style={{ fontSize: 12, color: "var(--idf-text)" }}>{tpl.description || "—"}</div>
            <div style={{ fontSize: 11, color: "var(--idf-text-muted)", marginTop: 8, marginBottom: 4 }}>Config (kind: {tpl.config?.kind || "—"})</div>
            <pre style={{ fontSize: 11, margin: 0, color: "var(--idf-text)", overflow: "auto" }}>{JSON.stringify(tpl.config || {}, null, 2)}</pre>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose}
            style={{ padding: "6px 14px", fontSize: 12, border: "1px solid var(--idf-border)", background: "transparent", color: "var(--idf-text-muted)", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
          <button type="button" disabled={!tpl}
            onClick={() => onSubmit({ templateId: selectedId, templateName: tpl?.name, config: tpl?.config })}
            style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "1px solid var(--idf-primary, #6478f7)", background: tpl ? "var(--idf-primary, #6478f7)" : "rgba(100,120,247,0.4)", color: "white", borderRadius: 4, cursor: tpl ? "pointer" : "not-allowed" }}>Submit</button>
        </div>
      </div>
    </div>
  );
}
