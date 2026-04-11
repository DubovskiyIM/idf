import { getAdaptedComponent } from "./registry.js";

/**
 * Универсальный `<Icon>` — рендерит иконку через UI-адаптер.
 *
 * Использование:
 *   <Icon emoji="✎" size={16} />
 *
 * Логика:
 *   1. Смотрит в adapter.icon.resolve(emoji) — функция, возвращающая
 *      React-компонент иконки (например, Lucide React).
 *   2. Если компонент есть — рендерит его с size.
 *   3. Иначе — fallback: <span>{emoji}</span>.
 *
 * Благодаря этому runtime компоненты не знают про Lucide напрямую —
 * вся связь идёт через адаптер, и другой kit (Phosphor, Heroicons,
 * собственный emoji-set) можно подключить одной строкой.
 */
export default function Icon({ emoji, size = 16, color, style }) {
  if (!emoji) return null;

  const iconCategory = getAdaptedComponent("icon", "resolve");
  const IconComponent = typeof iconCategory === "function" ? iconCategory(emoji) : null;

  if (IconComponent) {
    return (
      <IconComponent
        size={size}
        color={color}
        style={{ display: "inline-block", verticalAlign: "middle", ...(style || {}) }}
        strokeWidth={2}
      />
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: size,
        lineHeight: 1,
        verticalAlign: "middle",
        ...(style || {}),
      }}
    >
      {emoji}
    </span>
  );
}
