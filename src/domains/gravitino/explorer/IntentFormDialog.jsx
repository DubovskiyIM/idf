/**
 * IntentFormDialog — generic host-form для intent.parameters (importer-openapi 0.16+
 * extract'ит body schema fields в parameters). Заменяет custom Create/Edit Dialog'и.
 *
 * Конвертирует gravitino intent.parameters (object) → form fields:
 *   - skip path-only params (`metalake`/`metalakeId` etc.) — passed via contextParams
 *   - skip aliasOf duplicates
 *   - text input для type:"string" (textarea если comment/description)
 *   - select для param.values (enum)
 *   - checkbox для type:"boolean"
 *   - SDK ColorPicker для name === "color" или type === "color" (renderer 0.66+)
 *   - SDK KeyValueEditor для type === "json" с object value (renderer 0.66+) —
 *     gravitino properties / Tag/Catalog/Schema/Table/...
 *
 * Reuses Modal/Field/Footer из CreateTagDialog (общая host-form инфраструктура).
 */
import { useEffect, useState } from "react";
import { ColorPicker, KeyValueEditor } from "@intent-driven/renderer";
import { Modal, Field, Footer } from "./CreateTagDialog.jsx";

const PATH_PARAMS = new Set(["metalake", "metalakeId", "catalog", "catalogId", "schema", "schemaId", "table", "fileset", "topic", "model", "user", "group", "role", "tag", "policy"]);
// Server-set / synthetic / not-form-suitable
const SKIP_PARAMS = new Set(["audit", "inherited", "objectId", "securableObjects", "content"]);
// Types we render via custom widgets — others stay text/select/checkbox
const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };

function buildFormFields(intent) {
  if (!intent?.parameters) return [];
  return Object.entries(intent.parameters)
    .filter(([name, def]) => !PATH_PARAMS.has(name) && !SKIP_PARAMS.has(name) && !def.aliasOf)
    .map(([name, def]) => ({ name, ...def }));
}

function fieldDefault(field, initial) {
  if (initial && initial[field.name] !== undefined) return initial[field.name];
  if (field.name === "color") return "#6478f7";
  if (field.type === "json" || field.type === "object") return {};
  if (field.type === "array") return [];
  if (field.type === "boolean") return false;
  if (field.type === "number") return "";
  return "";
}

export default function IntentFormDialog({
  visible, intentId, intents, contextParams = {},
  initial, title, submitLabel,
  onClose = () => {}, onSubmit = () => {},
}) {
  const intent = intents?.[intentId];
  const fields = intent ? buildFormFields(intent) : [];

  const [values, setValues] = useState({});
  useEffect(() => {
    if (!visible) { setValues({}); return; }
    const next = {};
    for (const f of fields) next[f.name] = fieldDefault(f, initial);
    setValues(next);
  }, [visible, intentId, initial?.id]);

  if (!visible || !intent) return null;

  const isValid = fields.every(f => !f.required || (values[f.name] !== "" && values[f.name] !== undefined));
  const submit = () => {
    if (!isValid) return;
    const payload = { ...values, ...contextParams };
    if (initial?.id) payload.id = initial.id;
    if (initial?.audit) payload.audit = initial.audit;
    onSubmit(payload);
  };

  const isEdit = !!initial;
  const computedTitle = title || (isEdit ? `Edit ${intentId}` : `Create ${intentId}`);

  return (
    <Modal title={computedTitle} subtitle={intent.description} onClose={onClose} width={520}>
      {fields.map(f => (
        <Field key={f.name} label={fieldLabel(f.name)} required={f.required}>
          {renderField(f, values[f.name], (v) => setValues(prev => ({ ...prev, [f.name]: v })))}
        </Field>
      ))}
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} submitLabel={submitLabel || (isEdit ? "Save" : "Submit")} />
    </Modal>
  );
}

function fieldLabel(name) {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
}

function renderField(f, value, onChange) {
  if (f.name === "color" || f.type === "color") {
    return <ColorPicker value={value || "#6478f7"} onChange={onChange} />;
  }
  if (f.type === "json" || f.type === "object") {
    return <KeyValueEditor value={value || {}} onChange={onChange} />;
  }
  if (f.values?.length) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
        <option value="">— выберите —</option>
        {f.values.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  if (f.type === "boolean") {
    return <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />;
  }
  if (f.name === "comment" || f.name === "description") {
    return <textarea value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, minHeight: 70 }} />;
  }
  return <input type={f.type === "number" ? "number" : "text"} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />;
}
