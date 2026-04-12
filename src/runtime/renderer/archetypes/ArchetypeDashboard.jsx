/**
 * ArchetypeDashboard — grid виджетов, каждый — embedded ProjectionRendererV2.
 *
 * Проекция декларирует widgets: [{projection, title, size}].
 * Dashboard рендерит каждый виджет как карточку с ограниченной высотой.
 * Click по заголовку — navigate к полной проекции.
 */
import ProjectionRendererV2 from "../index.jsx";

export default function ArchetypeDashboard({ slots, ctx }) {
  const widgets = slots.body?.widgets || [];
  const { artifacts, allProjections, navigate, world, exec, execBatch, viewer, viewerContext, theme } = ctx;

  if (!artifacts || widgets.length === 0) {
    return <div style={{ padding: 40, color: "var(--mantine-color-dimmed, #9ca3af)", textAlign: "center" }}>Dashboard пуст</div>;
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
      gap: 16,
      padding: 16,
    }}>
      {widgets.map((w, i) => {
        const widgetArtifact = artifacts[w.projection];
        const widgetProjection = allProjections?.[w.projection];
        if (!widgetArtifact) {
          return (
            <div key={i} style={cardStyle}>
              <div style={headerStyle}>{w.title || w.projection}</div>
              <div style={{ padding: 16, color: "var(--mantine-color-dimmed, #9ca3af)", fontSize: 12 }}>
                Проекция "{w.projection}" не найдена
              </div>
            </div>
          );
        }

        const isFull = w.size === "full";
        return (
          <div key={w.projection} style={{ ...cardStyle, gridColumn: isFull ? "1 / -1" : undefined }}>
            <div
              style={headerStyle}
              onClick={() => navigate?.(w.projection, {})}
              title={`Открыть ${w.title || w.projection}`}
            >
              {w.title || widgetProjection?.name || w.projection}
              <span style={{ fontSize: 10, color: "var(--mantine-color-dimmed, #9ca3af)", marginLeft: 8 }}>→</span>
            </div>
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              <ProjectionRendererV2
                artifact={widgetArtifact}
                projection={widgetProjection}
                world={world}
                exec={exec}
                execBatch={execBatch}
                viewer={viewer}
                viewerContext={viewerContext}
                routeParams={{}}
                navigate={navigate}
                theme={theme}
                artifacts={artifacts}
                allProjections={allProjections}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const cardStyle = {
  background: "var(--mantine-color-body, #fff)",
  border: "1px solid var(--mantine-color-default-border, #e5e7eb)",
  borderRadius: 8,
  overflow: "hidden",
};

const headerStyle = {
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--mantine-color-text, #1a1a2e)",
  borderBottom: "1px solid var(--mantine-color-default-border, #e5e7eb)",
  cursor: "pointer",
  userSelect: "none",
};
