// XrayHUD — host-level floating панель для X-ray режима PatternInspector.
//
// SDK renderer (0.25.0) оборачивает overlay только для slots.sections[N]. Для
// атрибуций на header/toolbar/overlay/_voteGroups/body визуальной подсветки
// нет (см. session-backlog: «SDK renderer X-ray coverage beyond sections»).
//
// HUD показывает полный attribution-map на overlay-уровне хоста: автор видит
// все derived-слоты, даже если renderer их не подсвечивает. Ссылка «Open in
// Graph3D» ведёт в Studio #graph/focus с нужным patternId.
//
// Удалится (или упростится) после того, как SDK renderer получит broader
// X-ray coverage.

export default function XrayHUD({ xrayState }) {
  if (!xrayState?.active) return null;
  const attribution = xrayState.attribution || {};
  const entries = Object.entries(attribution);
  if (entries.length === 0) {
    return (
      <aside style={hudStyle}>
        <header style={headerStyle}>
          <b style={{ fontSize: 12 }}>X-ray</b>
          <span style={{ color: "#888", fontSize: 11 }}>
            нет derived-слотов для этой проекции
          </span>
        </header>
      </aside>
    );
  }

  // Группировка по patternId: часто один pattern мутирует несколько полей
  // одной части (overlay[0].warning + overlay[0].label и т.п.).
  const byPattern = entries.reduce((acc, [path, entry]) => {
    const key = entry.patternId;
    if (!acc[key]) acc[key] = [];
    acc[key].push({ path, action: entry.action });
    return acc;
  }, {});

  return (
    <aside style={hudStyle}>
      <header style={headerStyle}>
        <b style={{ fontSize: 12 }}>X-ray — {entries.length} slot(s)</b>
        <span style={{ color: "#888", fontSize: 10 }}>
          host HUD (SDK renderer подсвечивает только sections[N])
        </span>
      </header>
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {Object.entries(byPattern).map(([patternId, paths]) => (
          <div key={patternId} style={patternBlockStyle}>
            <div style={patternHeaderStyle}>
              <span style={{ fontSize: 11, color: "#fbbf24" }}>◆</span>
              <code style={{ fontSize: 11, fontWeight: 600 }}>{patternId}</code>
              {xrayState.domain && (
                <a
                  href={`/studio.html#graph/focus?domain=${encodeURIComponent(xrayState.domain)}&pattern=${encodeURIComponent(patternId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                  title="Открыть pattern-узел в Graph3D"
                >
                  Graph ↗
                </a>
              )}
            </div>
            {paths.map(({ path, action }) => (
              <div key={path} style={pathRowStyle}>
                <span style={actionBadgeStyle[action] || actionBadgeStyle.default}>
                  {action}
                </span>
                <code style={{ fontSize: 10, color: "#ccc" }}>{path}</code>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

const hudStyle = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 9999,
  background: "#1f2937",
  color: "#e5e7eb",
  border: "1px solid #fbbf24",
  borderRadius: 8,
  padding: "10px 12px",
  width: 340,
  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const headerStyle = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  paddingBottom: 8,
  marginBottom: 8,
  borderBottom: "1px solid #374151",
  flexWrap: "wrap",
};

const patternBlockStyle = {
  marginBottom: 8,
  paddingBottom: 6,
  borderBottom: "1px dashed #374151",
};

const patternHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 4,
};

const linkStyle = {
  marginLeft: "auto",
  fontSize: 10,
  color: "#60a5fa",
  textDecoration: "none",
};

const pathRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 0 2px 14px",
};

const actionBadgeStyle = {
  added: {
    fontSize: 9,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 3,
    background: "#065f46",
    color: "#a7f3d0",
    letterSpacing: 0.3,
  },
  modified: {
    fontSize: 9,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 3,
    background: "#78350f",
    color: "#fed7aa",
    letterSpacing: 0.3,
  },
  default: {
    fontSize: 9,
    padding: "1px 5px",
    borderRadius: 3,
    background: "#374151",
    color: "#9ca3af",
  },
};
