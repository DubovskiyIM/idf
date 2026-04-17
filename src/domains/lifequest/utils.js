/**
 * Утилиты домена lifequest — shared между canvas-компонентами.
 */

/** Нормализация date: timestamp (число) → строку "YYYY-MM-DD" */
export function normDate(d) {
  if (!d) return null;
  if (typeof d === "number") {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  return d;
}

/** Сегодняшняя дата как строка "YYYY-MM-DD" */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Начало текущей недели (понедельник) */
export function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Псевдослучайный поворот для карточек по id */
export function seededRotation(id, range = 2) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return ((h % (range * 200)) / 100) - range;
}

/** Сокращение строки до maxLen символов */
export function abbreviate(name, maxLen = 9) {
  if (!name) return "";
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
}

/** Apple HIG design tokens — inline styles для canvas-компонентов */
export const apple = {
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
  textTertiary: "#aeaeb2",
  accent: "#007aff",
  success: "#34c759",
  warn: "#ff9500",
  danger: "#ff3b30",
  divider: "rgba(60, 60, 67, 0.12)",
  separator: "rgba(60, 60, 67, 0.06)",
  fill: "rgba(120, 120, 128, 0.06)",
  cardBg: "rgba(255, 255, 255, 0.8)",
  cardBorder: "0.5px solid rgba(60, 60, 67, 0.12)",
  cardShadow: "0 2px 16px rgba(0,0,0,0.06)",
  cardRadius: 12,
  blur: "blur(40px) saturate(180%)",
};

/** Стиль карточки Apple glass */
export const appleCard = {
  padding: 16,
  borderRadius: apple.cardRadius,
  border: apple.cardBorder,
  background: apple.cardBg,
  backdropFilter: apple.blur,
  WebkitBackdropFilter: apple.blur,
  boxShadow: apple.cardShadow,
  marginBottom: 16,
};

/** Стиль заголовка секции */
export const appleSectionHead = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: apple.text,
  letterSpacing: "0.38px",
  marginBottom: 12,
  fontFamily: apple.font,
};
