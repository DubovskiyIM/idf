/**
 * CreateTagDialog — modal для создания tag (U-iam2.b).
 * Поля: Name (req, regex hint) / Comment / Color (color-input + hex + refresh) /
 * Properties (Key/Value pairs).
 */
import { useEffect, useState } from "react";

const NAME_HINT = "Must start with a letter, digit, or underscore, can include alphanumeric characters, underscores, slashes (/), eq...";
const PALETTE = ["#0369a1", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#525252"];
const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

export default function CreateTagDialog({ visible, onClose = () => {}, onSubmit = () => {} }) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [color, setColor] = useState("#0369a1");
  const [props, setProps] = useState([{ key: "", value: "" }]);

  useEffect(() => {
    if (!visible) { setName(""); setComment(""); setColor("#0369a1"); setProps([{ key: "", value: "" }]); }
  }, [visible]);
  if (!visible) return null;

  const isValid = name.trim().length > 0;
  const submit = () => {
    if (!isValid) return;
    const cleanProps = Object.fromEntries(props.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value]));
    onSubmit({ name: name.trim(), comment: comment.trim(), color, properties: cleanProps });
  };

  return (
    <Modal title="Create Tag" subtitle="Create a new tag" onClose={onClose}>
      <Field label="Tag Name" required>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={NAME_HINT} style={inputStyle} />
      </Field>
      <Field label="Comment">
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          style={{ ...inputStyle, minHeight: 70 }} />
      </Field>
      <Field label="Color">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 36, height: 32, border: "1px solid var(--idf-border)", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
          <input type="text" value={color} onChange={e => setColor(e.target.value)}
            style={{ ...inputStyle, width: 140, fontFamily: "monospace", display: "inline-block" }} />
          <button type="button" onClick={() => setColor(randomColor())} title="Refresh color"
            style={{ padding: "5px 8px", fontSize: 12, border: "1px solid var(--idf-border)", borderRadius: 4, background: "transparent", cursor: "pointer", color: "var(--idf-text-muted)" }}>↻</button>
        </div>
      </Field>
      <PropsEditor props={props} onChange={setProps} />
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} />
    </Modal>
  );
}

export function Modal({ title, subtitle, onClose, children, width = 540 }) {
  return (
    <div role="dialog" aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--idf-card, #fff)", color: "var(--idf-text)", border: "1px solid var(--idf-border)", borderRadius: 8, padding: 20, width, maxHeight: "85vh", overflow: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{title}</h3>
        {subtitle && <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--idf-text-muted)" }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {required && <span style={{ color: "#FF3E1D" }}> *</span>}
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

export function Footer({ onClose, onSubmit, disabled, submitLabel = "Submit" }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
      <button type="button" onClick={onClose}
        style={{ padding: "6px 14px", fontSize: 12, border: "1px solid var(--idf-border)", background: "transparent", color: "var(--idf-text-muted)", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
      <button type="button" onClick={onSubmit} disabled={disabled}
        style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "1px solid var(--idf-primary, #6478f7)", background: disabled ? "rgba(100,120,247,0.4)" : "var(--idf-primary, #6478f7)", color: "white", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer" }}>{submitLabel}</button>
    </div>
  );
}

export function PropsEditor({ props = [], onChange = () => {} }) {
  const setRow = (i, key, value) => onChange(props.map((p, ix) => ix === i ? { key, value } : p));
  const remove = (i) => onChange(props.filter((_, ix) => ix !== i));
  const add = () => onChange([...props, { key: "", value: "" }]);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Properties</div>
      {props.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input type="text" value={p.key} onChange={e => setRow(i, e.target.value, p.value)} placeholder="Key" style={{ ...inputStyle, flex: 1 }} />
          <input type="text" value={p.value} onChange={e => setRow(i, p.key, e.target.value)} placeholder="Value" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={() => remove(i)} title="Remove"
            style={{ padding: "0 10px", fontSize: 14, border: "1px solid var(--idf-border)", background: "transparent", color: "var(--idf-text-muted)", borderRadius: 4, cursor: "pointer" }}>−</button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{ padding: "5px 10px", fontSize: 11, border: "1px dashed var(--idf-border)", borderRadius: 4, background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer" }}>+ Add Property</button>
    </div>
  );
}

const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };
