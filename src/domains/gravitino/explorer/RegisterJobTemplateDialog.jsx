/**
 * RegisterJobTemplateDialog — modal: Comment / Executable (req) / Arguments /
 * Environment Variables / Custom Field(s). Optimistic add to job_templates.
 */
import { useEffect, useState } from "react";

export default function RegisterJobTemplateDialog({ visible, onClose = () => {}, onSubmit = () => {} }) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [executable, setExecutable] = useState("");
  const [args, setArgs] = useState("");

  useEffect(() => { if (!visible) { setName(""); setComment(""); setExecutable(""); setArgs(""); } }, [visible]);
  if (!visible) return null;

  const isValid = name.trim() && executable.trim();

  return (
    <div role="dialog" aria-label="Register Job Template"
      style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--idf-card, #fff)", color: "var(--idf-text)", border: "1px solid var(--idf-border)", borderRadius: 8, padding: 20, width: 520, maxHeight: "85vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Register Job Template</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--idf-text-muted)" }}>Register a new job template.</p>

        <Field label="Name" required value={name} onChange={setName} placeholder="my-spark-job" />
        <Field label="Comment" value={comment} onChange={setComment} multiline />
        <Field label="Executable" required value={executable} onChange={setExecutable} placeholder="e.g. /path/to/my_script.sh" />
        <Field label="Arguments" value={args} onChange={setArgs} placeholder="e.g. {{arg1}},{{arg2}}" />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onClose}
            style={{ padding: "6px 14px", fontSize: 12, border: "1px solid var(--idf-border)", background: "transparent", color: "var(--idf-text-muted)", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
          <button type="button" disabled={!isValid}
            onClick={() => onSubmit({ name: name.trim(), comment: comment.trim(), config: { kind: "shell", executable: executable.trim(), arguments: args.split(",").map(s => s.trim()).filter(Boolean) } })}
            style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "1px solid var(--idf-primary, #6478f7)", background: isValid ? "var(--idf-primary, #6478f7)" : "rgba(100,120,247,0.4)", color: "white", borderRadius: 4, cursor: isValid ? "pointer" : "not-allowed" }}>Submit</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, value, onChange, placeholder, multiline }) {
  return (
    <label style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {required && <span style={{ color: "#FF3E1D" }}> *</span>}
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 13, minHeight: 60, border: "1px solid var(--idf-border)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" }} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" }} />
      )}
    </label>
  );
}
