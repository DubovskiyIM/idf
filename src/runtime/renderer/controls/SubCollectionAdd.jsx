import { useState } from "react";
import ParameterControl from "../parameters/index.jsx";

/**
 * SubCollectionAdd — inline-композер для добавления sub-сущности в detail.
 *
 * Используется секциями detail-архетипа (step B). Параметры визуализируются
 * как ряд полей ввода + кнопка «+ Добавить». При submit вызывает
 * ctx.exec(intentId, { [foreignKey]: target.id, ...values }).
 *
 * UX-паттерн: inline-форма без модала. Для TimeOption это будет строка
 * [date picker][start time][end time][+]. Для Participant — [имя][+].
 */
export default function SubCollectionAdd({ spec, ctx, target }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    for (const p of spec.parameters || []) initial[p.name] = "";
    return initial;
  });
  const [errors, setErrors] = useState({});

  const submit = () => {
    // Валидация: required поля
    const newErrors = {};
    for (const p of spec.parameters || []) {
      if (p.required && !values[p.name]) newErrors[p.name] = "Обязательно";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    // foreignKey подставляется из target автоматически
    const payload = { ...values };
    if (spec.foreignKey && target?.id) {
      payload[spec.foreignKey] = target.id;
    }
    ctx.exec(spec.intentId, payload);
    // Очистить форму
    const cleared = {};
    for (const p of spec.parameters || []) cleared[p.name] = "";
    setValues(cleared);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const hasValues = Object.values(values).some(v => v !== "" && v != null);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
      {(spec.parameters || []).map(param => (
        <div key={param.name} style={{ flex: param.control === "textarea" ? 1 : "none", minWidth: 120 }} onKeyDown={onKeyDown}>
          <ParameterControl
            spec={{ ...param, label: undefined }}
            value={values[param.name]}
            onChange={v => setValues(p => ({ ...p, [param.name]: v }))}
            error={errors[param.name]}
          />
        </div>
      ))}
      <button
        onClick={submit}
        disabled={!hasValues}
        title={spec.label || "Добавить"}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: hasValues ? "#6366f1" : "#c7d2fe",
          color: "#fff",
          fontSize: 18,
          fontWeight: 700,
          cursor: hasValues ? "pointer" : "default",
          lineHeight: 1,
          marginBottom: 12, // выровнять с полями, у которых есть label-отступ
        }}
      >
        +
      </button>
    </div>
  );
}
