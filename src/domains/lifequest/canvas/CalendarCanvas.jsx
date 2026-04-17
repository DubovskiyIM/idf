import React, { useState, useMemo, useCallback } from "react";
import { normDate, apple } from "../utils.js";

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
  let startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const cells = [];

  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i;
    const m = month - 1;
    const y = m < 0 ? year - 1 : year;
    const realM = ((m % 12) + 12) % 12;
    cells.push({ day: d, dateStr: toDateStr(y, realM, d), current: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d), current: true });
  }

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

const font = apple.font;

export default function CalendarCanvas({ world, viewer, onDayClick, exec }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedHabitId, setSelectedHabitId] = useState(null); // null = все
  const [showGoals, setShowGoals] = useState(true);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const todayStr = useMemo(() => {
    const n = new Date();
    return toDateStr(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Active habits
  const activeHabits = useMemo(() => {
    return (world?.habits || []).filter(
      (h) => h.userId === viewer?.id && (h.status === "active" || !h.status)
    );
  }, [world?.habits, viewer?.id]);

  // Spheres map
  const spheresMap = useMemo(() => {
    const m = {};
    for (const s of (world?.spheres || [])) m[s.id] = s;
    return m;
  }, [world?.spheres]);

  // HabitLog index by date (учитываем что date может быть timestamp или строка)
  const logsByDate = useMemo(() => {
    const logs = world?.habitLogs || [];
    const map = {};
    for (const log of logs) {
      if (log.userId !== viewer?.id) continue;
      let d = log.date;
      if (!d) continue;
      // Нормализация: timestamp → dateStr
      if (typeof d === "number") {
        const dt = new Date(d);
        d = toDateStr(dt.getFullYear(), dt.getMonth(), dt.getDate());
      }
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

  // Goals for progress calculation
  const activeGoals = useMemo(() => {
    return (world?.goals || []).filter(
      g => g.userId === viewer?.id && g.status === "active"
    );
  }, [world?.goals, viewer?.id]);

  // Per-day stats
  const dayStats = useCallback(
    (dateStr) => {
      const logs = logsByDate[dateStr] || [];

      // Фильтр по выбранной привычке
      const filteredLogs = selectedHabitId
        ? logs.filter(l => l.habitId === selectedHabitId)
        : logs;

      const relevantHabits = selectedHabitId
        ? activeHabits.filter(h => h.id === selectedHabitId)
        : activeHabits;

      const doneCount = filteredLogs.filter(l => l.done).length;
      const totalHabits = relevantHabits.length;
      const habitPct = totalHabits > 0 ? Math.round((doneCount / totalHabits) * 100) : 0;

      // Задачи
      const tasks = tasksByDate[dateStr] || [];
      const tasksDone = tasks.filter(t => t.done).length;

      // Общий процент (привычки + задачи)
      const totalItems = totalHabits + tasks.length;
      const totalDone = doneCount + tasksDone;
      const totalPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

      return { doneCount, totalHabits, habitPct, tasksDone, tasksTotal: tasks.length, totalPct };
    },
    [logsByDate, tasksByDate, activeHabits, selectedHabitId]
  );

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // Цвет для процента
  const pctColor = (pct) => {
    if (pct === 0) return "transparent";
    if (pct === 100) return "rgba(52, 199, 89, 0.15)";
    if (pct >= 50) return "rgba(52, 199, 89, 0.08)";
    return "rgba(255, 149, 0, 0.08)";
  };

  return (
    <div style={{
      fontFamily: font,
      maxWidth: 700,
      margin: "0 auto",
      padding: 16,
      color: "var(--color-apple-text, #1c1c1e)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <button onClick={prevMonth} style={navBtnStyle}>&larr;</button>
        <div style={{
          fontSize: 22, fontWeight: 700, fontFamily: font,
          letterSpacing: "0.35px", textAlign: "center", flex: 1,
        }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button onClick={nextMonth} style={navBtnStyle}>&rarr;</button>
      </div>

      {/* Фильтр привычек */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12,
        padding: "8px 0",
      }}>
        <FilterChip
          label="Все привычки"
          active={selectedHabitId === null}
          onClick={() => setSelectedHabitId(null)}
        />
        {activeHabits.map(h => {
          const sphere = spheresMap[h.sphereId];
          return (
            <FilterChip
              key={h.id}
              label={h.title}
              icon={sphere?.icon}
              color={sphere?.color}
              active={selectedHabitId === h.id}
              onClick={() => setSelectedHabitId(selectedHabitId === h.id ? null : h.id)}
            />
          );
        })}
        <FilterChip
          label="Цели"
          icon="🎯"
          active={showGoals}
          onClick={() => setShowGoals(!showGoals)}
        />
      </div>

      {/* Day names */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2, marginBottom: 4,
      }}>
        {DAY_NAMES.map(name => (
          <div key={name} style={{
            textAlign: "center", fontSize: 13, fontWeight: 600,
            color: "var(--color-apple-text-secondary, #8e8e93)",
            padding: "6px 0", fontFamily: font,
            letterSpacing: "-0.08px",
          }}>
            {name}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
      }}>
        {cells.map(cell => {
          const isToday = cell.dateStr === todayStr;
          const stats = dayStats(cell.dateStr);
          const hasSomething = stats.doneCount > 0 || stats.tasksTotal > 0;

          return (
            <div
              key={cell.dateStr}
              onClick={() => onDayClick?.(cell.dateStr)}
              style={{
                borderRadius: 10,
                padding: 6,
                minHeight: 56,
                cursor: "pointer",
                background: isToday
                  ? "rgba(0, 122, 255, 0.08)"
                  : hasSomething ? pctColor(stats.totalPct) : "transparent",
                border: isToday
                  ? "2px solid var(--color-apple-accent, #007aff)"
                  : "1px solid var(--color-apple-separator, rgba(60,60,67,0.06))",
                opacity: cell.current ? 1 : 0.3,
                display: "flex", flexDirection: "column",
                alignItems: "flex-start", gap: 2,
                transition: "background 0.15s",
                fontFamily: font,
              }}
            >
              <span style={{
                fontSize: 15, fontWeight: isToday ? 700 : 400,
                color: isToday ? "var(--color-apple-accent, #007aff)" : "var(--color-apple-text, #1c1c1e)",
                letterSpacing: "-0.24px",
              }}>
                {cell.day}
              </span>

              {/* Habit dots */}
              {stats.doneCount > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  {Array.from({ length: Math.min(stats.doneCount, 6) }).map((_, i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: selectedHabitId
                        ? (spheresMap[activeHabits.find(h => h.id === selectedHabitId)?.sphereId]?.color || "var(--color-apple-success, #34c759)")
                        : "var(--color-apple-success, #34c759)",
                    }} />
                  ))}
                </div>
              )}

              {/* Процент выполнения */}
              {cell.current && stats.totalPct > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, marginTop: "auto",
                  color: stats.totalPct === 100
                    ? "var(--color-apple-success, #34c759)"
                    : "var(--color-apple-text-secondary, #8e8e93)",
                  letterSpacing: "0",
                }}>
                  {stats.totalPct}%
                </span>
              )}

              {/* Tasks indicator */}
              {showGoals && stats.tasksTotal > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 500,
                  color: stats.tasksDone === stats.tasksTotal
                    ? "var(--color-apple-success, #34c759)"
                    : "var(--color-apple-text-tertiary, #aeaeb2)",
                }}>
                  {stats.tasksDone}/{stats.tasksTotal}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Легенда */}
      <div style={{
        display: "flex", gap: 16, marginTop: 12, padding: "8px 0",
        fontSize: 12, color: "var(--color-apple-text-secondary, #8e8e93)",
        fontFamily: font,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-apple-success, #34c759)" }} />
          Привычка выполнена
        </span>
        {showGoals && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10 }}>✓/n</span>
            Задачи
          </span>
        )}
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: "rgba(120, 120, 128, 0.08)",
  border: "none",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 18,
  cursor: "pointer",
  fontFamily: "var(--font-apple, system-ui)",
  color: "var(--color-apple-accent, #007aff)",
  fontWeight: 600,
  transition: "background 0.15s",
};

function FilterChip({ label, icon, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "6px 12px",
        borderRadius: 20,
        border: active ? "1.5px solid var(--color-apple-accent, #007aff)" : "1px solid var(--color-apple-divider, rgba(60,60,67,0.12))",
        background: active ? "rgba(0, 122, 255, 0.08)" : "rgba(120, 120, 128, 0.06)",
        color: active ? "var(--color-apple-accent, #007aff)" : "var(--color-apple-text, #1c1c1e)",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        fontFamily: "var(--font-apple, system-ui)",
        cursor: "pointer",
        letterSpacing: "-0.08px",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      {color && !icon && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
      {label}
    </button>
  );
}
