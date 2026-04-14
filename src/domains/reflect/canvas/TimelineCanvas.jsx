import React, { useMemo } from "react";
import { EMOTION_BY_ID, QUADRANT_COLORS } from "../emotions.js";

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDateRu(ts) {
  const today = startOfDay(Date.now());
  const dayStart = startOfDay(ts);
  const diffDays = Math.round((today - dayStart) / 86400000);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  const d = new Date(ts);
  const now = new Date();
  const withYear = d.getFullYear() !== now.getFullYear();
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const styles = {
  container: {
    fontFamily: "var(--font-apple, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif)",
    maxWidth: 640,
    margin: "0 auto",
    padding: 16,
    color: "var(--color-apple-text, #1d1d1f)",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--color-apple-text, #1d1d1f)",
    margin: "8px 0 20px",
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeading: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "var(--color-apple-text-secondary, #86868b)",
    margin: "0 0 10px 4px",
  },
  cardStack: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  card: {
    display: "flex",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: "var(--color-apple-glass-bg, rgba(255,255,255,0.62))",
    backdropFilter: "saturate(180%) blur(20px)",
    WebkitBackdropFilter: "saturate(180%) blur(20px)",
    border: "1px solid var(--color-apple-glass-border, rgba(255,255,255,0.35))",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)",
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  quadBar: {
    width: 4,
    borderRadius: 2,
    flexShrink: 0,
    alignSelf: "stretch",
  },
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 1,
  },
  emotionLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--color-apple-text, #1d1d1f)",
  },
  time: {
    fontSize: 13,
    color: "var(--color-apple-text-secondary, #86868b)",
  },
  activitiesRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  activityIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
  note: {
    fontStyle: "italic",
    color: "var(--color-apple-text-secondary, #86868b)",
    fontSize: 13,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    marginTop: 2,
  },
  empty: {
    textAlign: "center",
    padding: 40,
    fontSize: 15,
    color: "var(--color-apple-text-secondary, #86868b)",
    borderRadius: 14,
    background: "var(--color-apple-glass-bg, rgba(255,255,255,0.62))",
    backdropFilter: "saturate(180%) blur(20px)",
    WebkitBackdropFilter: "saturate(180%) blur(20px)",
    border: "1px solid var(--color-apple-glass-border, rgba(255,255,255,0.35))",
  },
  emptyEmoji: {
    fontSize: 40,
    display: "block",
    marginBottom: 12,
  },
};

export default function TimelineCanvas({ world, viewer, exec, ctx }) {
  const entries = useMemo(() => {
    const list = world?.moodEntries || [];
    return list
      .filter((e) => e.userId === viewer?.id)
      .sort((a, b) => b.loggedAt - a.loggedAt);
  }, [world?.moodEntries, viewer?.id]);

  const activitiesByEntry = useMemo(() => {
    const ea = world?.entryActivities || [];
    const activities = world?.activities || [];
    const actById = Object.fromEntries(activities.map((a) => [a.id, a]));
    const map = {};
    for (const link of ea) {
      const act = actById[link.activityId];
      if (!act) continue;
      if (!map[link.entryId]) map[link.entryId] = [];
      map[link.entryId].push(act);
    }
    return map;
  }, [world?.entryActivities, world?.activities]);

  const groups = useMemo(() => {
    const g = new Map();
    for (const e of entries) {
      const k = dayKey(e.loggedAt);
      if (!g.has(k)) g.set(k, { ts: e.loggedAt, items: [] });
      g.get(k).items.push(e);
    }
    return Array.from(g.entries());
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Дневник</h1>
        <div style={styles.empty}>
          <span style={styles.emptyEmoji}>📝</span>
          Пока нет записей. Добавь первый чек-ин →
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Дневник</h1>
      {groups.map(([key, group]) => (
        <div key={key} style={styles.dateGroup}>
          <div style={styles.dateHeading}>{formatDateRu(group.ts)}</div>
          <div style={styles.cardStack}>
            {group.items.map((e) => {
              const emotion = EMOTION_BY_ID[e.emotionId] || { emoji: "·", label: e.emotionId };
              const quadColor = QUADRANT_COLORS[e.quadrant] || "var(--color-apple-text-secondary, #86868b)";
              const acts = activitiesByEntry[e.id] || [];
              return (
                <div
                  key={e.id}
                  style={styles.card}
                  onClick={() => ctx?.navigate?.("entry_detail", { entryId: e.id })}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ ...styles.quadBar, background: quadColor }} />
                  <div style={styles.center}>
                    <div style={styles.topRow}>
                      <span style={styles.emoji}>{emotion.emoji}</span>
                      <span style={styles.emotionLabel}>{emotion.label}</span>
                    </div>
                    <div style={styles.time}>{formatTime(e.loggedAt)}</div>
                    {acts.length > 0 && (
                      <div style={styles.activitiesRow}>
                        {acts.map((a) => (
                          <span key={a.id} style={styles.activityIcon} title={a.label}>
                            {a.icon || "•"}
                          </span>
                        ))}
                      </div>
                    )}
                    {e.note && e.note !== "" && (
                      <div style={styles.note}>{e.note}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
