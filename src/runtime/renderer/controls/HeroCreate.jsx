import { useState, useRef } from "react";
import Icon from "../adapters/Icon.jsx";

/**
 * HeroCreate — inline-создатель главной сущности в catalog.
 *
 * UX-паттерн: большой input + primary button. Enter/клик → ctx.exec(intentId,
 * { [paramName]: value }). Используется для create_poll, create_group и
 * подобных «быстрых создателей».
 *
 * Заменяет fab+formModal в случаях, когда главной сущности достаточно одного
 * текстового параметра (имя/заголовок). Экономит клики: пользователь
 * печатает название и нажимает Enter — проекция обновляется.
 */
export default function HeroCreate({ spec, ctx }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  const submit = () => {
    if (!value.trim()) return;
    ctx.exec(spec.intentId, { [spec.paramName || "title"]: value.trim() });
    setValue("");
    // Фокус обратно на input — можно сразу создавать следующий
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const disabled = !value.trim();

  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "stretch",
      margin: "0 0 16px 0",
    }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={spec.placeholder || "Название…"}
        style={{
          flex: 1,
          padding: "12px 16px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontSize: 15,
          outline: "none",
          fontFamily: "inherit",
          background: "#fff",
        }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        style={{
          padding: "12px 20px",
          borderRadius: 8,
          border: "none",
          background: disabled ? "#c7d2fe" : "#6366f1",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? "default" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "inherit",
          transition: "background 0.1s",
        }}
      >
        {spec.icon && <Icon emoji={spec.icon} size={15} />}
        <span>{spec.buttonLabel || "Создать"}</span>
      </button>
    </div>
  );
}
