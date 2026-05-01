/**
 * LinkVersionDialog — modal для link новой ModelVersion (U6.1).
 *
 * Поля: version (number, default = suggestedVersion), modelObject (URI,
 * required), aliases (comma-separated string → string[]).
 *
 * Submit отдаёт { version, modelObject, aliases }; CatalogExplorer применяет
 * это в optimistic-state (без backend exec; реальный intent
 * `linkModelVersion` из imported.js — отдельная итерация U6.1b).
 *
 * Паттерн вёрстки/Field — как в CreateCatalogDialog (U3): native inputs +
 * explicit htmlFor/id, чтобы testing-library `getByLabelText` работал
 * штатно даже при наличии «*» в подписи.
 */
import { useEffect, useId, useState } from "react";

export default function LinkVersionDialog({
  visible,
  suggestedVersion = 1,
  onClose = () => {},
  onSubmit = () => {},
}) {
  const [version, setVersion] = useState(String(suggestedVersion));
  const [modelObject, setModelObject] = useState("");
  const [aliases, setAliases] = useState("");
  const idPrefix = useId();

  useEffect(() => {
    if (!visible) {
      setVersion(String(suggestedVersion));
      setModelObject("");
      setAliases("");
    } else {
      setVersion(String(suggestedVersion));
    }
  }, [visible, suggestedVersion]);

  if (!visible) return null;

  const isValid = Boolean(version) && modelObject.trim().length > 0;

  const submit = () => {
    if (!isValid) return;
    onSubmit({
      version: Number(version),
      modelObject: modelObject.trim(),
      aliases: aliases.split(",").map(a => a.trim()).filter(Boolean),
    });
  };

  return (
    <div
      role="dialog"
      aria-label="Link Version"
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
          borderRadius: 8, padding: 18,
          width: 420, boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Link Model Version</h3>

        <Field id={`${idPrefix}-version`} label="Version" required>
          <input
            id={`${idPrefix}-version`}
            type="number"
            min={1}
            value={version}
            onChange={e => setVersion(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field
          id={`${idPrefix}-uri`}
          label="Model object (URI)"
          required
          description="mlflow://... или s3://..."
        >
          <input
            id={`${idPrefix}-uri`}
            type="text"
            value={modelObject}
            onChange={e => setModelObject(e.target.value)}
            style={inputStyle}
            placeholder="s3://bucket/model/v1.pkl"
          />
        </Field>

        <Field
          id={`${idPrefix}-aliases`}
          label="Aliases"
          description="Через запятую: staging, production, candidate"
        >
          <input
            id={`${idPrefix}-aliases`}
            type="text"
            value={aliases}
            onChange={e => setAliases(e.target.value)}
            style={inputStyle}
            placeholder="staging, candidate"
          />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid}
            style={isValid ? btnPrimary : { ...btnPrimary, opacity: 0.5, cursor: "not-allowed" }}
          >Link Version</button>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, required, description, children }) {
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
