/**
 * CatalogTree — левая панель split-pane catalog-explorer (U2.1).
 *
 * Tabs (Relational / Messaging / Fileset / Model) фильтруют catalogs по
 * `catalog.type`. Search input фильтрует видимые catalogs по подстроке name.
 * Клик по catalog узлу вызывает onSelect(catalog).
 *
 * Sub-tree (schemas внутри catalog) пока не рендерим — в U2.3 после
 * lazy-loading children.
 */
import { useMemo, useState } from "react";

const TABS = [
  { key: "relational", label: "Relational" },
  { key: "messaging",  label: "Messaging" },
  { key: "fileset",    label: "Fileset" },
  { key: "model",      label: "Model" },
];

export default function CatalogTree({ catalogs = [], metalakeId, onSelect = () => {} }) {
  const [activeTab, setActiveTab] = useState("relational");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const byScope = catalogs.filter(c => c.metalakeId === metalakeId && c.type === activeTab);
    if (!search.trim()) return byScope;
    const needle = search.trim().toLowerCase();
    return byScope.filter(c => (c.name || "").toLowerCase().includes(needle));
  }, [catalogs, metalakeId, activeTab, search]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      borderRight: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fafafa)",
      minWidth: 0,
    }}>
      <div role="tablist" style={{
        display: "flex", borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      }}>
        {TABS.map(tab => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: "8px 4px", fontSize: 12,
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--idf-primary, #6478f7)" : "2px solid transparent",
                color: active ? "var(--idf-primary, #6478f7)" : "var(--idf-text-muted, #868e96)",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
            >{tab.label}</button>
          );
        })}
      </div>
      <div style={{ padding: 8 }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            width: "100%", padding: "6px 8px", fontSize: 12,
            border: "1px solid var(--idf-border, #e5e7eb)",
            borderRadius: 4,
            background: "var(--idf-surface, #fff)",
            color: "var(--idf-text)",
            boxSizing: "border-box",
          }}
        />
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 4px", overflow: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <li style={{ padding: "8px 12px", fontSize: 12, color: "var(--idf-text-muted)" }}>
            Нет каталогов
          </li>
        ) : filtered.map(cat => (
          <li key={cat.id}>
            <button
              type="button"
              onClick={() => onSelect(cat)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "6px 12px",
                background: "transparent",
                border: "none", borderRadius: 4,
                fontSize: 13, color: "var(--idf-text)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--idf-text-muted)" }}>▸</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cat.name}
              </span>
              <span style={{ fontSize: 10, color: "var(--idf-text-muted)" }}>
                {cat.provider}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
