/**
 * TodayCanvas — полноценный планировщик дня с doodle-стилистикой.
 * UX-паттерны:
 *   - Hero: дата + большой % выполнения + мотивирующая фраза
 *   - Quick-add задач (Enter → создать)
 *   - Чек-листы привычек с anim переключением, streak-бейджами
 *   - Чек-листы задач с inline-удалением, приоритет (★)
 *   - Группировка привычек по сферам с цветовыми маркерами
 *   - Empty state с CTA "Добавить первую задачу/привычку"
 *   - Bottom: XP за сегодня + следующий бейдж
 */
import { useState, useMemo } from "react";

const TODAY = () => new Date().toISOString().slice(0, 10);

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const DAYS_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function fmtFullDate(d = new Date()) {
  return `${DAYS_RU[d.getDay()]}, ${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

const HOUR = new Date().getHours();
const GREETINGS = HOUR < 12 ? "Доброе утро" : HOUR < 18 ? "Добрый день" : HOUR < 22 ? "Добрый вечер" : "Доброй ночи";

const MOTIVATION = [
  "Маленькие шаги ведут к большим переменам ✨",
  "Сегодня — твой день. Сделай его легендарным 🚀",
  "Дисциплина — мост между целями и достижениями 🌉",
  "Каждая привычка строит твоё будущее 🏗",
  "Ты ближе, чем думаешь 🎯",
  "Прогресс важнее совершенства 📈",
  "Один день — один шаг 👣",
];
const todayMotivation = MOTIVATION[new Date().getDate() % MOTIVATION.length];

export default function TodayCanvas({ world, viewer, exec, ctx }) {
  const today = TODAY();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [habitValueDrafts, setHabitValueDrafts] = useState({});

  const { habits, todayTasks, todayLogs, spheres, user } = useMemo(() => {
    const allTasks = (world.tasks || []).filter(t => t.userId === viewer?.id);
    const allLogs = (world.habitLogs || []).filter(l => l.userId === viewer?.id);
    return {
      habits: (world.habits || []).filter(h => h.userId === viewer?.id && h.status === "active"),
      todayTasks: allTasks.filter(t => t.date === today),
      todayLogs: allLogs.filter(l => l.date === today),
      spheres: world.spheres || [],
      user: (world.users || []).find(u => u.id === viewer?.id),
    };
  }, [world, viewer, today]);

  const spheresMap = Object.fromEntries(spheres.map(s => [s.id, s]));

  // Прогресс
  const totalSlots = habits.length + todayTasks.length;
  const habitsDone = todayLogs.filter(l => l.done || l.value > 0).length;
  const tasksDone = todayTasks.filter(t => t.done).length;
  const doneSlots = habitsDone + tasksDone;
  const pct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

  // XP за сегодня
  const xpToday = todayLogs.reduce((s, l) => s + (l.xpEarned || 0), 0) + tasksDone * 5;

  // Группировка привычек по сферам
  const habitsBySphere = {};
  habits.forEach(h => {
    if (!habitsBySphere[h.sphereId]) habitsBySphere[h.sphereId] = [];
    habitsBySphere[h.sphereId].push(h);
  });
  const sphereOrder = spheres.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // Стили
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

  // Handlers
  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    exec("create_task", { title, date: today });
    setNewTaskTitle("");
  };

  const checkHabit = (habit) => {
    const log = todayLogs.find(l => l.habitId === habit.id);
    if (log && (log.done || log.value > 0)) {
      // Уже выполнена — снять
      exec("uncheck_habit", { habitId: habit.id, id: log.id });
    } else if (habit.type === "binary") {
      exec("check_habit", { habitId: habit.id });
    } else {
      // Quantitative — нужно значение
      const value = Number(habitValueDrafts[habit.id] || habit.targetValue || 1);
      if (value > 0) {
        exec("log_habit_value", { habitId: habit.id, value });
        setHabitValueDrafts(p => ({ ...p, [habit.id]: "" }));
      }
    }
  };

  const toggleTask = (task) => {
    if (task.done) {
      exec("uncomplete_task", { id: task.id });
    } else {
      exec("complete_task", { id: task.id });
    }
  };

  const togglePriority = (task) => {
    exec("toggle_task_priority", { id: task.id, priority: !task.priority });
  };

  const deleteTask = (task) => {
    if (window.confirm(`Удалить «${task.title}»?`)) {
      exec("delete_task", { id: task.id });
    }
  };

  // Сортировка задач: приоритетные сверху, затем не выполненные, потом выполненные
  const sortedTasks = [...todayTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  return (
    <div style={{ padding: pad, fontFamily: font, color: ink, paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ marginBottom: pad }}>
        <div style={{ fontSize: 13, color: inkLight, textTransform: "lowercase" }}>
          {fmtFullDate()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, marginBottom: 8 }}>
          {GREETINGS}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </div>
        <div style={{ fontSize: 13, color: inkLight, fontStyle: "italic" }}>
          {todayMotivation}
        </div>
      </div>

      {/* Прогресс дня */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>📋 Сегодня</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: pct === 100 ? gold : accent, lineHeight: 1 }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 12, background: highlight, borderRadius: 6, border: `1.5px solid ${border}`, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 5,
            background: pct === 100
              ? `repeating-linear-gradient(45deg, ${gold}, ${gold} 4px, #c49960 4px, #c49960 8px)`
              : `repeating-linear-gradient(45deg, ${accent}, ${accent} 4px, #5a8c69 4px, #5a8c69 8px)`,
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 14, fontSize: 12, color: inkLight }}>
          <span>✓ {habitsDone}/{habits.length} привычек</span>
          <span>✓ {tasksDone}/{todayTasks.length} задач</span>
          <span style={{ marginLeft: "auto", color: gold, fontWeight: 700 }}>+{xpToday} XP ✨</span>
        </div>
      </div>

      {/* Привычки дня */}
      <div style={card}>
        <h3 style={wavyHead}>🔄 Привычки дня</h3>
        {habits.length === 0 ? (
          <EmptyState
            text="Нет активных привычек"
            cta="Создать привычку"
            onCta={() => ctx?.navigate?.("habit_list")}
            inkLight={inkLight} accent={accent} font={font}
          />
        ) : (
          <div>
            {sphereOrder.map(sphere => {
              const sphereHabits = habitsBySphere[sphere.id];
              if (!sphereHabits?.length) return null;
              return (
                <div key={sphere.id} style={{ marginBottom: 8 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, color: inkLight, marginBottom: 4,
                    paddingLeft: 4, textTransform: "uppercase", letterSpacing: 1,
                  }}>
                    <span>{sphere.icon}</span>
                    <span>{sphere.name}</span>
                  </div>
                  {sphereHabits.map(h => {
                    const log = todayLogs.find(l => l.habitId === h.id);
                    const done = log && (log.done || log.value > 0);
                    const isQuant = h.type === "quantitative";
                    return (
                      <div key={h.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", marginBottom: 4,
                        borderRadius: 8,
                        background: done ? `${accent}15` : "transparent",
                        border: `1.5px ${done ? "solid" : "dashed"} ${done ? accent : border}`,
                        borderLeft: `4px solid ${sphere.color || border}`,
                        transition: "all 0.2s",
                      }}>
                        <button
                          onClick={() => checkHabit(h)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            border: `2px solid ${done ? accent : border}`,
                            background: done ? accent : "transparent",
                            color: "white", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 700, fontFamily: font,
                            flexShrink: 0,
                          }}
                        >
                          {done ? "✓" : ""}
                        </button>
                        <span style={{
                          flex: 1, fontSize: 14,
                          color: done ? inkLight : ink,
                          textDecoration: done ? "line-through" : "none",
                        }}>
                          {h.title}
                        </span>
                        {isQuant && !done && (
                          <input
                            type="number"
                            placeholder={String(h.targetValue || 1)}
                            value={habitValueDrafts[h.id] || ""}
                            onChange={e => setHabitValueDrafts(p => ({ ...p, [h.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") checkHabit(h); }}
                            style={{
                              width: 54, padding: "4px 6px", borderRadius: 6,
                              border: `1px dashed ${border}`, background: bg,
                              fontFamily: font, fontSize: 13, color: ink,
                              outline: "none", textAlign: "center",
                            }}
                          />
                        )}
                        {isQuant && done && (
                          <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>
                            {log.value} {h.unit || ""}
                          </span>
                        )}
                        {h.streakCurrent > 0 && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 2,
                            padding: "2px 6px", borderRadius: 10,
                            background: highlight, fontSize: 11, color: warn,
                            border: `1px solid ${border}`, fontWeight: 700,
                          }}>
                            🔥 {h.streakCurrent}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Задачи дня */}
      <div style={card}>
        <h3 style={wavyHead}>📝 Задачи дня</h3>
        {/* Quick add */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Новая задача..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTask(); }}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: `2px dashed ${border}`, background: highlight,
              fontFamily: font, fontSize: 14, color: ink, outline: "none",
            }}
          />
          <button
            onClick={addTask}
            disabled={!newTaskTitle.trim()}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: `2px solid ${accent}`,
              background: newTaskTitle.trim() ? accent : "transparent",
              color: newTaskTitle.trim() ? "white" : inkLight,
              fontFamily: font, fontSize: 14, fontWeight: 700,
              cursor: newTaskTitle.trim() ? "pointer" : "not-allowed",
            }}
          >
            +
          </button>
        </div>

        {todayTasks.length === 0 ? (
          <EmptyState
            text="Задач на сегодня пока нет"
            cta="Добавьте задачу выше ↑"
            inkLight={inkLight} accent={accent} font={font}
          />
        ) : (
          <div>
            {sortedTasks.map(t => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", marginBottom: 4,
                borderRadius: 8,
                background: t.done ? `${accent}15` : t.priority ? `${gold}15` : "transparent",
                border: `1.5px ${t.done ? "solid" : "dashed"} ${t.done ? accent : t.priority ? gold : border}`,
                transition: "all 0.2s",
              }}>
                <button
                  onClick={() => toggleTask(t)}
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${t.done ? accent : border}`,
                    background: t.done ? accent : "transparent",
                    color: "white", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, fontFamily: font,
                    flexShrink: 0,
                  }}
                >
                  {t.done ? "✓" : ""}
                </button>
                <span style={{
                  flex: 1, fontSize: 14,
                  color: t.done ? inkLight : ink,
                  textDecoration: t.done ? "line-through" : "none",
                }}>
                  {t.title}
                </span>
                <button
                  onClick={() => togglePriority(t)}
                  title={t.priority ? "Снять приоритет" : "Установить приоритет"}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 16, padding: 4, color: t.priority ? gold : inkLight,
                  }}
                >
                  {t.priority ? "★" : "☆"}
                </button>
                <button
                  onClick={() => deleteTask(t)}
                  title="Удалить"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 14, padding: 4, color: inkLight,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Финиш-баннер при 100% */}
      {pct === 100 && totalSlots > 0 && (
        <div style={{
          ...card,
          background: `linear-gradient(135deg, ${gold}30, ${accent}30)`,
          textAlign: "center",
          border: `2px solid ${gold}`,
        }}>
          <div style={{ fontSize: 32 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            Идеальный день!
          </div>
          <div style={{ fontSize: 12, color: inkLight, marginTop: 4 }}>
            Все задачи и привычки выполнены — ты молодец!
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, cta, onCta, inkLight, accent, font }) {
  return (
    <div style={{ padding: 16, textAlign: "center", color: inkLight, fontSize: 13, fontFamily: font }}>
      <div style={{ fontSize: 28, opacity: 0.5, marginBottom: 6 }}>📭</div>
      <div>{text}</div>
      {cta && (
        onCta ? (
          <button
            onClick={onCta}
            style={{
              marginTop: 10, padding: "6px 14px", borderRadius: 8,
              border: `2px dashed ${accent}`, background: "transparent",
              color: accent, fontFamily: font, cursor: "pointer", fontSize: 12, fontWeight: 700,
            }}
          >
            {cta}
          </button>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: accent }}>{cta}</div>
        )
      )}
    </div>
  );
}
