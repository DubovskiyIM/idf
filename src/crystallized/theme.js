/**
 * Визуальный язык кристаллизации.
 * Определяет темы, палитры и стили для кристаллизованных проекций.
 *
 * Варианты:
 *   "clean"    — минималистичный, много воздуха, тонкие линии
 *   "dense"    — компактный, информационно-плотный, для экспертов
 *   "playful"  — скруглённые, цветные акценты, для потребительских UI
 */

export const THEMES = {
  light: {
    bg: "#fafafa", surface: "#ffffff", surfaceHover: "#f9fafb",
    text: "#1a1a2e", textSecondary: "#6b7280", textMuted: "#9ca3af",
    border: "#e5e7eb", borderAccent: "#c7d2fe",
    accent: "#6366f1", accentBg: "#eef2ff",
    success: "#22c55e", successBg: "#f0fdf4",
    warning: "#f59e0b", warningBg: "#fffbeb",
    danger: "#ef4444", dangerBg: "#fef2f2",
    info: "#60a5fa", infoBg: "#eff6ff",
    muted: "#6b7280", mutedBg: "#f3f4f6",
  },
  dark: {
    bg: "#0c0e14", surface: "#13151d", surfaceHover: "#1a1c28",
    text: "#e2e5eb", textSecondary: "#9ca3af", textMuted: "#6b7280",
    border: "#1e2230", borderAccent: "#3730a3",
    accent: "#818cf8", accentBg: "#1e1b4b",
    success: "#4ade80", successBg: "#052e16",
    warning: "#fbbf24", warningBg: "#422006",
    danger: "#f87171", dangerBg: "#450a0a",
    info: "#60a5fa", infoBg: "#172554",
    muted: "#6b7280", mutedBg: "#1e2230",
  }
};

export const VARIANTS = {
  clean: {
    radius: 10, padding: 16, gap: 10,
    fontSize: { h1: 20, h2: 16, body: 14, small: 12, tiny: 10 },
    borderWidth: 1, shadow: "0 1px 3px #0001",
    font: "system-ui, -apple-system, sans-serif",
  },
  dense: {
    radius: 6, padding: 10, gap: 6,
    fontSize: { h1: 16, h2: 14, body: 12, small: 11, tiny: 9 },
    borderWidth: 1, shadow: "none",
    font: "ui-monospace, 'SF Mono', monospace",
  },
  playful: {
    radius: 16, padding: 18, gap: 12,
    fontSize: { h1: 22, h2: 18, body: 15, small: 13, tiny: 11 },
    borderWidth: 2, shadow: "0 2px 8px #0002",
    font: "'Nunito', 'Segoe UI', system-ui, sans-serif",
  },
  brutalist: {
    radius: 0, padding: 12, gap: 4,
    fontSize: { h1: 28, h2: 20, body: 14, small: 12, tiny: 10 },
    borderWidth: 3, shadow: "4px 4px 0 #000",
    font: "'Courier New', Courier, monospace",
  },
};

// Статусные цвета (одинаковы для обоих доменов)
export const STATUS_PALETTE = {
  draft: "muted", open: "success", closed: "warning", resolved: "accent", cancelled: "danger",
  confirmed: "accent", completed: "success", no_show: "warning",
  yes: "success", no: "danger", maybe: "warning",
  free: "success", held: "warning", booked: "accent", blocked: "muted",
};

/**
 * Хелпер для зависимости от зрителя.
 * Читает roles из онтологии домена.
 */
export function getViewerAccess(ontology, viewer) {
  const role = ontology?.roles?.[viewer];
  if (!role) return { canExecute: () => true, filterStatus: (s) => s, label: viewer };
  const canSet = new Set(role.canExecute || []);
  return {
    canExecute: (intentId) => canSet.has(intentId),
    filterStatus: (status) => role.statusMapping?.[status] || status,
    visibleFields: role.visibleFields || {},
    label: role.label || viewer,
  };
}

/**
 * Собрать стили для конкретной комбинации тема+вариант.
 */
export function getStyles(themeName = "light", variantName = "clean") {
  const t = THEMES[themeName] || THEMES.light;
  const v = VARIANTS[variantName] || VARIANTS.clean;

  const statusColor = (status) => {
    const key = STATUS_PALETTE[status];
    return key ? t[key] : t.muted;
  };

  const statusBg = (status) => {
    const key = STATUS_PALETTE[status];
    return key ? t[key + "Bg"] : t.mutedBg;
  };

  return {
    t, v, statusColor, statusBg,
    card: {
      background: t.surface, borderRadius: v.radius, padding: v.padding,
      border: `${v.borderWidth}px solid ${t.border}`, boxShadow: v.shadow,
      fontFamily: v.font,
    },
    heading: (level = "h2") => ({
      fontSize: v.fontSize[level], fontWeight: 700, color: t.text, fontFamily: v.font, margin: 0,
    }),
    text: (size = "body") => ({
      fontSize: v.fontSize[size], color: t.textSecondary, fontFamily: v.font,
    }),
    badge: (status) => ({
      fontSize: v.fontSize.tiny, fontWeight: 600, textTransform: "uppercase",
      color: statusColor(status), background: statusBg(status),
      padding: "2px 8px", borderRadius: v.radius / 2, display: "inline-block",
    }),
    button: (color = "accent") => ({
      padding: `${v.padding / 2}px ${v.padding}px`, borderRadius: v.radius / 2,
      border: "none", background: t[color], color: "#fff",
      fontSize: v.fontSize.small, fontFamily: v.font, cursor: "pointer", fontWeight: 600,
    }),
    buttonOutline: (color = "accent") => ({
      padding: `${v.padding / 2}px ${v.padding}px`, borderRadius: v.radius / 2,
      border: `${v.borderWidth}px solid ${t[color]}`, background: "transparent",
      color: t[color], fontSize: v.fontSize.small, fontFamily: v.font, cursor: "pointer",
    }),
    container: {
      background: t.bg, color: t.text, fontFamily: v.font,
    },
  };
}
