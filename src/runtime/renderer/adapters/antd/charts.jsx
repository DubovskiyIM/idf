/**
 * Chart-primitive для AntD-адаптера — обёртки над @ant-design/plots.
 *
 * Первая категория primitive, которая выходит за рамки текст/картинка/
 * контейнер. Доменный код декларирует chart-spec в проекции:
 *
 *   { kind: "chart", chartType: "line", data: "...", spec: {...} }
 *
 * SlotRenderer получает компонент через getAdaptedComponent('primitive', 'chart')
 * и передаёт нормализованный spec.
 */

import { Line, Pie, Column, Area } from "@ant-design/plots";

/**
 * Универсальный chart-диспетчер.
 * Props: { chartType, data, xField, yField, seriesField, height, colorField, ...rest }
 */
export function AntdChart({ chartType = "line", data, xField, yField, seriesField, height = 280, ...rest }) {
  const safe = Array.isArray(data) ? data : [];
  const common = { data: safe, height, autoFit: true, ...rest };

  switch (chartType) {
    case "line":
      return <Line {...common} xField={xField || "x"} yField={yField || "y"} seriesField={seriesField} smooth />;
    case "area":
      return <Area {...common} xField={xField || "x"} yField={yField || "y"} seriesField={seriesField} />;
    case "column":
    case "bar":
      return <Column {...common} xField={xField || "x"} yField={yField || "y"} seriesField={seriesField} />;
    case "pie":
      return (
        <Pie
          {...common}
          angleField={yField || "value"}
          colorField={xField || "type"}
          radius={0.9}
          label={{ type: "inner", offset: "-30%", content: ({ percent }) => `${(percent * 100).toFixed(0)}%` }}
        />
      );
    default:
      return <Line {...common} xField={xField || "x"} yField={yField || "y"} seriesField={seriesField} smooth />;
  }
}

/**
 * Sparkline — мини-график для cardSpec (без осей, компактный).
 * Props: { data: number[] | {x,y}[], width, height }
 */
export function AntdSparkline({ data, height = 40, width = 120, color = "#1677ff" }) {
  const normalized = (data || []).map((v, i) =>
    typeof v === "number" ? { x: i, y: v } : v
  );
  if (normalized.length < 2) return null;

  return (
    <Line
      data={normalized}
      xField="x"
      yField="y"
      height={height}
      width={width}
      autoFit={false}
      smooth
      color={color}
      xAxis={false}
      yAxis={false}
      tooltip={false}
      point={{ size: 0 }}
      padding={[4, 4, 4, 4]}
      theme={{ styleSheet: { brandColor: color } }}
    />
  );
}
