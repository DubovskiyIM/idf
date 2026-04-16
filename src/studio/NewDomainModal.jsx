import React, { useState } from "react";

const inputStyle = { width: "100%", padding: 8, background: "#0f172a", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", marginTop: 4, fontFamily: "inherit", fontSize: 13 };

export default function NewDomainModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/studio/domain/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "error");
      onCreated({ name, description, prompt });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#1e293b", padding: 24, borderRadius: 8, width: 480 }}>
        <h3 style={{ marginBottom: 16 }}>Новый домен</h3>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>id (lowercase, [a-z0-9_-])</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Название (русский)</div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Что за домен? (опц., будет отправлено первым сообщением Claude)</div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </label>
        {err && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Отмена</button>
          <button onClick={submit} disabled={busy || !name} style={{ background: "#1e40af", color: "white" }}>Создать</button>
        </div>
      </div>
    </div>
  );
}
