/**
 * AssociatePopover — multiselect-popover для associate Tag/Policy на entity (U2.5).
 *
 * Используется в CatalogsTable (Tags/Policies колонки). Available items
 * (tag/policy объекты с id+name) приходят props'ом; selected — массив
 * "name"-strings (не id, потому что catalog.tags/policies хранят names —
 * паттерн web-v2). On-Apply отдаёт обновлённый массив names.
 */
import { useMemo, useState } from "react";

export default function AssociatePopover({
  title = "Associate",
  available = [],
  selected = [],
  onApply = () => {},
  onClose = () => {},
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(() => new Set(selected));

  const visible = useMemo(() => {
    if (!search.trim()) return available;
    const needle = search.trim().toLowerCase();
    return available.filter(it => (it.name || "").toLowerCase().includes(needle));
  }, [available, search]);

  const toggle = (name) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const submit = () => onApply(Array.from(picked));

  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        minWidth: 240, maxWidth: 320,
        background: "var(--idf-card, #fff)",
        border: "1px solid var(--idf-border, #e5e7eb)",
        borderRadius: 8, padding: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        color: "var(--idf-text)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{title}</div>
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search..."
        style={{
          width: "100%", padding: "5px 8px", fontSize: 12, marginBottom: 8,
          border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
          background: "var(--idf-surface, #fff)",
          color: "var(--idf-text)",
          boxSizing: "border-box",
        }}
      />
      <div style={{ maxHeight: 200, overflow: "auto", marginBottom: 10 }}>
        {visible.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--idf-text-muted)", padding: 4 }}>Нет вариантов</div>
        ) : visible.map(it => (
          <label key={it.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 6px", fontSize: 12, cursor: "pointer", borderRadius: 4,
          }}>
            <input
              type="checkbox"
              aria-label={it.name}
              checked={picked.has(it.name)}
              onChange={() => toggle(it.name)}
            />
            <span>{it.name}</span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 11,
            border: "1px solid var(--idf-border)", background: "transparent",
            cursor: "pointer", color: "var(--idf-text-muted)",
          }}
        >Cancel</button>
        <button
          type="button"
          onClick={submit}
          style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 11,
            border: "1px solid var(--idf-primary, #6478f7)",
            background: "var(--idf-primary, #6478f7)", color: "white",
            cursor: "pointer", fontWeight: 600,
          }}
        >Apply</button>
      </div>
    </div>
  );
}
