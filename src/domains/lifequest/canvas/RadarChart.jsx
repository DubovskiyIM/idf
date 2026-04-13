import React, { useMemo } from "react";

/**
 * RadarChart — SVG-радар (паутинка) для 12 сфер жизни.
 * Два полигона: текущие оценки (заливка) и целевые (пунктир).
 * Doodle-стиль: слегка волнистые линии, рукописный вид.
 */

const TOTAL_AXES = 12;
const MAX_SCORE = 10;
const GUIDE_LEVELS = [2, 4, 6, 8, 10];

/* ---------- утилиты ---------- */

/** Угол для i-й оси (начинаем сверху, -PI/2) */
function axisAngle(i) {
  return (i * 2 * Math.PI) / TOTAL_AXES - Math.PI / 2;
}

/** Небольшое "дрожание" для doodle-стиля */
function wobble(index) {
  return Math.sin(index * 7) * 2;
}

/** Точка на оси с учётом оценки и wobble */
function scorePoint(cx, cy, radius, index, score) {
  const angle = axisAngle(index);
  const r = radius * (score / MAX_SCORE);
  const wx = wobble(index);
  const wy = wobble(index + 3);
  return {
    x: cx + r * Math.cos(angle) + wx,
    y: cy + r * Math.sin(angle) + wy,
  };
}

/** Точка на оси без wobble (для направляющих и меток) */
function axisPoint(cx, cy, r, index) {
  const angle = axisAngle(index);
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Полигон из массива точек → SVG path string */
function polygonPath(points) {
  if (points.length === 0) return "";
  return (
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ") + " Z"
  );
}

/** Направляющий круг с doodle-дрожанием (набор точек → path) */
function guideCirclePath(cx, cy, radius, segments = 72) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    const noise = Math.sin(i * 5.3) * 0.8 + Math.cos(i * 3.7) * 0.5;
    pts.push({
      x: cx + (radius + noise) * Math.cos(angle),
      y: cy + (radius + noise) * Math.sin(angle),
    });
  }
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/** Сокращение имени сферы до ~8 символов */
function abbreviate(name) {
  if (!name) return "";
  if (name.length <= 9) return name;
  return name.slice(0, 8) + "...";
}

/* ---------- компонент ---------- */

export default function RadarChart({ spheres = [], assessments = [], size = 300 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;

  /** Карта sphereId → assessment */
  const assessMap = useMemo(() => {
    const m = {};
    for (const a of assessments) {
      m[a.sphereId] = a;
    }
    return m;
  }, [assessments]);

  /** Отсортированные сферы (по sortOrder) */
  const sorted = useMemo(() => {
    const s = [...spheres];
    s.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return s.slice(0, TOTAL_AXES);
  }, [spheres]);

  /** Точки текущих оценок */
  const currentPoints = useMemo(() => {
    return sorted.map((sp, i) => {
      const a = assessMap[sp.id];
      const score = a ? Math.min(Math.max(a.score ?? 0, 0), MAX_SCORE) : 0;
      return scorePoint(cx, cy, radius, i, score);
    });
  }, [sorted, assessMap, cx, cy, radius]);

  /** Точки целевых оценок */
  const targetPoints = useMemo(() => {
    return sorted.map((sp, i) => {
      const a = assessMap[sp.id];
      const score = a ? Math.min(Math.max(a.targetScore ?? 0, 0), MAX_SCORE) : 0;
      return scorePoint(cx, cy, radius, i, score);
    });
  }, [sorted, assessMap, cx, cy, radius]);

  const hasTarget = targetPoints.some(
    (_, i) => assessMap[sorted[i]?.id]?.targetScore != null
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: size, fontFamily: "var(--font-doodle, 'Patrick Hand', cursive)" }}
    >
      {/* Фон */}
      <rect width={size} height={size} fill="var(--color-doodle-bg, #fffef5)" rx={8} />

      {/* Направляющие круги */}
      {GUIDE_LEVELS.map((level) => {
        const r = radius * (level / MAX_SCORE);
        return (
          <path
            key={`guide-${level}`}
            d={guideCirclePath(cx, cy, r)}
            fill="none"
            stroke="var(--color-doodle-border, #d0c9b0)"
            strokeWidth={0.7}
            strokeDasharray="4 3"
            opacity={0.5}
          />
        );
      })}

      {/* Оси */}
      {sorted.map((_, i) => {
        const end = axisPoint(cx, cy, radius, i);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="var(--color-doodle-border, #d0c9b0)"
            strokeWidth={0.7}
            opacity={0.4}
          />
        );
      })}

      {/* Полигон целевых оценок (пунктир) */}
      {hasTarget && (
        <path
          d={polygonPath(targetPoints)}
          fill="none"
          stroke="var(--color-doodle-gold, #e6a817)"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
          opacity={0.8}
        />
      )}

      {/* Полигон текущих оценок (заливка) */}
      <path
        d={polygonPath(currentPoints)}
        fill="var(--color-doodle-accent, #6ba3be)"
        fillOpacity={0.25}
        stroke="var(--color-doodle-accent, #6ba3be)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Точки на вершинах текущего полигона */}
      {currentPoints.map((p, i) => {
        const a = assessMap[sorted[i]?.id];
        if (!a || !a.score) return null;
        return (
          <circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="var(--color-doodle-accent, #6ba3be)"
            stroke="var(--color-doodle-bg, #fffef5)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Метки осей: иконка + имя */}
      {sorted.map((sp, i) => {
        const labelR = radius + 22;
        const pt = axisPoint(cx, cy, labelR, i);
        const angle = axisAngle(i);
        const angleDeg = (angle * 180) / Math.PI;

        // Выравнивание текста в зависимости от позиции
        let anchor = "middle";
        if (angleDeg > 10 && angleDeg < 170) anchor = "start";
        if (angleDeg < -10 && angleDeg > -170) anchor = "end";
        // Левая половина
        if (Math.abs(angleDeg) > 100) {
          anchor = angleDeg > 0 ? "end" : "end";
        }

        // Точнее: правая половина → start, левая → end, верх/низ → middle
        const cos = Math.cos(angle);
        if (cos > 0.15) anchor = "start";
        else if (cos < -0.15) anchor = "end";
        else anchor = "middle";

        const dy = Math.sin(angle) > 0.15 ? "0.9em" : Math.sin(angle) < -0.15 ? "-0.2em" : "0.35em";

        return (
          <text
            key={`label-${i}`}
            x={pt.x}
            y={pt.y}
            textAnchor={anchor}
            dy={dy}
            fontSize={size <= 250 ? 8 : 10}
            fill="var(--color-doodle-ink, #3a3530)"
          >
            {sp.icon ? `${sp.icon} ` : ""}
            {abbreviate(sp.name)}
          </text>
        );
      })}

      {/* Число в центре направляющих кругов */}
      {GUIDE_LEVELS.map((level) => {
        const r = radius * (level / MAX_SCORE);
        return (
          <text
            key={`glabel-${level}`}
            x={cx + 3}
            y={cy - r - 2}
            fontSize={7}
            fill="var(--color-doodle-border, #d0c9b0)"
            opacity={0.7}
          >
            {level}
          </text>
        );
      })}
    </svg>
  );
}
