/**
 * AllocationPieCanvas — пирог целевой аллокации портфелей.
 *
 * Использует chart-primitive (kind: "pie") → адаптер резолвит
 * @ant-design/plots Pie или SVG-fallback.
 */

import { Chart } from "../../../runtime/renderer/primitives/chart.jsx";
import { getAdaptedComponent } from "../../../runtime/renderer/adapters/registry.js";

export default function AllocationPieCanvas({ world }) {
  const portfolios = (world?.portfolios || []).filter(p => !p.userId || true);

  const AdaptedHeading = getAdaptedComponent("primitive", "heading") || (({ children }) => <h3>{children}</h3>);
  const AdaptedPaper = getAdaptedComponent("primitive", "paper") || (({ children, style }) => <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, ...(style || {}) }}>{children}</div>);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000, margin: "0 auto" }}>
      <AdaptedHeading level={2}>Целевая аллокация</AdaptedHeading>

      {portfolios.length === 0 && <div style={{ color: "#9ca3af" }}>Пока нет портфелей</div>}

      {portfolios.map(p => {
        const data = [
          { type: "Акции", value: p.targetStocks || 0 },
          { type: "Облигации", value: p.targetBonds || 0 },
          { type: "Крипто", value: p.targetCrypto || 0 },
          { type: "Экзотика", value: p.targetExotic || 0 },
        ].filter(d => d.value > 0);

        return (
          <AdaptedPaper key={p.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <strong>{p.name}</strong>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {p.baseCurrency} · {p.riskProfile}
              </span>
            </div>
            <Chart
              node={{
                chartType: "pie",
                data,
                xField: "type",
                yField: "value",
                height: 240,
              }}
              ctx={{ world }}
            />
          </AdaptedPaper>
        );
      })}
    </div>
  );
}
