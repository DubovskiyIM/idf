/**
 * SetOwnerDialog — modal cascader для назначения owner на metalake/catalog (U5).
 *
 * Tabs Users / Groups (current owner может быть user-name ИЛИ group-name).
 * Search-input фильтрует видимый список. Click по row → выбран. Apply
 * вызывает onSubmit({kind: "user"|"group", name}). Reset state on close.
 */
import { useEffect, useState } from "react";

export default function SetOwnerDialog({
  visible,
  currentOwner,
  users = [],
  groups = [],
  onClose = () => {},
  onSubmit = () => {},
}) {
  const [tab, setTab] = useState("user");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(null); // { kind, name } | null

  useEffect(() => {
    if (!visible) {
      setTab("user"); setSearch(""); setPicked(null);
    }
  }, [visible]);

  if (!visible) return null;

  const items = tab === "user" ? users : groups;
  const visibleItems = search.trim()
    ? items.filter(it => (it.name || "").toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  const submit = () => {
    if (!picked) return;
    onSubmit(picked);
  };

  return (
    <div
      role="dialog"
      aria-label="Set Owner"
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--idf-card, #fff)",
          color: "var(--idf-text)",
          border: "1px solid var(--idf-border, #e5e7eb)",
          borderRadius: 8, padding: 18,
          width: 380, maxHeight: "70vh", display: "flex", flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Set Owner</h3>
        {currentOwner && (
          <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginBottom: 10 }}>
            {`Текущий: ${currentOwner}`}
          </div>
        )}

        <div role="tablist" style={{ display: "flex", borderBottom: "1px solid var(--idf-border, #e5e7eb)", marginBottom: 8 }}>
          {[{ key: "user", label: "Users" }, { key: "group", label: "Groups" }].map(t => {
            const sel = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={sel}
                aria-label={t.label}
                onClick={() => { setTab(t.key); setPicked(null); }}
                style={{
                  flex: 1, padding: "6px 4px", fontSize: 12,
                  background: "transparent", border: "none",
                  borderBottom: sel ? "2px solid var(--idf-primary, #6478f7)" : "2px solid transparent",
                  color: sel ? "var(--idf-primary, #6478f7)" : "var(--idf-text-muted)",
                  fontWeight: sel ? 600 : 400, cursor: "pointer",
                }}
              >{t.label}</button>
            );
          })}
        </div>

        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            width: "100%", padding: "5px 8px", fontSize: 12, marginBottom: 8,
            border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
            background: "var(--idf-surface, #fff)", color: "var(--idf-text)",
            boxSizing: "border-box",
          }}
        />

        <div style={{ flex: 1, overflow: "auto", marginBottom: 10, minHeight: 80 }}>
          {visibleItems.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--idf-text-muted)", padding: 8 }}>Нет вариантов</div>
          ) : visibleItems.map(it => {
            const isPicked = picked && picked.kind === tab && picked.name === it.name;
            return (
              <div
                key={it.id}
                onClick={() => setPicked({ kind: tab, name: it.name })}
                style={{
                  padding: "5px 8px", fontSize: 12, cursor: "pointer", borderRadius: 4,
                  background: isPicked ? "rgba(100,120,247,0.18)" : "transparent",
                  color: isPicked ? "var(--idf-primary, #6478f7)" : "var(--idf-text)",
                  fontWeight: isPicked ? 600 : 400,
                }}
              >{it.name}</div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "5px 12px", fontSize: 11, borderRadius: 4,
              border: "1px solid var(--idf-border)", background: "transparent",
              cursor: "pointer", color: "var(--idf-text-muted)",
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!picked}
            style={{
              padding: "5px 12px", fontSize: 11, borderRadius: 4, fontWeight: 600,
              border: "1px solid var(--idf-primary, #6478f7)",
              background: picked ? "var(--idf-primary, #6478f7)" : "rgba(100,120,247,0.4)",
              color: "white", cursor: picked ? "pointer" : "not-allowed",
            }}
          >Apply</button>
        </div>
      </div>
    </div>
  );
}
