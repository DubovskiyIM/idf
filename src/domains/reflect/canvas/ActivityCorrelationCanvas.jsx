/**
 * ActivityCorrelationCanvas — анализ влияния активностей на настроение.
 *
 * Для каждой активности считается разница средних значений по выбранной оси
 * (pleasantness / energy) между чек-инами, где активность присутствовала,
 * и теми, где её не было. Результат рендерится как горизонтальный bar-chart
 * от центральной 0-линии.
 *
 * Стиль — Apple visionOS-glass: полупрозрачная карточка, большие заголовки,
 * system font, segmented control, мягкие цвета success/danger.
 */
import { useMemo, useState } from "react";

export default function ActivityCorrelationCanvas({ world, viewer, exec, ctx }) {
  const [axis, setAxis] = useState("pleasantness");

  const correlations = useMemo(() => {
    const entries = (world.moodEntries || []).filter(e => e.userId === viewer?.id);
    const links = (world.entryActivities || []).filter(l => l.userId === viewer?.id);
    const activities = (world.activities || []).filter(
      a => a.userId === viewer?.id || a.userId === null
    );

    return activities.map(a => {
      const entryIdsWithAct = new Set(
        links.filter(l => l.activityId === a.id).map(l => l.entryId)
      );
      const present = entries.filter(e => entryIdsWithAct.has(e.id));
      const absent = entries.filter(e => !entryIdsWithAct.has(e.id));
      if (present.length < 2 || absent.length < 2) return null;
      const avgPresent = present.reduce((s, e) => s + (e[axis] || 0), 0) / present.length;
      const avgAbsent = absent.reduce((s, e) => s + (e[axis] || 0), 0) / absent.length;
      return {
        activity: a,
        delta: avgPresent - avgAbsent,
        sampleSize: present.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [world, viewer, axis]);

  // Apple-style CSS variables с fallback'ами
  const font = "var(--font-apple, -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui)";
  const textPrimary = "var(--color-apple-text, #1d1d1f)";
  const textSecondary = "var(--color-apple-text-secondary, #86868b)";
  const success = "var(--color-apple-success, #34c759)";
  const danger = "var(--color-apple-danger, #ff3b30)";
  const glassBg = "var(--color-apple-glass-bg, rgba(255, 255, 255, 0.7))";
  const glassBorder = "var(--color-apple-glass-border, rgba(255, 255, 255, 0.5))";
  const segmentBg = "var(--color-apple-segment-bg, rgba(120, 120, 128, 0.12))";
  const segmentActive = "var(--color-apple-segment-active, #ffffff)";

  const glassCard = {
    background: glassBg,
    backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    border: `0.5px solid ${glassBorder}`,
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
  };

  const maxAbs = correlations.length > 0
    ? Math.max(...correlations.map(c => Math.abs(c.delta)), 0.5)
    : 1;

  return (
    <div style={{ padding: 16, fontFamily: font, color: textPrimary }}>
      {/* Header */}
      <h1 style={{
        margin: 0,
        fontSize: 34,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
      }}>
        Влияние активностей
      </h1>
      <p style={{
        margin: "4px 0 20px",
        fontSize: 17,
        fontWeight: 400,
        color: textSecondary,
        letterSpacing: "-0.01em",
      }}>
        {axis === "pleasantness" ? "на приятность" : "на энергию"}
      </p>

      {/* Segmented control */}
      <div style={{
        display: "flex",
        background: segmentBg,
        borderRadius: 9,
        padding: 2,
        marginBottom: 20,
        gap: 2,
      }}>
        {[
          { id: "pleasantness", label: "Приятность" },
          { id: "energy", label: "Энергия" },
        ].map(opt => {
          const active = axis === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setAxis(opt.id)}
              style={{
                flex: 1,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                fontFamily: font,
                color: textPrimary,
                background: active ? segmentActive : "transparent",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                boxShadow: active ? "0 3px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Glass card with bars */}
      <div style={glassCard}>
        {correlations.length === 0 ? (
          <div style={{
            textAlign: "center",
            color: textSecondary,
            fontSize: 15,
            padding: "40px 20px",
            lineHeight: 1.5,
          }}>
            Нужно больше чек-инов с активностями<br/>
            <span style={{ fontSize: 13 }}>(минимум по 2 на каждую)</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {correlations.map(({ activity, delta, sampleSize }) => {
              const positive = delta >= 0;
              const color = positive ? success : danger;
              const widthPct = (Math.abs(delta) / maxAbs) * 50; // max 50% от половины
              return (
                <div key={activity.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Header row: icon + name + value */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 24,
                      width: 24,
                      height: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                    }}>
                      {activity.icon || "◦"}
                    </span>
                    <span style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: 500,
                      color: textPrimary,
                      letterSpacing: "-0.01em",
                    }}>
                      {activity.name || activity.title}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: textSecondary,
                    }}>
                      (n={sampleSize})
                    </span>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color,
                      minWidth: 48,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {positive ? "+" : ""}{delta.toFixed(1)}
                    </span>
                  </div>

                  {/* Bar chart row: центральная 0-линия, bar расходится в сторону */}
                  <div style={{
                    position: "relative",
                    height: 10,
                    marginLeft: 34, // align with name after icon
                  }}>
                    {/* Центральная ось */}
                    <div style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: "rgba(0,0,0,0.15)",
                      transform: "translateX(-0.5px)",
                      zIndex: 1,
                    }} />
                    {/* Bar */}
                    <div style={{
                      position: "absolute",
                      top: 0,
                      height: 10,
                      borderRadius: 4,
                      background: color,
                      boxShadow: `0 1px 3px ${color}40`,
                      ...(positive
                        ? { left: "50%", width: `${widthPct}%` }
                        : { right: "50%", width: `${widthPct}%` }),
                      transition: "all 0.3s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
