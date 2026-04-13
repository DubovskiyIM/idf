import { resolveParams } from "../eval.js";
import { getAdaptedComponent } from "../adapters/registry.js";
import Icon from "../adapters/Icon.jsx";

export default function IntentButton({ spec, ctx, item }) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (spec.opens === "overlay") {
      ctx.openOverlay(spec.overlayKey, { item });
      return;
    }
    // Composer context mode: reply_to_message → set composer reply context
    if (spec.composerMode === "reply" && ctx.setComposerMode && item) {
      const senderName = item.senderName || ((ctx.world?.users || []).find(u => u.id === item.senderId))?.name || "";
      ctx.setComposerMode({
        type: "reply",
        intentId: spec.intentId,
        messageId: item.id,
        senderName,
        preview: item.content || "",
      });
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

  // Адаптер предоставляет унифицированную кнопку намерения (Mantine Button
  // с variant'ами по spec.variant/irreversibility). Если адаптер есть —
  // используем его, иначе built-in inline-styled fallback.
  const Adapted = getAdaptedComponent("button", "intent");
  if (Adapted) {
    return <Adapted spec={spec} onClick={handleClick} />;
  }

  // Fallback: inline-стилизованная кнопка. Сохраняется для случаев без
  // адаптера или для тестов.
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
        border: "1px solid var(--mantine-color-default-border)",
        background: "var(--mantine-color-default)",
        color: "var(--mantine-color-text)",
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
      {icon && <Icon emoji={icon} size={14} />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
