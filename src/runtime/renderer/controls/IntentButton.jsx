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

  return (
    <button onClick={handleClick} style={{
      padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db",
      background: "#fff", color: "#1a1a2e", fontSize: 13, cursor: "pointer",
      fontWeight: 500, fontFamily: "system-ui, sans-serif",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {spec.icon && <span>{spec.icon}</span>}
      {spec.label || spec.intentId}
    </button>
  );
}
