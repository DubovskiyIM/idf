/**
 * FilesetDetailPane — tabbed view для fileset (U6.2).
 * Tabs: Files / Properties. Files tab — список из world.fileset_files
 * filtered by filesetId (mock в seed; real listFiles intent — U6.5).
 */
import { useState } from "react";
import { IllustratedEmptyState as EmptyState } from "@intent-driven/renderer";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "files", label: "Files" },
  { key: "properties", label: "Properties" },
];

export default function FilesetDetailPane({ fileset, world = {} }) {
  const [active, setActive] = useState("files");
  const files = (world.fileset_files || []).filter(f => f.filesetId === fileset.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={fileset.name} location={fileset.storageLocation} subtitle={fileset.comment} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "files"      && <FilesTable files={files} />}
          {active === "properties" && <PropsTable obj={fileset.properties} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ name, location, subtitle }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</span>
        {location && (
          <code style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4,
            background: "var(--idf-bg-subtle, #f9fafb)", color: "var(--idf-primary, #6478f7)",
          }}>{location}</code>
        )}
      </div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function FilesTable({ files }) {
  if (files.length === 0) {
    return <EmptyState icon="files" title="Нет файлов" description="Этот fileset пуст или ещё не индексирован." />;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
          <th style={cellStyle}>Path</th>
          <th style={{ ...cellStyle, textAlign: "right" }}>Size</th>
          <th style={cellStyle}>Modified</th>
        </tr>
      </thead>
      <tbody>
        {files.map(f => (
          <tr key={f.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 12 }}>{f.path}</td>
            <td style={{ ...cellStyle, textAlign: "right", color: "var(--idf-text-muted)" }}>{formatSize(f.size)}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{formatDate(f.modifiedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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

function formatSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
