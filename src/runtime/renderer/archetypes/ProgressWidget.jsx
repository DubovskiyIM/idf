import { useMemo } from "react";
import { getAdaptedComponent } from "../adapters/registry.js";

/**
 * ProgressWidget — декларативный прогресс-бар для detail-проекции.
 *
 * Spec:
 *   {
 *     type: "quorum",
 *     title: "Кворум",
 *     totalSource: "participants",       // collection фильтруется по foreignKey
 *     currentSource: "votes",            // collection фильтруется по foreignKey
 *     currentDistinct: "participantId",  // distinct count field
 *     foreignKey: "pollId",              // фильтр по target.id для обеих коллекций
 *     waitingField: "name",              // поле для display «ждём кого»
 *   }
 *
 * Runtime:
 *   1. total = count(world[totalSource].filter(x => x[foreignKey] === target.id))
 *   2. votedIds = distinct(world[currentSource].filter(...).map(currentDistinct))
 *   3. current = votedIds.size
 *   4. waiting = total - current, список непроголосовавших из totalSource
 */
export default function ProgressWidget({ spec, target, ctx }) {
  const data = useMemo(() => {
    if (!target?.id) return { total: 0, current: 0, percent: 0, waiting: [] };
    const {
      totalSource, currentSource, currentDistinct,
      foreignKey, waitingField,
    } = spec;
    const world = ctx.world || {};
    const totalItems = (world[totalSource] || []).filter(
      it => !foreignKey || it[foreignKey] === target.id
    );
    const currentItems = (world[currentSource] || []).filter(
      it => !foreignKey || it[foreignKey] === target.id
    );
    const votedIds = new Set(
      currentDistinct
        ? currentItems.map(it => it[currentDistinct]).filter(Boolean)
        : currentItems.map(it => it.id)
    );
    const total = totalItems.length;
    const current = currentDistinct
      ? votedIds.size
      : currentItems.length;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const waiting = currentDistinct
      ? totalItems
          .filter(it => !votedIds.has(it.id))
          .map(it => it[waitingField || "name"] || it.id)
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
