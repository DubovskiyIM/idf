import { useState } from "react";
import ParameterControl from "../parameters/index.jsx";
import Icon from "../adapters/Icon.jsx";

/**
 * InlineSetter — inline-форма «параметр + Установить» для single-param
 * intent'ов в footer detail-проекции.
 *
 * Используется для set_deadline, set_limit и подобных «настроечных»
 * интентов, где пользователь должен ввести одно значение и применить.
 * Альтернатива formModal-оверлею: менее прерывисто, ближе к «tweak»-UX.
 */
export default function InlineSetter({ spec, target, ctx }) {
  const param = spec.parameters?.[0];
  const [value, setValue] = useState("");

  if (!param) return null;

  const submit = () => {
    if (value === "" || value == null) return;
    ctx.exec(spec.intentId, { id: target?.id, [param.name]: value });
    setValue("");
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 12,
      background: "var(--mantine-color-default)",
      border: "1px solid var(--mantine-color-default-border)",
      borderRadius: 8,
    }}>
      {spec.icon && <Icon emoji={spec.icon} size={16} />}
      <span style={{ fontSize: 13, color: "var(--mantine-color-text)", fontWeight: 500 }}>
        {spec.label}:
      </span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <ParameterControl
          spec={{ ...param, label: undefined }}
          value={value}
          onChange={setValue}
        />
      </div>
      <button
        onClick={submit}
        disabled={!value}
        style={{
          padding: "8px 16px",
          borderRadius: 6,
          border: "none",
          background: value ? "#f59e0b" : "#fde68a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: value ? "pointer" : "default",
          fontFamily: "inherit",
        }}
      >
        Установить
      </button>
    </div>
  );
}
