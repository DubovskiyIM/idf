/**
 * CreateRoleDialog — modal для создания role (U-iam2.b + U-iam-polish).
 * Multi-securable-object editor: массив accordion'ов с
 *   Type / Full Name / Allow Privileges multi-select.
 * + Add Securable Object button добавляет новый accordion;
 * minus-кнопка на каждом (кроме случая single accordion) — удаляет.
 */
import { useEffect, useState } from "react";
import { Modal, Field, Footer, PropsEditor } from "./CreateTagDialog.jsx";

const PRIV_BY_TYPE = {
  metalake: ["USE_METALAKE", "CREATE_CATALOG"],
  catalog:  ["USE_CATALOG", "CREATE_SCHEMA", "DROP_SCHEMA"],
  schema:   ["USE_SCHEMA", "CREATE_TABLE", "MODIFY_TABLE", "SELECT_TABLE"],
  table:    ["SELECT_TABLE", "MODIFY_TABLE"],
  fileset:  ["READ_FILESET", "WRITE_FILESET"],
  topic:    ["PRODUCE_TOPIC", "CONSUME_TOPIC"],
};

const blankObj = () => ({ type: "schema", fullName: "", privileges: [] });

export default function CreateRoleDialog({ visible, onClose = () => {}, onSubmit = () => {} }) {
  const [name, setName] = useState("");
  const [objects, setObjects] = useState([blankObj()]);
  const [openPickerIdx, setOpenPickerIdx] = useState(-1);
  const [props, setProps] = useState([{ key: "", value: "" }]);

  useEffect(() => {
    if (!visible) {
      setName(""); setObjects([blankObj()]); setOpenPickerIdx(-1); setProps([{ key: "", value: "" }]);
    }
  }, [visible]);

  if (!visible) return null;

  const addObject = () => setObjects(prev => [...prev, blankObj()]);
  const removeObject = (i) => setObjects(prev => {
    const next = prev.filter((_, idx) => idx !== i);
    return next.length === 0 ? [blankObj()] : next;
  });
  const updateObject = (i, patch) => setObjects(prev => prev.map((o, idx) => idx === i ? { ...o, ...patch } : o));

  const isValid = name.trim() && objects.every(o => o.fullName.trim() && o.privileges.length > 0);
  const submit = () => {
    if (!isValid) return;
    const cleanProps = Object.fromEntries(props.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value]));
    onSubmit({
      name: name.trim(),
      securableObjects: objects.map(o => ({
        type: o.type,
        name: o.fullName.trim(),
        privileges: o.privileges.map(p => ({ name: p, condition: "ALLOW" })),
      })),
      properties: cleanProps,
    });
  };

  return (
    <Modal title="Create Role" subtitle="Create a new role" onClose={onClose}>
      <Field label="Role Name" required>
        <input type="text" value={name} onChange={e => setName(e.target.value)} aria-label="Role Name" placeholder="data_engineer" style={inputStyle} />
      </Field>
      {objects.map((obj, i) => (
        <SecurableObjectAccordion
          key={i}
          obj={obj}
          onChange={(patch) => updateObject(i, patch)}
          onRemove={objects.length > 1 ? () => { removeObject(i); setOpenPickerIdx(-1); } : null}
          pickerOpen={openPickerIdx === i}
          setPickerOpen={(open) => setOpenPickerIdx(open ? i : -1)}
        />
      ))}
      <button
        type="button"
        onClick={addObject}
        style={{ padding: "6px 12px", fontSize: 12, border: "1px dashed var(--idf-border)", borderRadius: 4, background: "transparent", cursor: "pointer", color: "var(--idf-text-muted)", marginBottom: 12 }}
      >+ Add Securable Object</button>
      <PropsEditor props={props} onChange={setProps} />
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} />
    </Modal>
  );
}

function SecurableObjectAccordion({ obj, onChange, onRemove, pickerOpen, setPickerOpen }) {
  const availablePrivs = PRIV_BY_TYPE[obj.type] || [];
  const togglePriv = (p) => onChange({
    privileges: obj.privileges.includes(p) ? obj.privileges.filter(x => x !== p) : [...obj.privileges, p],
  });
  return (
    <div style={{ background: "var(--idf-bg-subtle, #f9fafb)", border: "1px solid var(--idf-border)", borderRadius: 6, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
          {`▼ Securable Object — ${obj.type}${obj.fullName ? `.${obj.fullName}` : ""}`}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove securable ${obj.type} ${obj.fullName || ""}`.trim()}
            title="Remove"
            style={{ background: "transparent", border: "1px solid var(--idf-border)", borderRadius: 4, cursor: "pointer", color: "var(--idf-text-muted)", padding: "2px 8px", fontSize: 14 }}
          >−</button>
        )}
      </div>
      <Field label="Type" required>
        <select value={obj.type} onChange={e => onChange({ type: e.target.value, privileges: [] })} aria-label="Type" style={inputStyle}>
          {Object.keys(PRIV_BY_TYPE).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Full Name" required>
        <input type="text" value={obj.fullName} onChange={e => onChange({ fullName: e.target.value })} aria-label="Full Name" placeholder={obj.type === "schema" ? "catalog.schema" : "name"} style={inputStyle} />
      </Field>
      <Field label="Allow Privileges">
        <div onClick={() => setPickerOpen(!pickerOpen)} style={{ ...inputStyle, minHeight: 30, cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "5px 8px" }}>
          {obj.privileges.length === 0 ? (
            <input type="text" placeholder="Add allow privileges" readOnly style={{ border: "none", background: "transparent", flex: 1, fontSize: 13, color: "var(--idf-text-muted)", outline: "none" }} />
          ) : obj.privileges.map(p => (
            <span key={p} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "rgba(113,221,55,0.18)", color: "#71DD37", fontWeight: 600 }}>{p}</span>
          ))}
        </div>
        {pickerOpen && (
          <div style={{ marginTop: 6, padding: 10, border: "1px solid var(--idf-border)", borderRadius: 6, background: "var(--idf-card)", maxHeight: 200, overflow: "auto" }}>
            {availablePrivs.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>{`Нет привилегий для ${obj.type}`}</div>
            ) : availablePrivs.map(p => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={obj.privileges.includes(p)} onChange={() => togglePriv(p)} aria-label={p.replace(/_/g, " ")} />
                <span>{p.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}

const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };
