/**
 * Chart-primitive — первая категория primitive, выходящая за text/image/
 * container. Декларативный spec из проекции → конкретный chart-component
 * адаптера (или SVG-fallback).
 *
 * Spec (из проекции):
 *   {
 *     type: "chart",
 *     chartType: "line" | "pie" | "column" | "area" | "sparkline",
 *     data: "world.collectionName" | inline array,
 *     xField, yField, seriesField, height
 *   }
 *
 * Адаптер: getAdaptedComponent("primitive", "chart") | ("primitive", "sparkline").
 * Fallback: inline SVG (Line + Pie) для Mantine/shadcn/Apple, где chart ещё
 * не реализован явно.
 */

import { getAdaptedComponent } from "../adapters/registry.js";
import { resolve } from "../eval.js";

function coerceData(spec, ctx) {
  if (Array.isArray(spec.data)) return spec.data;
  if (typeof spec.data === "string" && ctx?.world) {
    const resolved = resolve(ctx.world, spec.data);
    if (Array.isArray(resolved)) return resolved;
  }
  return [];
}

/**
 * SVG-fallback: простой Line/Area график.
 * Нужен для адаптеров без chart-реализации (Mantine v1, shadcn, Apple).
 */
function SvgLineFallback({ data, xField = "x", yField = "y", height = 220, width = "100%" }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 12 }}>Нет данных</div>;
  }

  const ys = data.map(d => Number(d[yField]) || 0);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const viewW = 600, viewH = 200;
  const pad = 20;

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (viewW - 2 * pad);
    const y = viewH - pad - ((Number(d[yField]) - minY) / rangeY) * (viewH - 2 * pad);
    return [x, y];
  });

  const path = "M " + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
  const area = path + ` L ${pts[pts.length - 1][0]},${viewH - pad} L ${pts[0][0]},${viewH - pad} Z`;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} width={width} height={height} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={area} fill="rgba(99, 102, 241, 0.15)" />
      <path d={path} stroke="var(--mantine-color-indigo-6, #6366f1)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="var(--mantine-color-indigo-6, #6366f1)" />
      ))}
    </svg>
  );
}

function SvgPieFallback({ data, xField = "type", yField = "value", height = 220 }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const total = data.reduce((s, d) => s + (Number(d[yField]) || 0), 0) || 1;
  const cx = 110, cy = 110, r = 90;
  let angle = -Math.PI / 2;
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

  const slices = data.map((d, i) => {
    const value = Number(d[yField]) || 0;
    const frac = value / total;
    const a1 = angle;
    const a2 = angle + frac * Math.PI * 2;
    angle = a2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const path = `M ${cx},${cy} L ${x1.toFixed(1)},${y1.toFixed(1)} A ${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
    return { path, color: colors[i % colors.length], label: d[xField], frac };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height }}>
      <svg viewBox="0 0 220 220" width="220" height={height} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="var(--mantine-color-body, #fff)" strokeWidth="2" />)}
      </svg>
      <div style={{ fontSize: 12, lineHeight: 1.7 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, display: "inline-block" }} />
            <span>{s.label}: {(s.frac * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chart({ node, ctx }) {
  const data = coerceData(node, ctx);
  const AdaptedChart = getAdaptedComponent("primitive", "chart");

  if (AdaptedChart) {
    return <AdaptedChart chartType={node.chartType} data={data} xField={node.xField} yField={node.yField} seriesField={node.seriesField} height={node.height || 220} />;
  }

  // Fallback — SVG по chartType
  if (node.chartType === "pie") {
    return <SvgPieFallback data={data} xField={node.xField} yField={node.yField} height={node.height || 220} />;
  }
  return <SvgLineFallback data={data} xField={node.xField} yField={node.yField} height={node.height || 220} />;
}

export function Sparkline({ node, ctx }) {
  const data = coerceData(node, ctx);
  const AdaptedSparkline = getAdaptedComponent("primitive", "sparkline");

  if (AdaptedSparkline) {
    return <AdaptedSparkline data={data} height={node.height || 40} width={node.width || 120} color={node.color} />;
  }

  return <SvgLineFallback data={data} xField={node.xField || "x"} yField={node.yField || "y"} height={node.height || 40} />;
}
