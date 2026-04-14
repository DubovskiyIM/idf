/**
 * MoodTrendsCanvas — тренды настроения за период.
 * Две линии SVG (приятность + энергия) по записям mood-checkin'ов.
 * Apple visionOS-glass стилистика.
 */
import { useMemo, useState } from "react";

const DAY = 24 * 60 * 60 * 1000;

function fmtDateShort(ts) {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function fmtDateLong(ts) {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear().toString().slice(2)}`;
}

export default function MoodTrendsCanvas({ world, viewer, exec, ctx }) {
  const [period, setPeriod] = useState(30);
  const [hoverIdx, setHoverIdx] = useState(null);

  const entries = useMemo(() => {
    const cutoff = Date.now() - period * DAY;
    return (world.moodEntries || [])
      .filter(e => e.userId === viewer?.id && e.loggedAt > cutoff)
      .sort((a, b) => a.loggedAt - b.loggedAt);
  }, [world, viewer, period]);

  // Стили
  const font = "var(--font-apple, -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif)";
  const textPrimary = "var(--color-apple-text, #1d1d1f)";
  const textSecondary = "var(--color-apple-text-secondary, #86868b)";
  const accent = "var(--color-apple-accent, #007aff)";
  const violet = "var(--color-apple-violet, #af52de)";
  const divider = "var(--color-apple-divider, rgba(60,60,67,0.12))";
  const glassBg = "var(--color-apple-glass-bg, rgba(255,255,255,0.72))";
  const glassBorder = "var(--color-apple-glass-border, rgba(255,255,255,0.5))";
  const segBg = "var(--color-apple-segment-bg, rgba(120,120,128,0.16))";
  const segActive = "var(--color-apple-segment-active, #ffffff)";

  const glassCard = {
    background: glassBg,
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: `1px solid ${glassBorder}`,
    borderRadius: 20,
    boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
    padding: 20,
  };

  // SVG размеры
  const VIEW_W = 700;
  const VIEW_H = 280;
  const PAD_L = 40;
  const PAD_R = 20;
  const PAD_T = 30;
  const PAD_B = 30;
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;

  // Y-скейл: -5..5
  const yScale = v => PAD_T + ((5 - v) / 10) * innerH;

  // X-скейл: индекс по записям
  const n = entries.length;
  const xScale = i => n <= 1 ? PAD_L + innerW / 2 : PAD_L + (i / (n - 1)) * innerW;

  // Пути линий
  const pleasantPath = entries.map((e, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(e.pleasantness ?? 0).toFixed(1)}`).join(" ");
  const energyPath = entries.map((e, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(e.energy ?? 0).toFixed(1)}`).join(" ");

  // Среднее
  const avgPleasant = n > 0 ? entries.reduce((s, e) => s + (e.pleasantness ?? 0), 0) / n : 0;
  const avgEnergy = n > 0 ? entries.reduce((s, e) => s + (e.energy ?? 0), 0) / n : 0;

  // Лучший / худший день по pleasantness
  const bestEntry = n > 0 ? entries.reduce((a, b) => (b.pleasantness ?? -99) > (a.pleasantness ?? -99) ? b : a) : null;
  const worstEntry = n > 0 ? entries.reduce((a, b) => (b.pleasantness ?? 99) < (a.pleasantness ?? 99) ? b : a) : null;

  // X-метки: адаптивный шаг
  const xLabelStep = Math.max(1, Math.ceil(n / 6));
  const yTicks = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

  // Segmented control
  const segBtn = (val, label) => {
    const active = period === val;
    return (
      <button
        key={val}
        onClick={() => setPeriod(val)}
        style={{
          flex: 1,
          padding: "6px 16px",
          border: "none",
          borderRadius: 7,
          background: active ? segActive : "transparent",
          color: textPrimary,
          fontFamily: font,
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          cursor: "pointer",
          boxShadow: active ? "0 3px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)" : "none",
          transition: "all 0.2s ease",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ padding: 16, fontFamily: font, color: textPrimary, maxWidth: 780, margin: "0 auto" }}>
      {/* Header */}
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 16px", letterSpacing: "-0.02em" }}>
        Тренды
      </h1>

      {/* Segmented control */}
      <div style={{
        display: "flex",
        background: segBg,
        borderRadius: 9,
        padding: 2,
        marginBottom: 16,
        gap: 2,
      }}>
        {segBtn(7, "7 дней")}
        {segBtn(30, "30 дней")}
        {segBtn(90, "90 дней")}
      </div>

      {/* Chart */}
      {entries.length < 2 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 15, color: textSecondary }}>
            Нужно минимум 2 чек-ина для графика
          </div>
        </div>
      ) : (
        <div style={glassCard}>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
          >
            {/* Grid horizontal */}
            {yTicks.map(t => (
              <line
                key={t}
                x1={PAD_L}
                x2={PAD_L + innerW}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke={divider}
                strokeWidth={t === 0 ? 1 : 0.5}
              />
            ))}
            {/* Y labels */}
            {yTicks.filter(t => t % 1 === 0 && (t === -5 || t === 0 || t === 5)).map(t => (
              <text
                key={t}
                x={PAD_L - 8}
                y={yScale(t) + 4}
                fontSize={11}
                fill={textSecondary}
                textAnchor="end"
                fontFamily={font}
              >
                {t > 0 ? `+${t}` : t}
              </text>
            ))}

            {/* X labels */}
            {entries.map((e, i) => {
              if (i % xLabelStep !== 0 && i !== n - 1) return null;
              return (
                <text
                  key={i}
                  x={xScale(i)}
                  y={VIEW_H - PAD_B + 18}
                  fontSize={11}
                  fill={textSecondary}
                  textAnchor="middle"
                  fontFamily={font}
                >
                  {fmtDateShort(e.loggedAt)}
                </text>
              );
            })}

            {/* Average lines (dashed) */}
            <line
              x1={PAD_L}
              x2={PAD_L + innerW}
              y1={yScale(avgPleasant)}
              y2={yScale(avgPleasant)}
              stroke={accent}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              opacity={0.4}
            />
            <line
              x1={PAD_L}
              x2={PAD_L + innerW}
              y1={yScale(avgEnergy)}
              y2={yScale(avgEnergy)}
              stroke={violet}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              opacity={0.4}
            />

            {/* Lines */}
            <path
              d={pleasantPath}
              fill="none"
              stroke={accent}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={energyPath}
              fill="none"
              stroke={violet}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Points */}
            {entries.map((e, i) => (
              <g key={`pt-${i}`}>
                <circle
                  cx={xScale(i)}
                  cy={yScale(e.pleasantness ?? 0)}
                  r={4}
                  fill={accent}
                />
                <circle
                  cx={xScale(i)}
                  cy={yScale(e.energy ?? 0)}
                  r={4}
                  fill={violet}
                />
                {/* Hover region */}
                <rect
                  x={xScale(i) - Math.max(8, innerW / (n * 2))}
                  y={PAD_T}
                  width={Math.max(16, innerW / n)}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            ))}

            {/* Tooltip */}
            {hoverIdx !== null && entries[hoverIdx] && (() => {
              const e = entries[hoverIdx];
              const tx = xScale(hoverIdx);
              const ty = PAD_T + 10;
              const tooltipW = 160;
              const tooltipH = 76;
              const leftEdge = Math.min(Math.max(tx - tooltipW / 2, PAD_L), PAD_L + innerW - tooltipW);
              return (
                <g pointerEvents="none">
                  <line
                    x1={tx}
                    x2={tx}
                    y1={PAD_T}
                    y2={PAD_T + innerH}
                    stroke={textSecondary}
                    strokeWidth={0.5}
                    strokeDasharray="2,3"
                    opacity={0.6}
                  />
                  <rect
                    x={leftEdge}
                    y={ty}
                    width={tooltipW}
                    height={tooltipH}
                    rx={10}
                    fill="rgba(255,255,255,0.96)"
                    stroke={glassBorder}
                    strokeWidth={0.5}
                    filter="drop-shadow(0 4px 12px rgba(0,0,0,0.12))"
                  />
                  <text x={leftEdge + 10} y={ty + 18} fontSize={11} fontWeight={600} fill={textPrimary} fontFamily={font}>
                    {fmtDateLong(e.loggedAt)}
                  </text>
                  <circle cx={leftEdge + 14} cy={ty + 34} r={3} fill={accent} />
                  <text x={leftEdge + 22} y={ty + 37} fontSize={11} fill={textPrimary} fontFamily={font}>
                    Приятность: {(e.pleasantness ?? 0) > 0 ? "+" : ""}{e.pleasantness ?? 0}
                  </text>
                  <circle cx={leftEdge + 14} cy={ty + 50} r={3} fill={violet} />
                  <text x={leftEdge + 22} y={ty + 53} fontSize={11} fill={textPrimary} fontFamily={font}>
                    Энергия: {(e.energy ?? 0) > 0 ? "+" : ""}{e.energy ?? 0}
                  </text>
                  {e.emotion && (
                    <text x={leftEdge + 10} y={ty + 68} fontSize={11} fill={textSecondary} fontFamily={font}>
                      {e.emotion}
                    </text>
                  )}
                </g>
              );
            })()}
          </svg>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 12, fontSize: 13, color: textSecondary }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent, display: "inline-block" }} />
              Приятность
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: violet, display: "inline-block" }} />
              Энергия
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
      {entries.length >= 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
          <div style={{ ...glassCard, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Среднее
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: accent, marginTop: 6, letterSpacing: "-0.02em" }}>
              {avgPleasant >= 0 ? "+" : ""}{avgPleasant.toFixed(1)}
            </div>
          </div>
          <div style={{ ...glassCard, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Лучший
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: textPrimary, marginTop: 6, letterSpacing: "-0.01em" }}>
              {bestEntry ? fmtDateShort(bestEntry.loggedAt) : "—"}
            </div>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
              {bestEntry ? `${(bestEntry.pleasantness ?? 0) > 0 ? "+" : ""}${bestEntry.pleasantness ?? 0}` : ""}
            </div>
          </div>
          <div style={{ ...glassCard, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Худший
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: textPrimary, marginTop: 6, letterSpacing: "-0.01em" }}>
              {worstEntry ? fmtDateShort(worstEntry.loggedAt) : "—"}
            </div>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
              {worstEntry ? `${(worstEntry.pleasantness ?? 0) > 0 ? "+" : ""}${worstEntry.pleasantness ?? 0}` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
