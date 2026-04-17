/**
 * PointACanvas — Колесо жизни с RadarChart + inline-оценка сфер.
 * Клик на сферу → inline-slider 1-10 → exec("assess_sphere").
 * Сравнение нескольких точек во времени.
 */
import { useState, useMemo } from "react";
import RadarChart from "./RadarChart.jsx";
import { apple } from "../utils.js";

const font = apple.font;

export default function PointACanvas({ world, viewer, exec }) {
  const spheres = (world.spheres || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const allAssessments = (world.sphereAssessments || []).filter(a => a.userId === viewer?.id);
  const [editing, setEditing] = useState(null);
  const [score, setScore] = useState(5);
  const [desc, setDesc] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareDate, setCompareDate] = useState(null);

  // Группировка оценок по дате (для сравнения)
  const assessmentsByDate = useMemo(() => {
    const groups = {};
    for (const a of allAssessments) {
      const date = a.assessedAt
        ? new Date(a.assessedAt).toISOString().slice(0, 10)
        : a.createdAt
          ? new Date(a.createdAt).toISOString().slice(0, 10)
          : "no-date";
      if (!groups[date]) groups[date] = [];
      groups[date].push(a);
    }
    return groups;
  }, [allAssessments]);

  const availableDates = useMemo(() =>
    Object.keys(assessmentsByDate).sort().reverse(),
    [assessmentsByDate]
  );

  // Последняя оценка каждой сферы (текущая точка)
  const currentAssessments = useMemo(() => {
    const latest = {};
    for (const a of allAssessments) {
      const existing = latest[a.sphereId];
      if (!existing || (a.createdAt || 0) > (existing.createdAt || 0)) {
        latest[a.sphereId] = a;
      }
    }
    return Object.values(latest);
  }, [allAssessments]);

  // Оценки для сравнения
  const compareAssessments = useMemo(() => {
    if (!compareDate || !assessmentsByDate[compareDate]) return null;
    return assessmentsByDate[compareDate];
  }, [compareDate, assessmentsByDate]);

  const handleSave = (sphereId) => {
    exec("assess_sphere", {
      sphereId,
      score,
      description: desc,
      assessedAt: Date.now(),
    });
    setEditing(null);
    setScore(5);
    setDesc("");
  };

  // Средняя оценка
  const avgScore = useMemo(() => {
    if (currentAssessments.length === 0) return 0;
    const sum = currentAssessments.reduce((s, a) => s + (a.score || 0), 0);
    return (sum / currentAssessments.length).toFixed(1);
  }, [currentAssessments]);

  const assessed = currentAssessments.length;
  const total = spheres.length;

  return (
    <div style={{ padding: 16, fontFamily: font, color: "var(--color-apple-text, #1c1c1e)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: "0.35px",
          margin: 0,
        }}>
          Точка А
        </h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {availableDates.length > 1 && (
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                if (!compareMode && availableDates.length > 1) {
                  setCompareDate(availableDates[1]);
                }
              }}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13,
                fontFamily: font, cursor: "pointer", fontWeight: 500,
                border: compareMode
                  ? "1.5px solid var(--color-apple-accent, #007aff)"
                  : "1px solid var(--color-apple-divider, rgba(60,60,67,0.12))",
                background: compareMode ? "rgba(0,122,255,0.08)" : "rgba(120,120,128,0.06)",
                color: compareMode ? "var(--color-apple-accent, #007aff)" : "var(--color-apple-text, #1c1c1e)",
              }}
            >
              {compareMode ? "Сравнение" : "Сравнить"}
            </button>
          )}
        </div>
      </div>

      {/* Stat bar */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 16,
        padding: "12px 16px", borderRadius: 10,
        background: "rgba(120, 120, 128, 0.06)",
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-apple-accent, #007aff)" }}>{avgScore}</div>
          <div style={{ fontSize: 12, color: "var(--color-apple-text-secondary, #8e8e93)" }}>Средняя</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{assessed}/{total}</div>
          <div style={{ fontSize: 12, color: "var(--color-apple-text-secondary, #8e8e93)" }}>Оценено</div>
        </div>
      </div>

      {/* Compare date picker */}
      {compareMode && availableDates.length > 1 && (
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12,
          padding: "8px 0",
        }}>
          <span style={{ fontSize: 13, color: "var(--color-apple-text-secondary, #8e8e93)", alignSelf: "center" }}>
            Сравнить с:
          </span>
          {availableDates.slice(1, 6).map(date => (
            <button
              key={date}
              onClick={() => setCompareDate(date)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12,
                fontFamily: font, cursor: "pointer", fontWeight: 500,
                border: compareDate === date
                  ? "1.5px solid var(--color-apple-warn, #ff9500)"
                  : "1px solid var(--color-apple-divider, rgba(60,60,67,0.12))",
                background: compareDate === date ? "rgba(255,149,0,0.08)" : "transparent",
                color: compareDate === date ? "var(--color-apple-warn, #ff9500)" : "var(--color-apple-text, #1c1c1e)",
              }}
            >
              {date}
            </button>
          ))}
        </div>
      )}

      {/* RadarChart */}
      {spheres.length > 0 ? (
        <RadarChart
          spheres={spheres}
          assessments={currentAssessments}
          overlayAssessments={compareMode ? compareAssessments : null}
        />
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "var(--color-apple-text-secondary, #8e8e93)" }}>
          Загрузка сфер...
        </div>
      )}

      {/* Легенда сравнения */}
      {compareMode && compareAssessments && (
        <div style={{
          display: "flex", gap: 16, marginBottom: 12, fontSize: 12,
          color: "var(--color-apple-text-secondary, #8e8e93)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: "var(--color-doodle-accent, #6ba3be)" }} />
            Текущая
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: "var(--color-doodle-warn, #e07b4c)", borderTop: "1px dashed var(--color-doodle-warn, #e07b4c)" }} />
            {compareDate}
          </span>
        </div>
      )}

      {/* Spheres list */}
      <div style={{ marginTop: 16 }}>
        {spheres.map(s => {
          const a = currentAssessments.find(x => x.sphereId === s.id);
          const isEditing = editing === s.id;

          return (
            <div key={s.id} style={{
              borderBottom: "0.5px solid var(--color-apple-separator, rgba(60,60,67,0.06))",
              padding: "12px 0",
            }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (isEditing) { setEditing(null); return; }
                  setEditing(s.id);
                  setScore(a?.score || 5);
                  setDesc(a?.description || "");
                }}
              >
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <span style={{ flex: 1, fontSize: 17, letterSpacing: "-0.41px", fontWeight: 400 }}>{s.name}</span>
                <span style={{
                  fontSize: 17, fontWeight: 600,
                  color: a ? "var(--color-apple-accent, #007aff)" : "var(--color-apple-text-tertiary, #aeaeb2)",
                }}>
                  {a ? `${a.score}` : "—"}
                </span>
                {a?.targetScore && (
                  <span style={{ fontSize: 13, color: "var(--color-apple-warn, #ff9500)" }}>
                    → {a.targetScore}
                  </span>
                )}
                <span style={{
                  fontSize: 13, color: "var(--color-apple-text-tertiary, #aeaeb2)",
                  transition: "transform 0.2s",
                  transform: isEditing ? "rotate(90deg)" : "none",
                }}>
                  ›
                </span>
              </div>

              {isEditing && (
                <div style={{
                  marginTop: 12, padding: 16,
                  background: "rgba(120, 120, 128, 0.06)",
                  borderRadius: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "var(--color-apple-text-secondary, #8e8e93)", minWidth: 50 }}>
                      Оценка
                    </span>
                    <input
                      type="range" min={1} max={10} value={score}
                      onChange={e => setScore(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--color-apple-accent, #007aff)" }}
                    />
                    <span style={{
                      fontSize: 28, fontWeight: 700, minWidth: 36, textAlign: "center",
                      color: "var(--color-apple-accent, #007aff)",
                      fontFamily: "var(--font-apple-rounded, system-ui)",
                    }}>{score}</span>
                  </div>
                  <textarea
                    placeholder="Комментарий..."
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%", borderRadius: 10,
                      border: "0.5px solid var(--color-apple-divider, rgba(60,60,67,0.12))",
                      background: "rgba(120, 120, 128, 0.08)",
                      padding: "10px 14px", fontFamily: font, fontSize: 15,
                      color: "var(--color-apple-text, #1c1c1e)",
                      resize: "vertical", outline: "none",
                      boxSizing: "border-box", letterSpacing: "-0.24px",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => handleSave(s.id)}
                      style={{
                        padding: "10px 20px", borderRadius: 12, border: "none",
                        background: "var(--color-apple-accent, #007aff)", color: "white",
                        fontFamily: font, cursor: "pointer", fontWeight: 600, fontSize: 15,
                        letterSpacing: "-0.24px",
                      }}
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      style={{
                        padding: "10px 20px", borderRadius: 12,
                        border: "none",
                        background: "rgba(120, 120, 128, 0.12)",
                        color: "var(--color-apple-text, #1c1c1e)",
                        fontFamily: font, cursor: "pointer", fontSize: 15,
                        letterSpacing: "-0.24px",
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
