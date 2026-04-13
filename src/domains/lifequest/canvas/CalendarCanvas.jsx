import React, { useState, useMemo, useCallback } from "react";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // JS getDay(): 0=Sun, we need 0=Mon
  let startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells = [];

  // Previous month padding
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i;
    const m = month - 1;
    const y = m < 0 ? year - 1 : year;
    const realM = ((m % 12) + 12) % 12;
    cells.push({ day: d, dateStr: toDateStr(y, realM, d), current: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d), current: true });
  }

  // Next month padding
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nextM = month + 1;
    const nextY = nextM > 11 ? year + 1 : year;
    const realM = nextM % 12;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, dateStr: toDateStr(nextY, realM, d), current: false });
    }
  }

  return cells;
}

const styles = {
  container: {
    fontFamily: "var(--font-doodle, 'Caveat', 'Patrick Hand', cursive)",
    maxWidth: 700,
    margin: "0 auto",
    padding: 16,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  monthTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--color-doodle-text, #2d2d2d)",
    textAlign: "center",
    flex: 1,
  },
  navBtn: {
    background: "var(--color-doodle-bg-secondary, #f5f0e8)",
    border: "2px dashed var(--color-doodle-border, #bbb)",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 20,
    cursor: "pointer",
    fontFamily: "inherit",
    color: "var(--color-doodle-text, #2d2d2d)",
    transition: "background 0.15s",
  },
  dayNamesRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    marginBottom: 4,
  },
  dayName: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--color-doodle-muted, #888)",
    padding: "4px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
  },
  cell: {
    border: "1.5px dashed var(--color-doodle-border, #ccc)",
    borderRadius: 6,
    padding: 6,
    minHeight: 64,
    cursor: "pointer",
    background: "var(--color-doodle-bg, #fffef9)",
    transition: "background 0.12s, border-color 0.12s",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    position: "relative",
  },
  cellToday: {
    borderColor: "var(--color-doodle-accent, #e07b4c)",
    borderWidth: 2.5,
    borderStyle: "dashed",
    background: "var(--color-doodle-accent-bg, rgba(224,123,76,0.07))",
  },
  cellDimmed: {
    opacity: 0.35,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--color-doodle-text, #2d2d2d)",
    lineHeight: 1,
  },
  dotsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  dotDone: {
    background: "var(--color-doodle-success, #5cb85c)",
  },
  dotPartial: {
    background: "var(--color-doodle-warning, #f0ad4e)",
  },
  pct: {
    fontSize: 11,
    color: "var(--color-doodle-muted, #999)",
    marginTop: "auto",
    lineHeight: 1,
  },
};

const mobileMedia = "(max-width: 600px)";

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(mobileMedia).matches
  );
  React.useEffect(() => {
    const mql = window.matchMedia(mobileMedia);
    const handler = (e) => setMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export default function CalendarCanvas({ world, viewer, onDayClick, exec }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const isMobile = useIsMobile();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const todayStr = useMemo(() => {
    const n = new Date();
    return toDateStr(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Active habits for the viewer
  const activeHabits = useMemo(() => {
    const habits = world?.habits || [];
    return habits.filter(
      (h) => h.userId === viewer?.id && (h.status === "active" || !h.status)
    );
  }, [world?.habits, viewer?.id]);

  const totalActive = activeHabits.length;

  // HabitLog index by date
  const logsByDate = useMemo(() => {
    const logs = world?.habitLogs || [];
    const map = {};
    for (const log of logs) {
      if (log.userId !== viewer?.id) continue;
      const d = log.date;
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(log);
    }
    return map;
  }, [world?.habitLogs, viewer?.id]);

  // Tasks by date
  const tasksByDate = useMemo(() => {
    const tasks = world?.tasks || [];
    const map = {};
    for (const t of tasks) {
      if (t.userId !== viewer?.id) continue;
      const d = t.date;
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(t);
    }
    return map;
  }, [world?.tasks, viewer?.id]);

  // Per-day stats
  const dayStats = useCallback(
    (dateStr) => {
      const logs = logsByDate[dateStr] || [];
      const doneCount = logs.filter((l) => l.done).length;
      const partialCount = logs.filter(
        (l) => !l.done && l.value != null && l.value > 0
      ).length;
      const pct = totalActive > 0 ? Math.round((doneCount / totalActive) * 100) : 0;

      const tasks = tasksByDate[dateStr] || [];
      const tasksDone = tasks.filter((t) => t.done).length;

      return { doneCount, partialCount, pct, tasksDone, tasksTotal: tasks.length };
    },
    [logsByDate, tasksByDate, totalActive]
  );

  const prevMonth = () =>
    setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentMonth(new Date(year, month + 1, 1));

  const cellStyle = (isToday, isCurrent) => ({
    ...styles.cell,
    ...(isToday ? styles.cellToday : {}),
    ...(!isCurrent ? styles.cellDimmed : {}),
    ...(isMobile ? { minHeight: 48, padding: 4 } : {}),
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button
          style={styles.navBtn}
          onClick={prevMonth}
          aria-label="Предыдущий месяц"
        >
          &larr;
        </button>
        <div style={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          style={styles.navBtn}
          onClick={nextMonth}
          aria-label="Следующий месяц"
        >
          &rarr;
        </button>
      </div>

      {/* Day names */}
      <div style={styles.dayNamesRow}>
        {DAY_NAMES.map((name) => (
          <div key={name} style={styles.dayName}>
            {name}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {cells.map((cell) => {
          const isToday = cell.dateStr === todayStr;
          const stats = dayStats(cell.dateStr);

          return (
            <div
              key={cell.dateStr}
              style={cellStyle(isToday, cell.current)}
              onClick={() => onDayClick?.(cell.dateStr)}
              role="button"
              tabIndex={0}
              aria-label={`${cell.day} ${MONTH_NAMES[month]}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onDayClick?.(cell.dateStr);
              }}
            >
              <span style={{
                ...styles.dayNumber,
                ...(isMobile ? { fontSize: 13 } : {}),
              }}>
                {cell.day}
              </span>

              {/* Dots */}
              {(stats.doneCount > 0 || stats.partialCount > 0) && (
                <div style={styles.dotsRow}>
                  {Array.from({ length: stats.doneCount }).map((_, i) => (
                    <span key={`d${i}`} style={{ ...styles.dot, ...styles.dotDone }} />
                  ))}
                  {Array.from({ length: stats.partialCount }).map((_, i) => (
                    <span key={`p${i}`} style={{ ...styles.dot, ...styles.dotPartial }} />
                  ))}
                </div>
              )}

              {/* Percentage */}
              {cell.current && totalActive > 0 && stats.pct > 0 && (
                <span style={styles.pct}>{stats.pct}%</span>
              )}

              {/* Tasks indicator */}
              {stats.tasksTotal > 0 && (
                <span style={{
                  ...styles.pct,
                  fontSize: 10,
                  color: stats.tasksDone === stats.tasksTotal
                    ? "var(--color-doodle-success, #5cb85c)"
                    : "var(--color-doodle-muted, #999)",
                }}>
                  {stats.tasksDone}/{stats.tasksTotal}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
