/**
 * CreatePolicyDialog — modal для создания policy (U-iam2.b).
 * Поля: Name / Enabled toggle / Policy Type / Supported Object Types multi /
 * Rule(s) Name+Content / Comment / Properties.
 */
import { useEffect, useState } from "react";
import { Modal, Field, Footer, PropsEditor } from "./CreateTagDialog.jsx";

const NAME_HINT = "Must start with a letter, digit, or underscore, can include alphanumeric characters, underscores, slashes (/), eq...";
const POLICY_TYPES = ["custom", "data_masking", "data_lifecycle", "access_control", "data_quality"];
const OBJECT_TYPES = ["catalog", "schema", "table", "fileset", "topic", "model", "column"];

export default function CreatePolicyDialog({ visible, onClose = () => {}, onSubmit = () => {} }) {
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [policyType, setPolicyType] = useState("custom");
  const [supportedTypes, setSupportedTypes] = useState([]);
  const [rules, setRules] = useState([{ name: "", content: "" }]);
  const [comment, setComment] = useState("");
  const [props, setProps] = useState([{ key: "", value: "" }]);

  useEffect(() => {
    if (!visible) { setName(""); setEnabled(true); setPolicyType("custom"); setSupportedTypes([]); setRules([{ name: "", content: "" }]); setComment(""); setProps([{ key: "", value: "" }]); }
  }, [visible]);
  if (!visible) return null;

  const isValid = name.trim() && supportedTypes.length > 0;
  const submit = () => {
    if (!isValid) return;
    const cleanProps = Object.fromEntries(props.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value]));
    onSubmit({
      name: name.trim(), enabled, policyType,
      supportedObjectTypes: supportedTypes,
      rules: rules.filter(r => r.name.trim()).map(r => ({ name: r.name.trim(), content: r.content })),
      comment: comment.trim(), properties: cleanProps,
    });
  };
  const toggleType = (t) => setSupportedTypes(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);
  const setRule = (i, k, v) => setRules(rs => rs.map((r, ix) => ix === i ? { ...r, [k]: v } : r));
  const addRule = () => setRules([...rules, { name: "", content: "" }]);
  const removeRule = (i) => setRules(rules.filter((_, ix) => ix !== i));

  return (
    <Modal title="Create Policy" subtitle="Create a new policy" onClose={onClose}>
      <Field label="Policy Name" required>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={NAME_HINT} style={inputStyle} />
      </Field>
      <Field label="Enabled">
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} aria-label="Enabled" />
          <span style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>{enabled ? "Active" : "Disabled"}</span>
        </label>
      </Field>
      <Field label="Policy Type">
        <select value={policyType} onChange={e => setPolicyType(e.target.value)} style={inputStyle}>
          {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Supported Object Types" required>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {OBJECT_TYPES.map(t => (
            <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 8px", background: supportedTypes.includes(t) ? "rgba(100,120,247,0.18)" : "var(--idf-bg-subtle, #f9fafb)", border: "1px solid var(--idf-border)", borderRadius: 4, cursor: "pointer", color: supportedTypes.includes(t) ? "var(--idf-primary)" : "var(--idf-text)", fontWeight: supportedTypes.includes(t) ? 600 : 400 }}>
              <input type="checkbox" checked={supportedTypes.includes(t)} onChange={() => toggleType(t)} aria-label={t} style={{ display: "none" }} />
              {t}
            </label>
          ))}
        </div>
      </Field>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Rule(s)</div>
        {rules.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input type="text" value={r.name} onChange={e => setRule(i, "name", e.target.value)} placeholder="Rule Name" style={{ ...inputStyle, flex: 1 }} />
            <input type="text" value={r.content} onChange={e => setRule(i, "content", e.target.value)} placeholder="Rule Content" style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => removeRule(i)} style={{ padding: "0 10px", border: "1px solid var(--idf-border)", background: "transparent", color: "var(--idf-text-muted)", borderRadius: 4, cursor: "pointer" }}>−</button>
          </div>
        ))}
        <button type="button" onClick={addRule} style={{ padding: "5px 10px", fontSize: 11, border: "1px dashed var(--idf-border)", borderRadius: 4, background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer" }}>+ Add Rule</button>
      </div>
      <Field label="Comment">
        <textarea value={comment} onChange={e => setComment(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} />
      </Field>
      <PropsEditor props={props} onChange={setProps} />
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} />
    </Modal>
  );
}

const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };
