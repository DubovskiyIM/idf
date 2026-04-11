import { useState, useRef } from "react";
import ParameterControl from "../parameters/index.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";
import Icon from "../adapters/Icon.jsx";

/**
 * HeroCreate — inline-создатель главной сущности в catalog.
 *
 * UX-паттерн: большой input + primary button. Enter/клик → ctx.exec(intentId,
 * { [paramName]: value }). Используется для create_poll, create_group и
 * подобных «быстрых создателей».
 *
 * Реализация через адаптер: ParameterControl для input (Mantine TextInput
 * в dark/light), адаптер button.primary — Mantine Button. Полностью
 * адаптивно к теме, без inline white-фонов.
 */
export default function HeroCreate({ spec, ctx }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  const submit = () => {
    if (!value.trim()) return;
    ctx.exec(spec.intentId, { [spec.paramName || "title"]: value.trim() });
    setValue("");
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const disabled = !value.trim();
  const AdaptedPrimary = getAdaptedComponent("button", "primary");

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        margin: "0 0 16px 0",
      }}
      onKeyDown={onKeyDown}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <ParameterControl
          spec={{
            name: spec.paramName || "title",
            control: "text",
            placeholder: spec.placeholder || "Название…",
            label: "",
          }}
          value={value}
          onChange={setValue}
        />
      </div>
      {AdaptedPrimary ? (
        <AdaptedPrimary
          label={spec.buttonLabel || "Создать"}
          icon={<Icon emoji={spec.icon || "+"} size={16} />}
          onClick={submit}
          disabled={disabled}
          size="md"
        />
      ) : (
        <button
          onClick={submit}
          disabled={disabled}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: disabled ? "var(--mantine-color-default)" : "var(--mantine-color-indigo-6)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          {spec.buttonLabel || "Создать"}
        </button>
      )}
    </div>
  );
}
