import { useState } from "react";
import ParameterControl from "../parameters/index.jsx";
import SlotRenderer from "../SlotRenderer.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";

export default function FormModal({ spec, ctx, overlayContext, onClose }) {
  const item = overlayContext?.item;

  // Для editable параметров — предзаполнить из item (по `bind` или по имени поля)
  const initial = {};
  for (const p of spec.parameters || []) {
    if (p.editable && item) {
      const fieldName = p.bind ? p.bind.split(".").pop() : p.name;
      initial[p.name] = item[fieldName] ?? p.default ?? "";
    } else {
      initial[p.name] = p.default ?? "";
    }
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
      // Если это per-item overlay — включить id сущности в параметры exec.
      const params = item ? { id: item.id, entity: item, ...values } : values;
      await ctx.exec(spec.intentId, params);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={spec.title || spec.intentId}>
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

export function ModalShell({ children, onClose, title }) {
  // Сначала пробуем адаптер (Mantine Modal). Адаптер сам обеспечивает
  // открытое состояние, анимации, поверхность и поведение close.
  const AdaptedModal = getAdaptedComponent("shell", "modal");
  if (AdaptedModal) {
    return (
      <AdaptedModal onClose={onClose} title={title}>
        {children}
      </AdaptedModal>
    );
  }

  // Fallback: inline-стилизованный модал.
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
      >
        {title && <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
