import { resolveParams } from "../eval.js";

export default function IntentButton({ spec, ctx, item }) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (spec.opens === "overlay") {
      ctx.openOverlay(spec.overlayKey, { item });
      return;
    }
    if (spec.filePicker) {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = async (ev) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        ctx.exec(spec.intentId, { file, id: item?.id });
      };
      input.click();
      return;
    }
    const params = resolveParams(spec.params || {}, { ...ctx, item });
    ctx.exec(spec.intentId, { ...params, id: item?.id });
  };

  // Правило иконирования: при длинных именах (>8 символов) показываем
  // только иконку + tooltip. При коротких — icon + label.
  // Семантическая иконка уже подобрана getIntentIcon при кристаллизации.
  const label = spec.label || spec.intentId;
  const icon = spec.icon;
  const LABEL_MAX = 8;
  const showLabel = label.length <= LABEL_MAX;

  return (
    <button
      onClick={handleClick}
      title={label}
      style={{
        padding: showLabel ? "6px 12px" : "6px 10px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: "#fff",
        color: "#1a1a2e",
        fontSize: 13,
        cursor: "pointer",
        fontWeight: 500,
        fontFamily: "system-ui, sans-serif",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        lineHeight: 1,
      }}
    >
      {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
