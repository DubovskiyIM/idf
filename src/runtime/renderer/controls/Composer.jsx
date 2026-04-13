import { useState, useRef } from "react";

export default function Composer({ spec, ctx }) {
  const [text, setText] = useState("");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const pendingAttachRef = useRef(null);

  const replyContext = ctx.composerMode?.type === "reply" ? ctx.composerMode : null;

  const submit = () => {
    if (!text.trim()) return;
    const params = { [spec.primaryParameter]: text };
    // Reply mode: подставляем replyToId и используем reply intent
    if (replyContext) {
      ctx.exec(replyContext.intentId || "reply_to_message", {
        ...params,
        replyToId: replyContext.messageId,
      });
      ctx.setComposerMode?.(null);
    } else {
      ctx.exec(spec.primaryIntent, params);
    }
    setText("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && replyContext) {
      ctx.setComposerMode?.(null);
    }
  };

  const handleAttach = (attachIntentId) => {
    setAttachMenuOpen(false);
    pendingAttachRef.current = attachIntentId;
    fileInputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingAttachRef.current) return;
    ctx.exec(pendingAttachRef.current, { file });
    e.target.value = "";
  };

  return (
    <div style={{ background: "var(--mantine-color-default)", borderTop: "1px solid var(--mantine-color-default-border)" }}>
      {/* Reply banner */}
      {replyContext && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px",
          background: "var(--mantine-color-primary-light, rgba(99,102,241,0.08))",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          fontSize: 12,
        }}>
          <span style={{ color: "var(--mantine-color-primary, #6366f1)", fontWeight: 600 }}>↩</span>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {replyContext.senderName && (
              <span style={{ fontWeight: 600, color: "var(--mantine-color-primary, #6366f1)", marginRight: 6 }}>
                {replyContext.senderName}
              </span>
            )}
            <span style={{ color: "var(--mantine-color-dimmed)" }}>
              {(replyContext.preview || "").slice(0, 60)}{(replyContext.preview || "").length > 60 ? "…" : ""}
            </span>
          </div>
          <button
            onClick={() => ctx.setComposerMode?.(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--mantine-color-dimmed)", fontSize: 14, padding: 4 }}
          >✕</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, padding: 12, alignItems: "center" }}>
        {spec.attachments?.length > 0 && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setAttachMenuOpen(!attachMenuOpen)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 20, padding: 4, color: "var(--mantine-color-dimmed)",
              }}
            >+</button>
            {attachMenuOpen && (
              <div style={{
                position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
                background: "var(--mantine-color-default)", border: "1px solid var(--mantine-color-default-border)", borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: 4, zIndex: 10, minWidth: 180,
              }}>
                {spec.attachments.map(id => (
                  <button
                    key={id}
                    onClick={() => handleAttach(id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "6px 10px", background: "transparent", border: "none",
                      cursor: "pointer", fontSize: 13,
                    }}
                  >{id}</button>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={onFileChange} />
          </div>
        )}
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={replyContext ? "Ответить…" : (spec.placeholder || "Сообщение…")}
          autoFocus={!!replyContext}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 20,
            border: `1px solid ${replyContext ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default-border)"}`,
            background: "var(--mantine-color-body)",
            color: "var(--mantine-color-text)",
            fontSize: 14, outline: "none",
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          style={{
            padding: "8px 16px", borderRadius: 20, border: "none",
            background: text.trim() ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default-hover)",
            color: text.trim() ? "#fff" : "var(--mantine-color-dimmed)", cursor: text.trim() ? "pointer" : "default",
            fontWeight: 600,
          }}
        >↑</button>
      </div>
    </div>
  );
}
