import { useState, useEffect, useRef } from "react";
import Icon from "../adapters/Icon.jsx";

/**
 * Inline-инпут поиска. Живёт в toolbar проекции, пишет в ctx.viewState
 * (параметры запроса проекции, §5 манифеста v1.1+). List.filter читает
 * viewState через eval-контекст.
 *
 * По submit (Enter) — опционально emit'ит сигнал через exec (для логирования
 * истории поиска; если buildEffects не умеет обрабатывать search_messages,
 * возвращает null и это ok — view-filter всё равно работает).
 */
export default function InlineSearch({ spec, ctx }) {
  const [value, setValue] = useState(ctx.viewState?.[spec.paramName] || "");
  const inputRef = useRef(null);

  // Синхронизация с ctx.viewState при изменении локального state
  useEffect(() => {
    if (ctx.setViewState) {
      ctx.setViewState(spec.paramName, value);
    }
  }, [value, spec.paramName]);

  // Q1: search = view-filter + опциональный signal через exec
  const onSubmit = (e) => {
    e.preventDefault();
    if (ctx.exec && value) {
      try {
        ctx.exec(spec.intentId, { [spec.paramName]: value });
      } catch {
        // buildEffects для search_messages может вернуть null — это ок,
        // view-filter продолжает работать через viewState.
      }
    }
    inputRef.current?.blur();
  };

  return (
    <form onSubmit={onSubmit} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: 20,
      border: "1px solid var(--mantine-color-default-border)",
      background: "var(--mantine-color-default)",
      minWidth: 220,
    }}>
      <Icon emoji={spec.icon || "🔍"} size={14} style={{ color: "var(--mantine-color-dimmed)" }} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={spec.placeholder || "Поиск…"}
        style={{
          flex: 1, border: "none", outline: "none",
          fontSize: 13, background: "transparent",
          color: "var(--mantine-color-text)",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.2,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--mantine-color-dimmed)", padding: 0,
            lineHeight: 1,
          }}
          title="Очистить"
        >✕</button>
      )}
    </form>
  );
}
