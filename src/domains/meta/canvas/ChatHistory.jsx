import React, { useState } from "react";

const STATUS_COLOR = {
  open: "#7c8aff", scheduled: "#daa520",
  closed: "#3fb950", rejected: "#7a7a85",
};

/**
 * Left-rail chat-history. Render'ит BacklogItem'ы как user-сообщения.
 * Composer внизу шлёт `add_backlog_item` через exec(). Это первый
 * primary-write surface мета-домена в UI (Level 2 soft-authoring).
 */
export default function ChatHistory({ items = [], onAdd, viewer }) {
  const [text, setText] = useState("");
  const [section, setSection] = useState("P1");

  function submit() {
    if (!text.trim()) return;
    const title = text.trim().slice(0, 120);
    const description = text.trim().length > 120 ? text.trim() : null;
    onAdd({ section, title, description });
    setText("");
  }

  function onKey(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  // sort newest first для chat-feel
  const sorted = [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRight: "1px solid #2a2a32" }}>
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {sorted.length === 0 && (
          <div style={{ color: "#5a5a64", fontSize: 13, textAlign: "center", marginTop: 60 }}>
            Backlog пуст. Добавь сообщение ниже.
          </div>
        )}
        {sorted.map((item) => (
          <div key={item.id} style={{ marginBottom: 16 }}>
            <div style={{
              background: "#3a3a5e", color: "#e8e8ec", padding: "12px 16px",
              borderRadius: 8, maxWidth: "92%", fontSize: 13, lineHeight: 1.5,
              boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset",
            }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: STATUS_COLOR[item.status] || "#5a5a64",
                  display: "inline-block",
                }} />
                <span style={{ fontSize: 11, color: "#a8a8b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {item.section} · {item.status}
                </span>
              </div>
              <strong style={{ display: "block", marginBottom: 2 }}>{item.title}</strong>
              {item.description && (
                <span style={{ color: "#c8c8d0" }}>{item.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #2a2a32", padding: "12px 16px", background: "#0d0d10" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {["P0", "P1", "P2", "research"].map((s) => (
            <button key={s} onClick={() => setSection(s)} style={{
              padding: "4px 10px", fontSize: 11,
              background: section === s ? "#3a3a5e" : "transparent",
              color: section === s ? "#e8e8ec" : "#9f9faa",
              border: "1px solid #2a2a32", borderRadius: 12,
              cursor: "pointer", fontFamily: "inherit",
            }}>{s}</button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Сообщение… (⌘+Enter)"
          rows={3}
          style={{
            width: "100%", background: "#1a1a20", color: "#e8e8ec",
            border: "1px solid #2a2a32", borderRadius: 6, padding: 10,
            fontSize: 13, fontFamily: "inherit", resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          style={{
            marginTop: 8, padding: "10px 24px", width: "100%",
            background: "#3a3a5e", color: "#e8e8ec",
            border: "none", borderRadius: 6, fontSize: 14,
            cursor: text.trim() ? "pointer" : "not-allowed",
            opacity: text.trim() ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
