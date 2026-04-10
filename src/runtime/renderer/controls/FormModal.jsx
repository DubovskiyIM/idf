import { useState } from "react";
import ParameterControl from "../parameters/index.jsx";
import SlotRenderer from "../SlotRenderer.jsx";

export default function FormModal({ spec, ctx, onClose }) {
  const initial = {};
  for (const p of spec.parameters || []) {
    initial[p.name] = p.default ?? "";
  }
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const newErrors = {};
    for (const p of spec.parameters || []) {
      if (p.required && !values[p.name]) newErrors[p.name] = "Обязательное поле";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await ctx.exec(spec.intentId, values);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>{spec.title || spec.intentId}</h2>

      {spec.witnessPanel?.length > 0 && (
        <div style={{ padding: 12, background: "#f9fafb", borderRadius: 6, marginBottom: 16 }}>
          {spec.witnessPanel.map((w, i) => (
            <SlotRenderer key={i} item={w} ctx={ctx} />
          ))}
        </div>
      )}

      <div>
        {(spec.parameters || []).map(param => (
          <ParameterControl
            key={param.name}
            spec={param}
            value={values[param.name]}
            onChange={v => setValues(p => ({ ...p, [param.name]: v }))}
            error={errors[param.name]}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db",
            background: "#fff", cursor: "pointer", fontSize: 13,
          }}
        >Отмена</button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "none",
            background: "#6366f1", color: "#fff", cursor: submitting ? "default" : "pointer",
            fontSize: 13, fontWeight: 600, opacity: submitting ? 0.6 : 1,
          }}
        >{submitting ? "…" : "Выполнить"}</button>
      </div>
    </ModalShell>
  );
}

export function ModalShell({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#0008",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, padding: 20,
          minWidth: 360, maxWidth: 560, maxHeight: "80vh", overflow: "auto",
          boxShadow: "0 20px 50px #0004",
        }}
      >{children}</div>
    </div>
  );
}
