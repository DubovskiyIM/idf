import React, { useState, useMemo } from "react";
import { QUADRANT_COLORS, QUADRANT_LABELS, computeQuadrant } from "../emotions.js";

const PERIODS = [
  { id: 30, label: "30д" },
  { id: 90, label: "90д" },
  { id: "all", label: "Всё время" },
];

export default function MoodMeterClusterCanvas({ world, viewer, exec, ctx }) {
  const [period, setPeriod] = useState(30);

  const entries = useMemo(() => {
    const all = world?.mood_entries || world?.moodEntries || world?.entries || [];
    const now = Date.now();
    const cutoff = period === "all" ? 0 : now - period * 24 * 60 * 60 * 1000;
    return all.filter((e) => {
      if (e.userId !== viewer?.id) return false;
      const t = e.createdAt || e.timestamp || e.ts || 0;
      const time = typeof t === "string" ? new Date(t).getTime() : t;
      return time >= cutoff;
    });
  }, [world, viewer, period]);

  const { grid, maxCount, total, quadrantSums } = useMemo(() => {
    const g = Array.from({ length: 11 }, () => Array(11).fill(0));
    const qSums = { HEP: 0, HEU: 0, LEP: 0, LEU: 0 };
    let max = 0;
    for (const e of entries) {
      const p = Math.max(-5, Math.min(5, Math.round(e.pleasantness ?? 0)));
      const en = Math.max(-5, Math.min(5, Math.round(e.energy ?? 0)));
      const cx = p + 5;
      const cy = en + 5;
      g[cy][cx] += 1;
      if (g[cy][cx] > max) max = g[cy][cx];
      qSums[computeQuadrant(p, en)] += 1;
    }
    return { grid: g, maxCount: max, total: entries.length, quadrantSums: qSums };
  }, [entries]);

  const dominantQuadrant = useMemo(() => {
    let best = null;
    let bestCount = -1;
    for (const q of Object.keys(quadrantSums)) {
      if (quadrantSums[q] > bestCount) {
        bestCount = quadrantSums[q];
        best = q;
      }
    }
    return bestCount > 0 ? best : null;
  }, [quadrantSums]);

  const [selected, setSelected] = useState(null);

  const size = 360;
  const cell = size / 11;

  return (
    <div style={{
      fontFamily: "var(--font-apple)",
      padding: 16,
      color: "var(--color-apple-label, #1c1c1e)",
      maxWidth: 520,
      margin: "0 auto",
    }}>
      <h1 style={{
        fontSize: 34,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        margin: "0 0 16px",
      }}>Где ты бываешь чаще всего</h1>

      <div style={{
        display: "inline-flex",
        background: "var(--color-apple-fill-tertiary, rgba(118,118,128,0.12))",
        borderRadius: 9,
        padding: 2,
        marginBottom: 20,
      }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              background: period === p.id ? "var(--color-apple-bg, #fff)" : "transparent",
              color: "var(--color-apple-label, #1c1c1e)",
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              boxShadow: period === p.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >{p.label}</button>
        ))}
      </div>

      <div style={{
        background: "var(--color-apple-glass, rgba(255,255,255,0.72))",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "1px solid var(--color-apple-separator, rgba(60,60,67,0.12))",
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}>
        {total === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--color-apple-label-secondary, #6e6e73)",
            fontSize: 15,
          }}>Пока нет данных. Сделай первый чек-ин</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg
                viewBox={`0 0 ${size} ${size}`}
                style={{ width: "100%", maxWidth: size, height: "auto", display: "block" }}
              >
                {grid.map((row, yIdx) => row.map((count, xIdx) => {
                  if (count === 0) return null;
                  const p = xIdx - 5;
                  const en = yIdx - 5;
                  const q = computeQuadrant(p, en);
                  const opacity = Math.min(0.85, count / maxCount);
                  const isSel = selected && selected.x === xIdx && selected.y === yIdx;
                  const svgY = (10 - yIdx) * cell;
                  return (
                    <rect
                      key={`${xIdx}-${yIdx}`}
                      x={xIdx * cell}
                      y={svgY}
                      width={cell}
                      height={cell}
                      fill={QUADRANT_COLORS[q]}
                      opacity={opacity}
                      stroke={isSel ? "var(--color-apple-label, #1c1c1e)" : "none"}
                      strokeWidth={isSel ? 2 : 0}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelected({ x: xIdx, y: yIdx, count })}
                    />
                  );
                }))}

                <line
                  x1={0} y1={size / 2} x2={size} y2={size / 2}
                  stroke="var(--color-apple-divider, rgba(60,60,67,0.29))" strokeWidth={1}
                />
                <line
                  x1={size / 2} y1={0} x2={size / 2} y2={size}
                  stroke="var(--color-apple-divider, rgba(60,60,67,0.29))" strokeWidth={1}
                />

                <text x={size - 10} y={22} fontSize={20} textAnchor="end">🤩</text>
                <text x={10} y={22} fontSize={20}>😖</text>
                <text x={size - 10} y={size - 10} fontSize={20} textAnchor="end">😌</text>
                <text x={10} y={size - 10} fontSize={20}>😴</text>
              </svg>
            </div>

            {selected && selected.count > 0 && (
              <div style={{
                marginTop: 12,
                textAlign: "center",
                fontSize: 13,
                color: "var(--color-apple-label-secondary, #6e6e73)",
              }}>{selected.count} чек-инов в этой зоне</div>
            )}
          </>
        )}
      </div>

      {total > 0 && (
        <div style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div style={{
            flex: 1,
            minWidth: 140,
            background: "var(--color-apple-glass, rgba(255,255,255,0.72))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "1px solid var(--color-apple-separator, rgba(60,60,67,0.12))",
            borderRadius: 16,
            padding: "12px 16px",
          }}>
            <div style={{ fontSize: 12, color: "var(--color-apple-label-secondary, #6e6e73)" }}>Всего чек-инов</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{total}</div>
          </div>
          {dominantQuadrant && (
            <div style={{
              flex: 1,
              minWidth: 140,
              background: "var(--color-apple-glass, rgba(255,255,255,0.72))",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid var(--color-apple-separator, rgba(60,60,67,0.12))",
              borderRadius: 16,
              padding: "12px 16px",
            }}>
              <div style={{ fontSize: 12, color: "var(--color-apple-label-secondary, #6e6e73)" }}>Доминирующий квадрант</div>
              <div style={{
                fontSize: 15,
                fontWeight: 600,
                marginTop: 4,
                color: QUADRANT_COLORS[dominantQuadrant],
              }}>{QUADRANT_LABELS[dominantQuadrant]}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
