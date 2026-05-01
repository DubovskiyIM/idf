/**
 * CatalogTree — расширенная версия (U2.3): nested children до
 * schema / table / fileset / topic / model уровней.
 *
 * Tabs (Relational / Messaging / Fileset / Model) фильтруют catalogs по
 * `catalog.type`. Каждый catalog узел expandable → schemas (для relational/
 * fileset/model) или topics напрямую (для messaging). Каждый schema
 * expandable → tables / filesets / models (в зависимости от parent catalog
 * type). Click по любому узлу вызывает onSelect(entityObject).
 *
 * Search фильтрует по подстроке name на catalog-level (как в U2.1);
 * deep-search через все уровни — backlog (U2.4).
 */
import { useMemo, useState } from "react";

const TABS = [
  { key: "relational", label: "Relational" },
  { key: "messaging",  label: "Messaging" },
  { key: "fileset",    label: "Fileset" },
  { key: "model",      label: "Model" },
];

// Какие children показывать у catalog в зависимости от type catalog'а.
function getCatalogChildren(catalog, world) {
  if (catalog.type === "messaging") {
    // messaging — topics напрямую под catalog
    return {
      kind: "topic",
      items: (world.topics || []).filter(t => t.catalogId === catalog.id),
    };
  }
  return {
    kind: "schema",
    items: (world.schemas || []).filter(s => s.catalogId === catalog.id),
  };
}

// Возвращает массив групп { kind, items[] } — relational schema может
// содержать одновременно tables и functions (U6.2).
function getSchemaChildren(schema, catalog, world) {
  switch (catalog.type) {
    case "relational":
      return [
        { kind: "table",    items: (world.tables    || []).filter(t => t.schemaId === schema.id) },
        { kind: "function", items: (world.functions || []).filter(f => f.schemaId === schema.id) },
      ].filter(g => g.items.length > 0);
    case "fileset":
      return [{ kind: "fileset", items: (world.filesets || []).filter(f => f.schemaId === schema.id) }];
    case "model":
      return [{ kind: "model", items: (world.models || []).filter(m => m.schemaId === schema.id) }];
    default:
      return [];
  }
}

const KIND_ICON = {
  schema: "📂",
  table: "🗒",
  fileset: "📁",
  topic: "📡",
  model: "🤖",
  function: "𝑓",
};

const STORAGE_KEY = "gravitino-tree-expanded";

function loadExpanded() {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function saveExpanded(set) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* quota / private mode */ }
}

export default function CatalogTree({ catalogs = [], world = {}, metalakeId, onSelect = () => {} }) {
  const [activeTab, setActiveTab] = useState("relational");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(loadExpanded);

  const toggle = (nodeId) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    saveExpanded(next);
    return next;
  });

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
      <div role="tablist" style={{ display: "flex", borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
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
                flex: 1, padding: "8px 4px", fontSize: 12, background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--idf-primary, #6478f7)" : "2px solid transparent",
                color: active ? "var(--idf-primary, #6478f7)" : "var(--idf-text-muted, #868e96)",
                fontWeight: active ? 600 : 400, cursor: "pointer",
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
            border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
            background: "var(--idf-surface, #fff)", color: "var(--idf-text)",
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
          <CatalogNode
            key={cat.id}
            catalog={cat}
            world={world}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

function CatalogNode({ catalog, world, depth, expanded, toggle, onSelect }) {
  const nodeId = `catalog:${catalog.id}`;
  const isOpen = expanded.has(nodeId);
  const { kind, items: children } = getCatalogChildren(catalog, world);
  const hasChildren = children.length > 0;

  return (
    <li>
      <Row
        nodeId={nodeId}
        depth={depth}
        hasChildren={hasChildren}
        isOpen={isOpen}
        toggle={toggle}
        label={catalog.name}
        rightLabel={catalog.provider}
        onClick={() => onSelect(catalog)}
      />
      {isOpen && hasChildren && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {kind === "topic"
            ? children.map(t => (
                <LeafNode key={t.id} item={t} kind="topic" depth={depth + 1} onSelect={onSelect} />
              ))
            : children.map(schema => (
                <SchemaNode
                  key={schema.id}
                  schema={schema}
                  catalog={catalog}
                  world={world}
                  depth={depth + 1}
                  expanded={expanded}
                  toggle={toggle}
                  onSelect={onSelect}
                />
              ))}
        </ul>
      )}
    </li>
  );
}

function SchemaNode({ schema, catalog, world, depth, expanded, toggle, onSelect }) {
  const nodeId = `schema:${schema.id}`;
  const isOpen = expanded.has(nodeId);
  const groups = getSchemaChildren(schema, catalog, world);
  const hasChildren = groups.some(g => g.items.length > 0);
  return (
    <li>
      <Row
        nodeId={nodeId}
        depth={depth}
        hasChildren={hasChildren}
        isOpen={isOpen}
        toggle={toggle}
        icon={KIND_ICON.schema}
        label={schema.name}
        onClick={() => onSelect(schema)}
      />
      {isOpen && hasChildren && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {groups.flatMap(group =>
            group.items.map(item => (
              <LeafNode key={`${group.kind}:${item.id}`} item={item} kind={group.kind} depth={depth + 1} onSelect={onSelect} />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function LeafNode({ item, kind, depth, onSelect }) {
  return (
    <li>
      <Row
        nodeId={`${kind}:${item.id}`}
        depth={depth}
        hasChildren={false}
        icon={KIND_ICON[kind]}
        label={item.name}
        onClick={() => onSelect(item)}
      />
    </li>
  );
}

function Row({ nodeId, depth, hasChildren, isOpen, toggle, icon, label, rightLabel, onClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingLeft: depth * 14 }}>
      {hasChildren ? (
        <button
          type="button"
          aria-label={`expand-${nodeId}`}
          onClick={(e) => { e.stopPropagation(); toggle(nodeId); }}
          style={{
            width: 18, height: 18, padding: 0, border: "none", background: "transparent",
            cursor: "pointer", color: "var(--idf-text-muted)", fontSize: 11,
          }}
        >{isOpen ? "▾" : "▸"}</button>
      ) : (
        <span style={{ width: 18, display: "inline-block" }} />
      )}
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          flex: 1, padding: "4px 8px",
          background: "transparent", border: "none", borderRadius: 4,
          fontSize: 13, color: "var(--idf-text)",
          cursor: "pointer", textAlign: "left",
        }}
      >
        {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {rightLabel && (
          <span style={{ fontSize: 10, color: "var(--idf-text-muted)" }}>{rightLabel}</span>
        )}
      </button>
    </div>
  );
}
