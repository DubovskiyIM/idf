/**
 * IntentFormDialog — generic host-form для intent.parameters (importer-openapi 0.16+
 * extract'ит body schema fields в parameters). Заменяет custom Create/Edit Dialog'и
 * для случаев когда форма — простой набор text/select полей.
 *
 * Конвертирует gravitino intent.parameters (object) → form fields:
 *   - skip path-only params (`metalake`/`metalakeId` etc.) — passed via contextParams
 *   - skip aliasOf duplicates (`metalakeId` aliasOf metalake)
 *   - text input для type:"string" (textarea если param.name === "comment")
 *   - select для param.values (enum)
 *   - checkbox для type:"boolean"
 *   - skip type:"json"/"array" (custom UI required — author keeps custom dialog)
 *
 * Для интентов с json/array полями (createTag color, properties etc.) — host
 * остаётся с кастомным dialog. SDK FormModal с form-overlay derivation —
 * future work (нужен export FormModal + colorPicker/keyValueEditor primitives).
 *
 * Reuses Modal/Field/Footer из CreateTagDialog (общая host-form инфраструктура).
 */
import { useEffect, useState } from "react";
import { Modal, Field, Footer } from "./CreateTagDialog.jsx";

const PATH_PARAMS = new Set(["metalake", "metalakeId", "catalog", "catalogId", "schema", "schemaId", "table", "fileset", "topic", "model", "user", "group", "role", "tag", "policy"]);
const SKIP_TYPES = new Set(["json", "array", "object"]);

const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };

function buildFormFields(intent) {
  if (!intent?.parameters) return [];
  return Object.entries(intent.parameters)
    .filter(([name, def]) => !PATH_PARAMS.has(name) && !def.aliasOf && !SKIP_TYPES.has(def.type))
    .map(([name, def]) => ({ name, ...def }));
}

function fieldDefault(field, initial) {
  if (initial && initial[field.name] !== undefined) return initial[field.name];
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
    <Modal title={computedTitle} subtitle={intent.description} onClose={onClose} width={460}>
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
