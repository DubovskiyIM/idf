/**
 * ModelDetailPane — tabbed detail view для model (U6.1 + U-detail-polish, C9).
 *
 * Tabs: Versions / Properties.
 * Versions tab — таблица (Version / Model Object / Aliases / Properties / Actions)
 * + кнопка «+ Link Version». Aliases — chips. Properties (per version) —
 * inline JSON-snippet (compact). Actions per row: ✎ Edit Aliases (inline modal)
 * + 🗑 Unlink (ConfirmDialog с typed-version match).
 */
import { useState } from "react";
import { IllustratedEmptyState as EmptyState } from "@intent-driven/renderer";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "versions", label: "Versions" },
  { key: "properties", label: "Properties" },
];

export default function ModelDetailPane({
  model,
  world = {},
  onLinkVersion = () => {},
  onUnlinkVersion = () => {},
  onEditAliases = () => {},
}) {
  const [active, setActive] = useState("versions");
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [editAliasTarget, setEditAliasTarget] = useState(null);

  const versions = (world.model_versions || [])
    .filter(v => v.modelId === model.id)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={model.name} subtitle={model.comment} latestVersion={model.latestVersion} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "versions"   && (
            <VersionsTable
              versions={versions}
              onLinkVersion={onLinkVersion}
              onRequestUnlink={setUnlinkTarget}
              onRequestEditAlias={setEditAliasTarget}
            />
          )}
          {active === "properties" && <PropsTable obj={model.properties} />}
        </Tabs>
      </div>
      <ConfirmDialog
        visible={!!unlinkTarget}
        entityName={unlinkTarget ? `v${unlinkTarget.version}` : ""}
        entityKind="version"
        confirmLabel="Unlink"
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={() => { onUnlinkVersion(unlinkTarget.id); setUnlinkTarget(null); }}
      />
      {editAliasTarget && (
        <EditAliasesModal
          version={editAliasTarget}
          onClose={() => setEditAliasTarget(null)}
          onSave={(aliases) => { onEditAliases(editAliasTarget.id, aliases); setEditAliasTarget(null); }}
        />
      )}
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

function VersionsTable({ versions, onLinkVersion, onRequestUnlink, onRequestEditAlias }) {
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
        <EmptyState
          icon="versions"
          title="Нет версий"
          description="Свяжите первую model version через Link Version."
          actionLabel="+ Link Version"
          onAction={onLinkVersion}
        />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead>
            <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
              <th style={cellStyle}>Version</th>
              <th style={cellStyle}>Model Object</th>
              <th style={cellStyle}>Aliases</th>
              <th style={cellStyle}>Properties</th>
              <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
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
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button"
                    onClick={() => onRequestEditAlias(v)}
                    aria-label={`Edit aliases v${v.version}`}
                    title="Edit aliases"
                    style={iconBtn("var(--idf-text-muted)")}
                  >✎</button>
                  <button type="button"
                    onClick={() => onRequestUnlink(v)}
                    aria-label={`Unlink v${v.version}`}
                    title="Unlink"
                    style={iconBtn("#FF3E1D")}
                  >🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EditAliasesModal({ version, onClose, onSave }) {
  const [val, setVal] = useState((version.aliases || []).join(", "));
  return (
    <div role="dialog" aria-label="Edit aliases" style={modalBackdropStyle} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={modalContentStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--idf-text)" }}>
          Edit aliases — v{version.version}
        </h3>
        <label
          htmlFor="aliases-input"
          style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: 600, color: "var(--idf-text)" }}
        >Aliases</label>
        <input
          id="aliases-input"
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="staging, production, candidate"
          style={{
            display: "block", width: "100%", padding: "6px 8px", fontSize: 13,
            border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
            background: "var(--idf-surface, #fff)", color: "var(--idf-text)",
            boxSizing: "border-box", marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose}
            style={{
              padding: "6px 14px", fontSize: 12,
              border: "1px solid var(--idf-border, #e5e7eb)",
              background: "transparent", color: "var(--idf-text-muted)",
              borderRadius: 4, cursor: "pointer",
            }}
          >Cancel</button>
          <button type="button"
            onClick={() => onSave(val.split(",").map(a => a.trim()).filter(Boolean))}
            style={{
              padding: "6px 16px", fontSize: 12, fontWeight: 600,
              border: "1px solid var(--idf-primary, #6478f7)",
              background: "var(--idf-primary, #6478f7)", color: "white",
              borderRadius: 4, cursor: "pointer",
            }}
          >Save</button>
        </div>
      </div>
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

const iconBtn = (color) => ({
  background: "transparent", border: "none", cursor: "pointer",
  color, padding: "0 6px", fontSize: 13,
});

const modalBackdropStyle = {
  position: "fixed", inset: 0, zIndex: 250,
  background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const modalContentStyle = {
  background: "var(--idf-card, #fff)", color: "var(--idf-text)",
  border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 8,
  padding: 20, width: 400, boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
};
