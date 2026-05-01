/**
 * ModelDetailPane — tabbed detail view для model (U6.1).
 *
 * Tabs: Versions / Properties.
 * Versions tab — таблица (Version / Model Object / Aliases / Properties)
 * + кнопка «+ Link Version». Aliases — chips. Properties (per version) —
 * inline JSON-snippet (compact).
 */
import { useState } from "react";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "versions", label: "Versions" },
  { key: "properties", label: "Properties" },
];

export default function ModelDetailPane({ model, world = {}, onLinkVersion = () => {} }) {
  const [active, setActive] = useState("versions");
  const versions = (world.model_versions || [])
    .filter(v => v.modelId === model.id)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={model.name} subtitle={model.comment} latestVersion={model.latestVersion} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "versions"   && <VersionsTable versions={versions} onLinkVersion={onLinkVersion} />}
          {active === "properties" && <PropsTable obj={model.properties} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ name, subtitle, latestVersion }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", alignItems: "baseline", gap: 12,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
      {latestVersion != null && (
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 4,
          background: "rgba(100,120,247,0.18)", color: "var(--idf-primary, #6478f7)",
          fontWeight: 600,
        }}>latest v{latestVersion}</span>
      )}
      {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>{subtitle}</div>}
    </div>
  );
}

function VersionsTable({ versions, onLinkVersion }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          type="button"
          onClick={onLinkVersion}
          style={{
            padding: "6px 14px", fontSize: 12, fontWeight: 600,
            border: "1px solid var(--idf-primary, #6478f7)",
            background: "var(--idf-primary, #6478f7)", color: "white",
            borderRadius: 4, cursor: "pointer",
          }}
        >+ Link Version</button>
      </div>
      {versions.length === 0 ? (
        <Empty>Нет версий</Empty>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead>
            <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
              <th style={cellStyle}>Version</th>
              <th style={cellStyle}>Model Object</th>
              <th style={cellStyle}>Aliases</th>
              <th style={cellStyle}>Properties</th>
            </tr>
          </thead>
          <tbody>
            {versions.map(v => (
              <tr key={v.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={{ ...cellStyle, fontWeight: 500 }}>v{v.version}</td>
                <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 11, color: "var(--idf-text)" }}>{v.modelObject}</td>
                <td style={cellStyle}>
                  {(v.aliases || []).length === 0 ? (
                    <span style={{ color: "var(--idf-text-muted)" }}>—</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {v.aliases.map(a => (
                        <span key={a} style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 11,
                          background: "rgba(100,120,247,0.18)", color: "var(--idf-primary, #6478f7)",
                          fontWeight: 500,
                        }}>{a}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace", fontSize: 11 }}>
                  {Object.keys(v.properties || {}).length === 0 ? "—" : JSON.stringify(v.properties)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PropsTable({ obj }) {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) return <Empty>Properties пусты</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500, width: 200 }}>{k}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace" }}>{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
