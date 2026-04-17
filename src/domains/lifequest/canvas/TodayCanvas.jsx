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

import { normDate, todayStr as TODAY, apple, appleCard, appleSectionHead } from "../utils.js";


const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const DAYS_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function fmtFullDate(d = new Date()) {
  return `${DAYS_RU[d.getDay()]}, ${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : h < 22 ? "Добрый вечер" : "Доброй ночи";
}

/** Парсинг строки "2026-04-17" в Date */
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MOTIVATION_DEFAULTS = [
  "Маленькие шаги ведут к большим переменам",
  "Сегодня — твой день. Сделай его легендарным",
  "Дисциплина — мост между целями и достижениями",
  "Каждая привычка строит твоё будущее",
  "Ты ближе, чем думаешь",
  "Прогресс важнее совершенства",
  "Один день — один шаг",
];

export default function TodayCanvas({ world, viewer, exec, ctx }) {
  // Дата из навигации (клик по дню в календаре) или сегодня
  const routeDate = ctx?.routeParams?.date;
  const today = routeDate || TODAY();
  const isToday = today === TODAY();
  const displayDate = parseDate(today);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [habitValueDrafts, setHabitValueDrafts] = useState({});
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState("");

  const { habits, todayTasks, todayLogs, spheres, user, activeQuote } = useMemo(() => {
    const allTasks = (world.tasks || []).filter(t => t.userId === viewer?.id);
    const allLogs = (world.habitLogs || []).filter(l => l.userId === viewer?.id);
    // Последняя цитата пользователя или дефолтная
    const userQuotes = (world.quotes || []).filter(q => q.userId === viewer?.id);
    const latestQuote = userQuotes.length > 0
      ? userQuotes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
      : null;
    return {
      habits: (world.habits || []).filter(h => h.userId === viewer?.id && (h.status === "active" || !h.status)),
      todayTasks: allTasks.filter(t => normDate(t.date) === today || t.date === today),
      todayLogs: allLogs.filter(l => normDate(l.date) === today || l.date === today),
      spheres: world.spheres || [],
      user: (world.users || []).find(u => u.id === viewer?.id),
      activeQuote: latestQuote,
    };
  }, [world, viewer, today]);

  const todayMotivation = activeQuote
    ? (activeQuote.author ? `${activeQuote.text} — ${activeQuote.author}` : activeQuote.text)
    : MOTIVATION_DEFAULTS[new Date().getDate() % MOTIVATION_DEFAULTS.length];

  const saveQuote = () => {
    const text = quoteDraft.trim();
    if (!text) return;
    exec("set_quote", { text, author: "" });
    setEditingQuote(false);
    setQuoteDraft("");
  };

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

  // Apple HIG tokens
  const ink = apple.text;
  const inkLight = apple.textSecondary;
  const accent = apple.accent;
  const warn = apple.warn;
  const gold = apple.warn;
  const border = apple.divider;
  const highlight = apple.fill;
  const font = apple.font;
  const success = apple.success;
  const sectionHead = appleSectionHead;
  const card = appleCard;

  // Handlers
  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    exec("create_task", { title, date: today, done: false, status: "active" });
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
    <div style={{ padding: 16, fontFamily: font, color: ink, paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ marginBottom: 16 }}>
        {!isToday && ctx?.back && (
          <button
            onClick={() => ctx.back()}
            style={{
              background: "none", border: "none", color: accent, cursor: "pointer",
              fontSize: 15, fontWeight: 400, padding: 0, marginBottom: 8,
              fontFamily: font, letterSpacing: "-0.24px",
            }}
          >‹ Назад к сегодня</button>
        )}
        <div style={{ fontSize: 13, color: inkLight, textTransform: "lowercase" }}>
          {fmtFullDate(displayDate)}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, marginBottom: 8 }}>
          {isToday
            ? <>{getGreeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</>
            : <>{displayDate.getDate()} {MONTHS_RU[displayDate.getMonth()]}</>
          }
        </div>
        {editingQuote ? (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              type="text"
              autoFocus
              placeholder="Моя строчка дня..."
              value={quoteDraft}
              onChange={e => setQuoteDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveQuote(); if (e.key === "Escape") setEditingQuote(false); }}
              style={{
                flex: 1, padding: "6px 10px", borderRadius: 8,
                border: `1.5px solid ${border}`, background: highlight,
                fontFamily: font, fontSize: 13, color: ink, outline: "none",
                fontStyle: "italic",
              }}
            />
            <button onClick={saveQuote} style={{
              padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${accent}`,
              background: accent, color: "white", fontFamily: font, fontSize: 12,
              fontWeight: 700, cursor: "pointer",
            }}>OK</button>
          </div>
        ) : (
          <div
            onClick={() => { setEditingQuote(true); setQuoteDraft(activeQuote?.text || ""); }}
            style={{ fontSize: 13, color: inkLight, fontStyle: "italic", cursor: "pointer" }}
            title="Нажмите, чтобы изменить строчку дня"
          >
            {todayMotivation}
          </div>
        )}
      </div>

      {/* Прогресс дня */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>📋 Сегодня</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: pct === 100 ? gold : accent, lineHeight: 1 }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 6, background: highlight, borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 3,
            background: pct === 100 ? success : accent,
            transition: "width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
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
        <h3 style={sectionHead}>🔄 Привычки дня</h3>
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
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", marginBottom: 4,
                        borderRadius: 10,
                        background: done ? "rgba(52, 199, 89, 0.06)" : "transparent",
                        border: `0.5px solid ${done ? "rgba(52,199,89,0.2)" : border}`,
                        transition: "all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                      }}>
                        <button
                          onClick={() => checkHabit(h)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            border: `2px solid ${done ? success : "var(--color-apple-text-tertiary, #aeaeb2)"}`,
                            background: done ? success : "transparent",
                            color: "white", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, fontFamily: font,
                            flexShrink: 0,
                            transition: "all 0.2s",
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
                              border: `1px solid ${border}`, background: "rgba(255,255,255,0.9)",
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
        <h3 style={sectionHead}>📝 Задачи дня</h3>
        {/* Quick add */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Новая задача..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTask(); }}
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 10,
              border: `0.5px solid ${border}`,
              background: "rgba(120, 120, 128, 0.08)",
              fontFamily: font, fontSize: 17, color: ink, outline: "none",
              letterSpacing: "-0.41px",
            }}
          />
          <button
            onClick={addTask}
            disabled={!newTaskTitle.trim()}
            style={{
              padding: "11px 18px", borderRadius: 10, border: "none",
              background: newTaskTitle.trim() ? accent : "rgba(120, 120, 128, 0.12)",
              color: newTaskTitle.trim() ? "white" : inkLight,
              fontFamily: font, fontSize: 17, fontWeight: 600,
              cursor: newTaskTitle.trim() ? "pointer" : "not-allowed",
              transition: "all 0.2s",
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
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", marginBottom: 4,
                borderRadius: 10,
                background: t.done ? "rgba(52,199,89,0.06)" : t.priority ? "rgba(255,149,0,0.06)" : "transparent",
                border: `0.5px solid ${t.done ? "rgba(52,199,89,0.2)" : border}`,
                transition: "all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}>
                <button
                  onClick={() => toggleTask(t)}
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${t.done ? success : "var(--color-apple-text-tertiary, #aeaeb2)"}`,
                    background: t.done ? success : "transparent",
                    color: "white", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, fontFamily: font,
                    flexShrink: 0,
                    transition: "all 0.2s",
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
          background: "rgba(52, 199, 89, 0.08)",
          textAlign: "center",
          border: "0.5px solid rgba(52, 199, 89, 0.2)",
        }}>
          <div style={{ fontSize: 32 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, letterSpacing: "0.38px" }}>
            Идеальный день!
          </div>
          <div style={{ fontSize: 15, color: inkLight, marginTop: 4, letterSpacing: "-0.24px" }}>
            Все задачи и привычки выполнены
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
