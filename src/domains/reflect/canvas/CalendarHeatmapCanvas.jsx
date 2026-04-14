import React, { useState, useMemo, useEffect } from "react";
import { QUADRANT_COLORS } from "../emotions.js";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Mon=0..Sun=6 */
function dayOfWeek(d) {
  return (d.getDay() + 6) % 7;
}

function sameDay(ts, date) {
  if (!ts) return false;
  const t = new Date(ts);
  return (
    t.getFullYear() === date.getFullYear() &&
    t.getMonth() === date.getMonth() &&
    t.getDate() === date.getDate()
  );
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Доминирующий квадрант из списка entries */
function dominantQuadrant(entries) {
  if (!entries || entries.length === 0) return null;
  const counts = {};
  for (const e of entries) {
    const q = e.quadrant;
    if (!q) continue;
    counts[q] = (counts[q] || 0) + 1;
  }
  let best = null;
  let bestN = 0;
  for (const q in counts) {
    if (counts[q] > bestN) {
      bestN = counts[q];
      best = q;
    }
  }
  return best;
}

function getMonthCells(current) {
  const year = current.getFullYear();
  const month = current.getMonth();
  const first = startOfMonth(current);
  const startDow = dayOfWeek(first);
  const nDays = daysInMonth(current);

  const cells = [];

  // prev month padding
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevLast - i);
    cells.push({ date: d, current: false });
  }

  for (let d = 1; d <= nDays; d++) {
    cells.push({ date: new Date(year, month, d), current: true });
  }

  // fill to complete weeks
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), current: false });
  }

  return cells;
}

const mobileMedia = "(max-width: 600px)";

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(mobileMedia).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(mobileMedia);
    const handler = (e) => setMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return mobile;
}

const styles = {
  wrapper: {
    fontFamily: "var(--font-apple, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif)",
    maxWidth: 760,
    margin: "0 auto",
    padding: 16,
  },
  glass: {
    background: "var(--color-apple-glass-bg, rgba(255,255,255,0.72))",
    backdropFilter: "blur(32px) saturate(180%)",
    WebkitBackdropFilter: "blur(32px) saturate(180%)",
    border: "1px solid var(--color-apple-glass-border, rgba(255,255,255,0.5))",
    borderRadius: 24,
    padding: 20,
    boxShadow:
      "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: -0.4,
    color: "var(--color-apple-text, #1c1c1e)",
    flex: 1,
    textAlign: "center",
    margin: 0,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--color-apple-border, rgba(0,0,0,0.08))",
    background: "var(--color-apple-surface, rgba(255,255,255,0.6))",
    cursor: "pointer",
    fontSize: 17,
    color: "var(--color-apple-text, #1c1c1e)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s, transform 0.15s",
    fontFamily: "inherit",
  },
  dayNamesRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    marginBottom: 8,
    padding: "0 2px",
  },
  dayName: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "var(--color-apple-text-secondary, rgba(60,60,67,0.6))",
    padding: "4px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
  },
  cell: {
    aspectRatio: "1 / 1",
    minHeight: 64,
    borderRadius: 14,
    padding: 6,
    background: "var(--color-apple-cell-bg, rgba(255,255,255,0.5))",
    border: "1px solid var(--color-apple-cell-border, rgba(0,0,0,0.05))",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    position: "relative",
    transition: "transform 0.18s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.18s",
    overflow: "hidden",
  },
  cellToday: {
    border: "2px solid var(--color-apple-accent, #007aff)",
  },
  cellDimmed: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-apple-text, #1c1c1e)",
    lineHeight: 1,
    letterSpacing: -0.2,
  },
  dayNumberToday: {
    fontWeight: 800,
    color: "var(--color-apple-accent, #007aff)",
  },
  dotsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
    marginTop: "auto",
    paddingTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: "50%",
    flexShrink: 0,
  },
};

export default function CalendarHeatmapCanvas({ world, viewer, exec, ctx }) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [hoverKey, setHoverKey] = useState(null);
  const isMobile = useIsMobile();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const today = useMemo(() => new Date(), []);

  const cells = useMemo(() => getMonthCells(currentMonth), [currentMonth]);

  const myEntries = useMemo(() => {
    const all = world?.moodEntries || [];
    return all.filter((e) => e.userId === viewer?.id);
  }, [world?.moodEntries, viewer?.id]);

  // Индекс entries по дате (YYYY-MM-DD)
  const entriesByDate = useMemo(() => {
    const map = {};
    for (const e of myEntries) {
      if (!e.loggedAt) continue;
      const key = toDateStr(new Date(e.loggedAt));
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [myEntries]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const handleCellClick = (date) => {
    const dateStr = toDateStr(date);
    if (ctx?.navigate) {
      ctx.navigate("timeline", { date: dateStr });
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.glass}>
        <div style={styles.header}>
          <button
            type="button"
            style={styles.navBtn}
            onClick={prevMonth}
            aria-label="Предыдущий месяц"
          >
            ←
          </button>
          <h2 style={styles.title}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            style={styles.navBtn}
            onClick={nextMonth}
            aria-label="Следующий месяц"
          >
            →
          </button>
        </div>

        <div style={styles.dayNamesRow}>
          {DAY_NAMES.map((name) => (
            <div key={name} style={styles.dayName}>
              {name}
            </div>
          ))}
        </div>

        <div style={styles.grid}>
          {cells.map((cell, idx) => {
            const key = toDateStr(cell.date) + "_" + idx;
            const dateStr = toDateStr(cell.date);
            const isToday = sameDay(today.getTime(), cell.date);
            const entries = entriesByDate[dateStr] || [];
            const count = entries.length;
            const quad = dominantQuadrant(entries);
            const quadColor = quad ? QUADRANT_COLORS[quad] : null;

            // Интенсивность: 0.2 * count, ограничено 0.7
            const intensity = Math.min(0.7, count * 0.2);
            const isHover = hoverKey === key;

            const cellStyle = {
              ...styles.cell,
              ...(isToday ? styles.cellToday : {}),
              ...(!cell.current ? styles.cellDimmed : {}),
              ...(isMobile ? { minHeight: 48, padding: 4, borderRadius: 10 } : {}),
              ...(quadColor && count > 0
                ? {
                    background: quadColor,
                    opacity: cell.current ? 0.35 + intensity * 0.6 : 0.2,
                  }
                : {}),
              ...(isHover
                ? {
                    transform: "scale(1.05)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    zIndex: 2,
                  }
                : {}),
            };

            // Ограничиваем количество точек до 5
            const dotCount = Math.min(count, 5);

            return (
              <div
                key={key}
                style={cellStyle}
                onClick={() => handleCellClick(cell.date)}
                onMouseEnter={() => setHoverKey(key)}
                onMouseLeave={() => setHoverKey(null)}
                role="button"
                tabIndex={0}
                aria-label={`${cell.date.getDate()} ${MONTH_NAMES[month]}${count ? `, записей: ${count}` : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCellClick(cell.date);
                  }
                }}
              >
                <span
                  style={{
                    ...styles.dayNumber,
                    ...(isToday ? styles.dayNumberToday : {}),
                    ...(isMobile ? { fontSize: 12 } : {}),
                  }}
                >
                  {cell.date.getDate()}
                </span>

                {dotCount > 0 && (
                  <div style={styles.dotsRow}>
                    {Array.from({ length: dotCount }).map((_, i) => {
                      const e = entries[i];
                      const q = e?.quadrant;
                      const color = q
                        ? QUADRANT_COLORS[q]
                        : "var(--color-apple-text-secondary, rgba(60,60,67,0.6))";
                      return (
                        <span
                          key={i}
                          style={{
                            ...styles.dot,
                            background: color,
                            boxShadow: "0 0 0 1px rgba(255,255,255,0.7)",
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
