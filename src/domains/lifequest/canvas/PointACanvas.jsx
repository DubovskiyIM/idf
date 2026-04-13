/**
 * PointACanvas — Колесо жизни с RadarChart + inline-оценка сфер.
 * Клик на сферу → inline-slider 1-10 → exec("assess_sphere").
 */
import { useState } from "react";
import RadarChart from "./RadarChart.jsx";

export default function PointACanvas({ world, viewer, exec }) {
  const spheres = (world.spheres || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const assessments = (world.sphereAssessments || []).filter(a => a.userId === viewer?.id);
  const [editing, setEditing] = useState(null); // sphereId
  const [score, setScore] = useState(5);
  const [desc, setDesc] = useState("");

  const handleSave = (sphereId) => {
    exec("assess_sphere", { sphereId, score, description: desc });
    setEditing(null);
    setScore(5);
    setDesc("");
  };

  const pad = "var(--spacing-doodle, 16px)";
  const ink = "var(--color-doodle-ink, #5c4033)";
  const inkLight = "var(--color-doodle-ink-light, #8b7355)";
  const accent = "var(--color-doodle-accent, #4a7c59)";
  const border = "var(--color-doodle-border, #c4a77d)";
  const highlight = "var(--color-doodle-highlight, #fff3cd)";
  const font = "var(--font-doodle, system-ui)";

  return (
    <div style={{ padding: pad, fontFamily: font }}>
      <h2 style={{
        fontSize: 20, fontWeight: 700, color: ink,
        textDecoration: "underline", textDecorationStyle: "wavy",
        textDecorationColor: border, marginBottom: 16, margin: 0,
      }}>
        🧭 Точка А — колесо жизни
      </h2>

      <RadarChart spheres={spheres} assessments={assessments} />

      <div style={{ marginTop: 16 }}>
        {spheres.map(s => {
          const a = assessments.find(x => x.sphereId === s.id);
          const isEditing = editing === s.id;

          return (
            <div key={s.id} style={{ borderBottom: `1px dotted ${border}`, padding: "8px 0" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (isEditing) { setEditing(null); return; }
                  setEditing(s.id);
                  setScore(a?.score || 5);
                  setDesc(a?.description || "");
                }}
              >
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ flex: 1, color: ink }}>{s.name}</span>
                <span style={{ fontWeight: 700, color: a ? accent : inkLight }}>
                  {a ? `${a.score}/10` : "—"}
                </span>
                {a?.targetScore && (
                  <span style={{ fontSize: 12, color: "var(--color-doodle-gold, #d4a76a)" }}>→ {a.targetScore}</span>
                )}
                <span style={{ fontSize: 12, color: inkLight }}>{isEditing ? "▲" : "✏️"}</span>
              </div>

              {isEditing && (
                <div style={{
                  marginTop: 8, padding: 12,
                  background: highlight, borderRadius: "var(--radius-doodle, 12px)",
                  border: `1px dashed ${border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: inkLight }}>Оценка:</span>
                    <input
                      type="range" min={1} max={10} value={score}
                      onChange={e => setScore(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 18, color: accent, minWidth: 24, textAlign: "center" }}>{score}</span>
                  </div>
                  <textarea
                    placeholder="Описание текущего состояния..."
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%", borderRadius: 8, border: `1px dashed ${border}`,
                      background: "var(--color-doodle-bg, #fdf6e3)",
                      padding: "6px 10px", fontFamily: font, fontSize: 13,
                      color: ink, resize: "vertical", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => handleSave(s.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, border: `2px solid ${accent}`,
                        background: accent, color: "white", fontFamily: font,
                        cursor: "pointer", fontWeight: 700, fontSize: 13,
                      }}
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, border: `1px dashed ${border}`,
                        background: "transparent", color: ink, fontFamily: font,
                        cursor: "pointer", fontSize: 13,
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
