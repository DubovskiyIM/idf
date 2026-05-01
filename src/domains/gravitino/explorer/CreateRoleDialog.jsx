/**
 * CreateRoleDialog — modal для создания role (U-iam2.b).
 * Single-securable-object editor (один объект, MVP):
 *   Type / Full Name / Allow Privileges multi-select / Properties.
 * Multiple securable objects — backlog (web-v2 has accordion, в MVP — single).
 */
import { useEffect, useMemo, useState } from "react";
import { Modal, Field, Footer, PropsEditor } from "./CreateTagDialog.jsx";

const PRIV_BY_TYPE = {
  metalake: ["USE_METALAKE", "CREATE_CATALOG"],
  catalog:  ["USE_CATALOG", "CREATE_SCHEMA", "DROP_SCHEMA"],
  schema:   ["USE_SCHEMA", "CREATE_TABLE", "MODIFY_TABLE", "SELECT_TABLE"],
  table:    ["SELECT_TABLE", "MODIFY_TABLE"],
  fileset:  ["READ_FILESET", "WRITE_FILESET"],
  topic:    ["PRODUCE_TOPIC", "CONSUME_TOPIC"],
};

export default function CreateRoleDialog({ visible, onClose = () => {}, onSubmit = () => {} }) {
  const [name, setName] = useState("");
  const [objectType, setObjectType] = useState("schema");
  const [fullName, setFullName] = useState("");
  const [privileges, setPrivileges] = useState([]);
  const [privPickerOpen, setPrivPickerOpen] = useState(false);
  const [props, setProps] = useState([{ key: "", value: "" }]);

  useEffect(() => {
    if (!visible) { setName(""); setObjectType("schema"); setFullName(""); setPrivileges([]); setPrivPickerOpen(false); setProps([{ key: "", value: "" }]); }
  }, [visible]);
  useEffect(() => { setPrivileges([]); }, [objectType]);

  const availablePrivs = useMemo(() => PRIV_BY_TYPE[objectType] || [], [objectType]);
  if (!visible) return null;

  const isValid = name.trim() && fullName.trim() && privileges.length > 0;
  const submit = () => {
    if (!isValid) return;
    const cleanProps = Object.fromEntries(props.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value]));
    onSubmit({
      name: name.trim(),
      securableObjects: [{
        type: objectType, name: fullName.trim(),
        privileges: privileges.map(p => ({ name: p, condition: "ALLOW" })),
      }],
      properties: cleanProps,
    });
  };
  const togglePriv = (p) => setPrivileges(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  return (
    <Modal title="Create Role" subtitle="Create a new role" onClose={onClose}>
      <Field label="Role Name" required>
        <input type="text" value={name} onChange={e => setName(e.target.value)} aria-label="Role Name" placeholder="data_engineer" style={inputStyle} />
      </Field>
      <div style={{ background: "var(--idf-bg-subtle, #f9fafb)", border: "1px solid var(--idf-border)", borderRadius: 6, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          ▼ Securable Object — {objectType}{fullName ? `.${fullName}` : ""}
        </div>
        <Field label="Type" required>
          <select value={objectType} onChange={e => setObjectType(e.target.value)} aria-label="Type" style={inputStyle}>
            {Object.keys(PRIV_BY_TYPE).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Full Name" required>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} aria-label="Full Name" placeholder={objectType === "schema" ? "catalog.schema" : "name"} style={inputStyle} />
        </Field>
        <Field label="Allow Privileges">
          <div onClick={() => setPrivPickerOpen(o => !o)} style={{ ...inputStyle, minHeight: 30, cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "5px 8px" }}>
            {privileges.length === 0 ? (
              <input type="text" placeholder="Add allow privileges" readOnly style={{ border: "none", background: "transparent", flex: 1, fontSize: 13, color: "var(--idf-text-muted)", outline: "none" }} />
            ) : privileges.map(p => (
              <span key={p} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "rgba(113,221,55,0.18)", color: "#71DD37", fontWeight: 600 }}>{p}</span>
            ))}
          </div>
          {privPickerOpen && (
            <div style={{ marginTop: 6, padding: 10, border: "1px solid var(--idf-border)", borderRadius: 6, background: "var(--idf-card)", maxHeight: 200, overflow: "auto" }}>
              {availablePrivs.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>Нет привилегий для {objectType}</div>
              ) : availablePrivs.map(p => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={privileges.includes(p)} onChange={() => togglePriv(p)} aria-label={p.replace(/_/g, " ")} />
                  <span>{p.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
      </div>
      <PropsEditor props={props} onChange={setProps} />
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} />
    </Modal>
  );
}

const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };
