/**
 * WeekProgressCanvas — аналитический дашборд за текущую неделю.
 * Агрегация по привычкам, целям, задачам пользователя:
 *   - Общий процент выполнения за неделю (большая цифра)
 *   - Heatmap привычек × дней (Пн-Вс)
 *   - Топ-3 streak'и
 *   - Прогресс активных целей
 *   - Выполненные задачи за неделю
 *   - XP заработанный за неделю
 */
import { useMemo } from "react";
import { normDate, startOfWeek, apple, appleCard, appleSectionHead } from "../utils.js";

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function WeekProgressCanvas({ world, viewer, exec }) {
  const { weekDays, habits, goals, tasks, habitLogs, spheres } = useMemo(() => {
    const monday = startOfWeek(new Date());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(fmtDate(d));
    }
    return {
      weekDays: days,
      habits: (world.habits || []).filter(h => h.userId === viewer?.id && h.status === "active"),
      goals: (world.goals || []).filter(g => g.userId === viewer?.id),
      tasks: (world.tasks || []).filter(t => t.userId === viewer?.id),
      habitLogs: (world.habitLogs || []).filter(l => l.userId === viewer?.id),
      spheres: world.spheres || [],
    };
  }, [world, viewer]);

  // Logs за текущую неделю
  const weekLogs = habitLogs.filter(l => weekDays.includes(normDate(l.date)));
  const weekTasks = tasks.filter(t => weekDays.includes(normDate(t.date)));
  const weekTasksDone = weekTasks.filter(t => t.done).length;

  // Heatmap matrix [habit][day] = log
  const heatmap = habits.map(h => ({
    habit: h,
    days: weekDays.map(d => weekLogs.find(l => l.habitId === h.id && normDate(l.date) === d)),
  }));

  // Общий процент: возможные слоты = habits × 7 + tasks. Done = выполненные.
  const totalSlots = habits.length * 7 + weekTasks.length;
  const doneSlots = weekLogs.filter(l => l.done).length + weekTasksDone;
  const weekPct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

  // XP за неделю
  const weekXp = weekLogs.reduce((s, l) => s + (l.xpEarned || 0), 0)
    + weekTasksDone * 5
    + goals.filter(g => g.status === "completed").length * 50; // простая оценка

  // Топ streak'и
  const topStreaks = [...habits]
    .sort((a, b) => (b.streakCurrent || 0) - (a.streakCurrent || 0))
    .slice(0, 3);

  // Активные цели по прогрессу
  const activeGoals = goals
    .filter(g => g.status === "active")
    .sort((a, b) => (b.progress || 0) - (a.progress || 0));

  // Распределение по сферам
  const spheresMap = Object.fromEntries(spheres.map(s => [s.id, s]));
  const habitsBySphere = {};
  habits.forEach(h => {
    if (!habitsBySphere[h.sphereId]) habitsBySphere[h.sphereId] = 0;
    habitsBySphere[h.sphereId]++;
  });
  goals.forEach(g => {
    if (!habitsBySphere[g.sphereId]) habitsBySphere[g.sphereId] = 0;
    habitsBySphere[g.sphereId]++;
  });

  // Apple HIG tokens
  const ink = apple.text;
  const inkLight = apple.textSecondary;
  const accent = apple.accent;
  const warn = apple.warn;
  const gold = apple.warn;
  const border = apple.divider;
  const highlight = apple.fill;
  const success = apple.success;
  const font = apple.font;
  const sectionHead = { ...appleSectionHead, fontSize: 17, letterSpacing: "-0.41px" };
  const card = appleCard;

  return (
    <div style={{ padding: 16, fontFamily: font, color: ink }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.35px", margin: 0, marginBottom: 16, color: ink }}>
        Прогресс недели
      </h2>

      {/* Большая цифра процента */}
      <div style={{ ...card, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: accent, lineHeight: 1, fontFamily: "var(--font-apple-rounded, system-ui)" }}>
          {weekPct}%
        </div>
        <div style={{ fontSize: 15, color: inkLight, marginTop: 8, letterSpacing: "-0.24px" }}>
          {doneSlots} из {totalSlots} выполнено
        </div>
        <div style={{ marginTop: 12, height: 6, background: highlight, borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${weekPct}%`, height: "100%", borderRadius: 3,
            background: weekPct === 100 ? success : accent,
            transition: "width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }} />
        </div>
      </div>

      {/* Статистика недели */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: gold }}>{weekXp}</div>
          <div style={{ fontSize: 11, color: inkLight }}>✨ XP за неделю</div>
        </div>
        <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: warn }}>🔥 {topStreaks[0]?.streakCurrent || 0}</div>
          <div style={{ fontSize: 11, color: inkLight }}>лучшая серия</div>
        </div>
        <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: ink }}>{habits.length}</div>
          <div style={{ fontSize: 11, color: inkLight }}>привычек</div>
        </div>
        <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: ink }}>{activeGoals.length}</div>
          <div style={{ fontSize: 11, color: inkLight }}>активных целей</div>
        </div>
      </div>

      {/* Heatmap привычек × дней */}
      {habits.length > 0 && (
        <div style={card}>
          <h3 style={sectionHead}>Тепловая карта</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: 4, textAlign: "left", color: inkLight, fontWeight: 400 }}></th>
                  {DAY_LABELS.map((d, i) => {
                    const isToday = weekDays[i] === fmtDate(new Date());
                    return (
                      <th key={d} style={{
                        padding: 4, color: isToday ? accent : inkLight,
                        fontWeight: isToday ? 700 : 400, textAlign: "center", minWidth: 28,
                      }}>{d}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {heatmap.map(({ habit, days }) => (
                  <tr key={habit.id}>
                    <td style={{ padding: "4px 8px 4px 0", color: ink, whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {habit.title}
                    </td>
                    {days.map((log, i) => {
                      const isToday = weekDays[i] === fmtDate(new Date());
                      const done = log?.done;
                      const partial = log && !log.done && log.value > 0;
                      return (
                        <td key={i} style={{ padding: 2, textAlign: "center" }}>
                          <div style={{
                            width: 22, height: 22, margin: "0 auto",
                            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: "white",
                            background: done ? accent : partial ? gold : "transparent",
                            border: !log ? `1.5px dashed ${isToday ? warn : border}` : "none",
                          }}>
                            {done ? "✓" : partial ? "~" : ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Топ streak'и */}
      {topStreaks.length > 0 && topStreaks[0].streakCurrent > 0 && (
        <div style={card}>
          <h3 style={sectionHead}>🔥 Топ серии</h3>
          {topStreaks.map(h => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px dotted ${border}` }}>
              <span style={{ flex: 1 }}>{h.title}</span>
              <span style={{ fontWeight: 700, color: warn }}>🔥 {h.streakCurrent}</span>
              <span style={{ fontSize: 11, color: inkLight }}>лучше: {h.streakBest}</span>
            </div>
          ))}
        </div>
      )}

      {/* Прогресс целей */}
      {activeGoals.length > 0 && (
        <div style={card}>
          <h3 style={sectionHead}>🎯 Активные цели</h3>
          {activeGoals.slice(0, 5).map(g => {
            const sphere = spheresMap[g.sphereId];
            return (
              <div key={g.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {sphere && <span>{sphere.icon}</span>}
                  <span style={{ flex: 1 }}>{g.title}</span>
                  <span style={{ fontSize: 12, color: inkLight }}>{g.progress || 0}%</span>
                </div>
                <div style={{ height: 8, background: highlight, borderRadius: 4, border: `1px solid ${border}`, overflow: "hidden" }}>
                  <div style={{ width: `${g.progress || 0}%`, height: "100%", background: accent }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Распределение по сферам */}
      {Object.keys(habitsBySphere).length > 0 && (
        <div style={card}>
          <h3 style={sectionHead}>🧭 По сферам жизни</h3>
          {Object.entries(habitsBySphere)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([sphereId, count]) => {
              const sphere = spheresMap[sphereId];
              if (!sphere) return null;
              const max = Math.max(...Object.values(habitsBySphere));
              const pct = Math.round((count / max) * 100);
              return (
                <div key={sphereId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 16 }}>{sphere.icon}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{sphere.name}</span>
                  <div style={{ width: 100, height: 8, background: highlight, borderRadius: 4, border: `1px solid ${border}`, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: sphere.color || accent }} />
                  </div>
                  <span style={{ fontSize: 12, color: inkLight, minWidth: 20, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Задачи недели */}
      {weekTasks.length > 0 && (
        <div style={card}>
          <h3 style={sectionHead}>📋 Задачи недели</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: inkLight }}>
              {weekTasksDone} из {weekTasks.length}
            </span>
            <span style={{ fontWeight: 700, color: accent }}>
              {Math.round((weekTasksDone / weekTasks.length) * 100)}%
            </span>
          </div>
          <div style={{ marginTop: 8, height: 8, background: highlight, borderRadius: 4, border: `1px solid ${border}`, overflow: "hidden" }}>
            <div style={{ width: `${(weekTasksDone / weekTasks.length) * 100}%`, height: "100%", background: accent }} />
          </div>
        </div>
      )}
    </div>
  );
}
