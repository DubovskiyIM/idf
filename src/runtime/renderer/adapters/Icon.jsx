import { getAdaptedComponent } from "./registry.js";
import { getGlobalPrefs } from "../personal/usePersonalPrefs.js";

/**
 * Универсальный `<Icon>` — рендерит иконку через UI-адаптер.
 * Учитывает personal prefs.iconMode:
 *   - "lucide": SVG-иконка через адаптер (default)
 *   - "emoji":  emoji-символ как текст
 *   - "none":   ничего не рендерим
 */
export default function Icon({ emoji, size = 16, color, style }) {
  if (!emoji) return null;
  const { iconMode = "lucide" } = getGlobalPrefs() || {};

  if (iconMode === "none") return null;

  if (iconMode === "lucide") {
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
  }

  // iconMode === "emoji" или fallback
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
