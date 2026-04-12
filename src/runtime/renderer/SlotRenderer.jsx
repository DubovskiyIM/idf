import { PRIMITIVES } from "./primitives/index.js";
import { CONTROLS } from "./controls/index.js";
import { evalCondition } from "./eval.js";
import { resolve } from "./eval.js";

/**
 * Универсальный диспетчер: принимает одиночное контрол-описание или массив
 * и рендерит соответствующие компоненты из PRIMITIVES / CONTROLS.
 */
export default function SlotRenderer({ item, items, ctx, contextItem }) {
  if (items) {
    return items.map((it, i) => (
      <SlotRenderer key={i} item={it} ctx={ctx} contextItem={contextItem} />
    ));
  }

  if (!item) return null;
  if (typeof item === "string") return <span>{item}</span>;

  if (item.condition && !evalCondition(item.condition, { ...(contextItem || {}), world: ctx.world, viewer: ctx.viewer })) {
    return null;
  }

  // hideEmpty: не рендерить элемент, если его bind-значение пустое.
  // Используется в detail body для скрытия незаполненных полей.
  if (item.hideEmpty) {
    const data = contextItem || ctx.world;
    // Для row/column с children — проверяем bind первого дочернего элемента
    const bindField = item.bind || item.children?.[1]?.bind || item.children?.[0]?.bind;
    if (bindField) {
      const val = resolve(data, bindField);
      if (val == null || val === "") return null;
    }
  }

  const Primitive = PRIMITIVES[item.type];
  if (Primitive) return <Primitive node={item} ctx={ctx} item={contextItem} />;

  const Control = CONTROLS[item.type];
  if (Control) return <Control spec={item} ctx={ctx} item={contextItem} />;

  return (
    <div style={{ color: "#ef4444", fontSize: 10 }}>
      Unknown type: {item.type}
    </div>
  );
}
