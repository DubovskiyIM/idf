import { useState } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import Icon from "../adapters/Icon.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";
import { resolveParams } from "../eval.js";

/**
 * Overflow — кнопка «⋯» c dropdown-меню. Используется когда в toolbar
 * > 5 intent-кнопок: кристаллизатор кладёт хвост в `{type: "overflow",
 * children: [...intentButton specs]}`.
 *
 * Адаптер: Mantine Menu (`button.overflow`) — красивый dropdown с
 * иконками и hover. Fallback — inline popover.
 *
 * Children могут быть двух форм:
 *   - intentButton spec (обычный intent) — click → exec
 *   - trigger с opens:"overlay" — click → openOverlay
 */
export default function Overflow({ spec, ctx, item }) {
  const [open, setOpen] = useState(false);
  const children = spec.children || [];

  // Преобразовать child-specs в items для MantineOverflowMenu.
  // Поддерживает {type:"divider"} как разделитель секций.
  const items = children.map((child, i) => {
    if (child.type === "divider") {
      return { key: `div-${i}`, divider: true };
    }
    const label = child.label || child.intentId || `item-${i}`;
    const onClick = () => {
      if (child.opens === "overlay") {
        ctx.openOverlay?.(child.overlayKey, { item });
        return;
      }
      const params = resolveParams(child.params || {}, { ...ctx, item });
      ctx.exec?.(child.intentId, { ...params, id: item?.id });
    };
    return {
      key: child.intentId || `item-${i}`,
      label,
      icon: child.icon,
      onClick,
    };
  });

  const AdaptedOverflow = getAdaptedComponent("button", "overflow");
  if (AdaptedOverflow) {
    return <AdaptedOverflow items={items} triggerIcon={spec.icon} triggerLabel={spec.label} />;
  }

  // Fallback — inline popover. Если spec.icon задана — показываем иконку группы
  // вместо «⋯» (иконка-группа для сгруппированных по иконке кнопок).
  const triggerEmoji = spec.icon || "⋯";
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        title={spec.label || "Ещё"}
        style={{
          padding: "6px 10px", borderRadius: 6,
          border: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-default)",
          color: "var(--mantine-color-text)",
          cursor: "pointer", fontSize: 14,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        <Icon emoji={triggerEmoji} size={16} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4,
            background: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px #0004", padding: 4, zIndex: 10, minWidth: 220,
            maxHeight: "60vh", overflowY: "auto",
          }}
        >
          {(spec.children || []).map((child, i) => (
            <SlotRenderer key={i} item={child} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}
