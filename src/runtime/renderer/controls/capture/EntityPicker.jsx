import { useState, useEffect } from "react";
import { registerCaptureWidget } from "./registry.js";

/**
 * EntityPicker — модальный поиск сущностей с серверным backend'ом.
 *
 * Используется для интентов с creates=X и дополнительной entity Y ≠ X,
 * которую нужно выбрать (create_direct_chat: creates Conversation, picker User).
 *
 * Spec прилетает из кристаллизатора (см. controlArchetypes.js::CAPTURE_RULES.entityPicker):
 *   - intentId
 *   - targetEntity: имя сущности для поиска (напр. "User")
 *   - targetCollection: имя коллекции (напр. "users")
 *   - targetAlias: имя параметра в intent entities (напр. "user")
 *
 * Поиск идёт через /api/entities/:collection/search. Fallback — локальный
 * фильтр по ctx.world[collection] если API недоступен.
 *
 * В exec передаёт несколько ключей (alias, alias+"Id") чтобы покрыть
 * разные handler'ы доменов (legacy contactUserId + новый userId).
 */
export default function EntityPicker({ spec, ctx, onClose, overlayContext }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const { targetEntity, targetCollection, targetAlias, intentId } = spec;

  // Серверный поиск с debounce
  useEffect(() => {
    if (!targetCollection) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const domain = ctx.artifact?.domain || "messenger";
        const r = await fetch(
          `/api/entities/${targetCollection}/search?q=${encodeURIComponent(query)}&domain=${domain}`
        );
        if (r.ok) {
          const data = await r.json();
          // Исключаем самого viewer'а (нельзя создать чат с собой)
          const filtered = data.filter(item => item.id !== ctx.viewer?.id);
          setResults(filtered);
        } else {
          throw new Error("API " + r.status);
        }
      } catch {
        // Fallback: локальный поиск по world
        const items = ctx.world?.[targetCollection] || [];
        const queryLower = query.toLowerCase();
        const filtered = items.filter(i => {
          if (i.id === ctx.viewer?.id) return false;
          if (!query) return true;
          const label = i.name || i.title || i.id;
          return typeof label === "string" && label.toLowerCase().includes(queryLower);
        });
        setResults(filtered);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, targetCollection, ctx]);

  const pick = (picked) => {
    const payload = { [targetAlias]: picked.id };
    if (picked.name) payload[targetAlias + "Name"] = picked.name;
    if (picked.title) payload[targetAlias + "Title"] = picked.title;
    if (overlayContext?.item?.id) payload.id = overlayContext.item.id;
    ctx.exec(intentId, payload);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mantine-color-text)", marginBottom: 8 }}>
          Выбрать: {spec.entityLabel || targetEntity || "элемент"}
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск…"
          autoFocus
          style={{
            padding: "10px 12px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border)",
            marginBottom: 12, fontSize: 14, outline: "none", width: "100%",
            boxSizing: "border-box",
          }}
        />
        <div style={{ overflow: "auto", maxHeight: 340, minHeight: 60 }}>
          {loading && (
            <div style={placeholderStyle}>Поиск…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={placeholderStyle}>Ничего не найдено</div>
          )}
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => pick(item)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", textAlign: "left",
                padding: "8px 10px", background: "transparent",
                border: "none", borderBottom: "1px solid var(--mantine-color-default-border)",
                cursor: "pointer", fontSize: 14, color: "var(--mantine-color-text)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--mantine-color-default-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {item.avatar && typeof item.avatar === "string" && item.avatar.startsWith("data:") ? (
                <img src={item.avatar} alt="" style={{
                  width: 28, height: 28, borderRadius: "50%", objectFit: "cover",
                }} />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#6366f1",
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12, fontWeight: 700,
                }}>{((item.name || item.title || "?")[0] || "?").toUpperCase()}</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.name || item.title || item.id}</div>
                {item.email && <div style={{ fontSize: 11, color: "var(--mantine-color-dimmed)" }}>{item.email}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  fontFamily: "system-ui, sans-serif",
};

const modalStyle = {
  background: "var(--mantine-color-body)", borderRadius: 12, padding: 20,
  width: 360, maxWidth: "90vw", maxHeight: "80vh",
  display: "flex", flexDirection: "column",
  boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
};

const placeholderStyle = {
  padding: 12, color: "var(--mantine-color-dimmed)", fontSize: 12, textAlign: "center",
};

registerCaptureWidget({
  id: "entityPicker",
  match: (intent) => {
    if (!intent.creates) return false;
    const entities = (intent.particles?.entities || [])
      .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
    return entities.some(e => e !== intent.creates);
  },
  component: EntityPicker,
});
