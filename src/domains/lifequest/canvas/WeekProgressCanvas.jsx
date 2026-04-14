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

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay() || 7; // Вс=0 → 7
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

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
  const weekLogs = habitLogs.filter(l => weekDays.includes(l.date));
  const weekTasks = tasks.filter(t => weekDays.includes(t.date));
  const weekTasksDone = weekTasks.filter(t => t.done).length;

  // Heatmap matrix [habit][day] = log
  const heatmap = habits.map(h => ({
    habit: h,
    days: weekDays.map(d => weekLogs.find(l => l.habitId === h.id && l.date === d)),
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

  // Стили (CSS variables)
  const ink = "var(--color-doodle-ink, #5c4033)";
  const inkLight = "var(--color-doodle-ink-light, #8b7355)";
  const accent = "var(--color-doodle-accent, #4a7c59)";
  const warn = "var(--color-doodle-warn, #d4764e)";
  const gold = "var(--color-doodle-gold, #d4a76a)";
  const border = "var(--color-doodle-border, #c4a77d)";
  const highlight = "var(--color-doodle-highlight, #fff3cd)";
  const bg = "var(--color-doodle-bg, #fdf6e3)";
  const font = "var(--font-doodle, system-ui)";
  const pad = "var(--spacing-doodle, 16px)";
  const radius = "var(--radius-doodle, 12px)";

  const wavyHead = {
    margin: 0, fontSize: 16, fontWeight: 700, color: ink,
    textDecoration: "underline", textDecorationStyle: "wavy",
    textDecorationColor: border, textUnderlineOffset: 4, marginBottom: 12,
  };
  const card = {
    padding: pad, borderRadius: radius,
    border: `2px dashed ${border}`, background: bg,
    boxShadow: `2px 2px 0 ${border}`,
    marginBottom: pad,
  };

  return (
    <div style={{ padding: pad, fontFamily: font, color: ink }}>
      <h2 style={{ ...wavyHead, fontSize: 22, marginBottom: 16 }}>
        📊 Прогресс недели
      </h2>

      {/* Большая цифра процента */}
      <div style={{ ...card, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: accent, lineHeight: 1 }}>
          {weekPct}%
        </div>
        <div style={{ fontSize: 14, color: inkLight, marginTop: 4 }}>
          {doneSlots} из {totalSlots} {totalSlots === 1 ? "пункт" : "пунктов"} выполнено
        </div>
        <div style={{ marginTop: 12, height: 14, background: highlight, borderRadius: 7, border: `1.5px solid ${border}`, overflow: "hidden" }}>
          <div style={{
            width: `${weekPct}%`, height: "100%", borderRadius: 6,
            background: `repeating-linear-gradient(45deg, ${accent}, ${accent} 4px, #5a8c69 4px, #5a8c69 8px)`,
          }} />
        </div>
      </div>

      {/* Статистика недели */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: pad }}>
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
          <h3 style={wavyHead}>Тепловая карта</h3>
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
          <h3 style={wavyHead}>🔥 Топ серии</h3>
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
          <h3 style={wavyHead}>🎯 Активные цели</h3>
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
          <h3 style={wavyHead}>🧭 По сферам жизни</h3>
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
          <h3 style={wavyHead}>📋 Задачи недели</h3>
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
