/**
 * MarketLineCanvas — линейный график marketSignals по времени.
 * Показывает агрегат по kind (price/volume/sentiment/fuzzy_risk).
 */

import { useMemo, useState } from "react";
import { Chart, getAdaptedComponent } from "@intent-driven/renderer";

export default function MarketLineCanvas({ world }) {
  const signals = (world?.marketSignals || []).slice().sort((a, b) => a.timestamp - b.timestamp);
  const [kind, setKind] = useState("sentiment");

  const data = useMemo(() => {
    return signals
      .filter(s => s.kind === kind)
      .slice(-40)
      .map((s, i) => ({
        x: i,
        y: Number(s.value) || 0,
        assetId: s.assetId,
        ts: s.timestamp,
      }));
  }, [signals, kind]);

  const AdaptedHeading = getAdaptedComponent("primitive", "heading") || (({ children }) => <h3>{children}</h3>);
  const AdaptedPaper = getAdaptedComponent("primitive", "paper") || (({ children }) => <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>{children}</div>);

  const kinds = ["price", "volume", "sentiment", "fuzzy_risk"];

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <AdaptedHeading level={2}>Тренды рынка</AdaptedHeading>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {kinds.map(k => (
          <button
            key={k}
            onClick={() => setKind(k)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
              border: "1px solid",
              borderColor: kind === k ? "var(--mantine-color-indigo-6, #6366f1)" : "var(--mantine-color-default-border, #d1d5db)",
              background: kind === k ? "var(--mantine-color-indigo-6, #6366f1)" : "transparent",
              color: kind === k ? "#fff" : "var(--mantine-color-text, #111)",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <AdaptedPaper>
        {data.length < 2 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
            Недостаточно данных. Запусти <code>npm run invest-ml</code> или <code>npm run invest-fuzzy</code> — поток сигналов начнёт заполняться.
          </div>
        ) : (
          <Chart
            node={{
              chartType: "line",
              data,
              xField: "x",
              yField: "y",
              height: 320,
            }}
            ctx={{ world }}
          />
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          Последних сигналов: {data.length} из {signals.length} всего (категория: {kind})
        </div>
      </AdaptedPaper>
    </div>
  );
}
