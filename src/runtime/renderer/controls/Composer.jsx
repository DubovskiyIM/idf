import { useState, useRef } from "react";

export default function Composer({ spec, ctx }) {
  const [text, setText] = useState("");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const pendingAttachRef = useRef(null);

  const submit = () => {
    if (!text.trim()) return;
    ctx.exec(spec.primaryIntent, { [spec.primaryParameter]: text });
    setText("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
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
    <div style={{
      display: "flex", gap: 8, padding: 12, alignItems: "center",
      background: "#fff", borderTop: "1px solid #e5e7eb",
    }}>
      {spec.attachments?.length > 0 && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setAttachMenuOpen(!attachMenuOpen)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 20, padding: 4, color: "#6b7280",
            }}
          >+</button>
          {attachMenuOpen && (
            <div style={{
              position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
              boxShadow: "0 4px 12px #0001", padding: 4, zIndex: 10, minWidth: 180,
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
        placeholder={spec.placeholder || "Сообщение…"}
        style={{
          flex: 1, padding: "8px 12px", borderRadius: 20,
          border: "1px solid #d1d5db", fontSize: 14, outline: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        style={{
          padding: "8px 16px", borderRadius: 20, border: "none",
          background: text.trim() ? "#6366f1" : "#e5e7eb",
          color: "#fff", cursor: text.trim() ? "pointer" : "default",
          fontWeight: 600,
        }}
      >↑</button>
    </div>
  );
}
