import { useMemo } from "react";
import { getAdaptedComponent } from "../adapters/registry.js";
import { computeWitness } from "../eval.js";

/**
 * ProgressWidget — декларативный прогресс-бар для detail-проекции.
 *
 * Поддерживает два формата spec:
 *
 * 1. Computed witness (новый):
 *    { compute: "ratio(...)", field: "voteRatio", display: "progress", waitingField: "name" }
 *
 * 2. Legacy quorum (обратная совместимость):
 *    { type: "quorum", totalSource, currentSource, currentDistinct, foreignKey, waitingField }
 */
export default function ProgressWidget({ spec, target, ctx }) {
  const data = useMemo(() => {
    if (!target?.id) return { total: 0, current: 0, percent: 0, waiting: [] };
    const world = ctx.world || {};

    if (spec.compute) {
      // Новый формат: computed witness
      const ratio = computeWitness(spec.compute, target.id, world);
      if (ratio == null) return { total: 0, current: 0, percent: 0, waiting: [] };

      // Waiting list: извлекаем коллекции из ratio() выражения
      const m = spec.compute.match(/^ratio\((\w+)\.(\w+),\s*(\w+),\s*(\w+)=target\.id\)$/);
      if (!m) return { total: 0, current: 0, percent: Math.round(ratio * 100), waiting: [] };

      const [, collection, distinctField, totalCollection, fkField] = m;
      const totalItems = (world[totalCollection] || []).filter(it => it[fkField] === target.id);
      const currentItems = (world[collection] || []).filter(it => it[fkField] === target.id);
      const votedIds = new Set(currentItems.map(it => it[distinctField]).filter(Boolean));
      const total = totalItems.length;
      const current = votedIds.size;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      const waiting = spec.waitingField
        ? totalItems.filter(it => !votedIds.has(it.id)).map(it => it[spec.waitingField] || it.id)
        : [];
      return { total, current, percent, waiting };
    }

    // Legacy формат: type: "quorum"
    const { totalSource, currentSource, currentDistinct, foreignKey, waitingField } = spec;
    const totalItems = (world[totalSource] || []).filter(it => !foreignKey || it[foreignKey] === target.id);
    const currentItems = (world[currentSource] || []).filter(it => !foreignKey || it[foreignKey] === target.id);
    const votedIds = new Set(
      currentDistinct
        ? currentItems.map(it => it[currentDistinct]).filter(Boolean)
        : currentItems.map(it => it.id)
    );
    const total = totalItems.length;
    const current = currentDistinct ? votedIds.size : currentItems.length;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const waiting = currentDistinct
      ? totalItems.filter(it => !votedIds.has(it.id)).map(it => it[waitingField || "name"] || it.id)
      : [];
    return { total, current, percent, waiting };
  }, [spec, target, ctx.world]);

  const AdaptedPaper = getAdaptedComponent("primitive", "paper");
  const Wrapper = AdaptedPaper
    ? ({ children }) => <AdaptedPaper padding="md">{children}</AdaptedPaper>
    : ({ children }) => (
      <div style={{
        padding: 14,
        background: "#f9fafb",
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 12,
      }}>{children}</div>
    );

  return (
    <Wrapper>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--mantine-color-text)" }}>
          {spec.title || "Прогресс"}: {data.current}/{data.total} ({data.percent}%)
        </div>
      </div>
      <div style={{
        width: "100%", height: 8, borderRadius: 4,
        background: "var(--mantine-color-default-border)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${data.percent}%`, height: "100%",
          background: "var(--mantine-color-indigo-6)",
          transition: "width 0.2s ease",
        }} />
      </div>
      {data.waiting.length > 0 && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
          Ждём: {data.waiting.slice(0, 5).join(", ")}
          {data.waiting.length > 5 && ` и ещё ${data.waiting.length - 5}`}
        </div>
      )}
    </Wrapper>
  );
}
