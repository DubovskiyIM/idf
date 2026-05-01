/**
 * CreateCatalogDialog — modal с dynamic form для создания catalog (U3).
 *
 * Cascade: Type → Provider → provider-specific fields. Common: name, comment.
 * Field schema из PROVIDER_SCHEMA (см. providerSchema.js). Submit валиден
 * только когда name и все required-fields заполнены.
 *
 * Vitest-friendly: native <select>/<input>, без AntD/MUI зависимостей.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { TYPES, providersForType, fieldsForProvider } from "./providerSchema.js";

export default function CreateCatalogDialog({ visible, onClose = () => {}, onSubmit = () => {} }) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState("");
  const [provider, setProvider] = useState("");
  const [props, setProps] = useState({});
  const idPrefix = useId();

  useEffect(() => {
    if (!visible) {
      // Reset при close
      setName(""); setComment(""); setType(""); setProvider(""); setProps({});
    }
  }, [visible]);

  const providers = useMemo(() => providersForType(type), [type]);
  const fields = useMemo(() => fieldsForProvider(type, provider), [type, provider]);

  // Apply defaultValue для provider-fields при смене provider
  useEffect(() => {
    if (!provider) return;
    const next = {};
    for (const f of fields) {
      if (f.defaultValue !== undefined) next[f.key] = f.defaultValue;
    }
    setProps(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);  // intentionally no `fields` dep — same provider → stable

  if (!visible) return null;

  const isValid = name.trim() && type && provider &&
    fields.every(f => !f.required || (props[f.key] && String(props[f.key]).trim()));

  const submit = () => {
    if (!isValid) return;
    onSubmit({
      type, provider,
      name: name.trim(),
      comment: comment.trim(),
      properties: { ...props },
    });
  };

  return (
    <div
      role="dialog"
      aria-label="Create Catalog"
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--idf-card, #fff)",
          color: "var(--idf-text)",
          border: "1px solid var(--idf-border, #e5e7eb)",
          borderRadius: 8, padding: 20,
          width: 480, maxHeight: "80vh", overflow: "auto",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Create Catalog</h3>

        <Field id={`${idPrefix}-name`} label="Name" required>
          <input
            id={`${idPrefix}-name`}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            placeholder="my_catalog"
          />
        </Field>

        <Field id={`${idPrefix}-comment`} label="Comment">
          <input
            id={`${idPrefix}-comment`}
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            style={inputStyle}
            placeholder="Опционально"
          />
        </Field>

        <Field id={`${idPrefix}-type`} label="Type" required>
          <select
            id={`${idPrefix}-type`}
            value={type}
            onChange={e => { setType(e.target.value); setProvider(""); setProps({}); }}
            style={inputStyle}
          >
            <option value="">— выбрать тип —</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        {type && (
          <Field id={`${idPrefix}-provider`} label="Provider" required>
            <select
              id={`${idPrefix}-provider`}
              value={provider}
              onChange={e => setProvider(e.target.value)}
              style={inputStyle}
            >
              <option value="">— выбрать провайдер —</option>
              {providers.map(p => (
                <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
              ))}
            </select>
          </Field>
        )}

        {fields.map(f => {
          const fieldId = `${idPrefix}-prop-${f.key}`;
          return (
            <Field key={f.key} id={fieldId} label={f.label} required={f.required} description={f.description}>
              {f.kind === "select" ? (
                <select
                  id={fieldId}
                  value={props[f.key] ?? ""}
                  onChange={e => setProps(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                >
                  {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  id={fieldId}
                  type={f.kind === "password" ? "password" : "text"}
                  value={props[f.key] ?? ""}
                  onChange={e => setProps(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              )}
            </Field>
          );
        })}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid}
            style={isValid ? btnPrimary : { ...btnPrimary, opacity: 0.5, cursor: "not-allowed" }}
          >Create</button>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, required, description, children }) {
  // Используем explicit htmlFor/id — testing-library ассоциирует input с label
  // даже если в label есть дополнительный текст вроде «*». Лейбл — отдельный
  // элемент, контролы — siblings.
  return (
    <div style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
      <label htmlFor={id} style={{ fontWeight: 600, color: "var(--idf-text)" }}>
        {label}
      </label>
      {required && <span style={{ color: "#FF3E1D" }}> *</span>}
      {children}
      {description && (
        <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--idf-text-muted)" }}>
          {description}
        </span>
      )}
    </div>
  );
}

const inputStyle = {
  display: "block", width: "100%", marginTop: 4,
  padding: "6px 8px", fontSize: 13,
  border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
  background: "var(--idf-surface, #fff)", color: "var(--idf-text)",
  boxSizing: "border-box",
};

const btnPrimary = {
  padding: "6px 16px", fontSize: 12, fontWeight: 600,
  border: "1px solid var(--idf-primary, #6478f7)",
  background: "var(--idf-primary, #6478f7)", color: "white",
  borderRadius: 4, cursor: "pointer",
};

const btnSecondary = {
  padding: "6px 14px", fontSize: 12,
  border: "1px solid var(--idf-border, #e5e7eb)",
  background: "transparent", color: "var(--idf-text-muted)",
  borderRadius: 4, cursor: "pointer",
};
