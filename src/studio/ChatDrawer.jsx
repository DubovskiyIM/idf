import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { sendChat } from "./api/chat.js";
import ToolUseBadge from "./components/ToolUseBadge.jsx";

export default function ChatDrawer({ open, onClose, domain, prefill, onPrefillConsumed }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      onPrefillConsumed?.();
    }
  }, [prefill]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const stored = sessionStorage.getItem(`studio.session.${domain}`);
    if (stored) setSessionId(stored);
  }, [domain]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);

    const current = { role: "assistant", text: "", tools: [], results: {} };
    setMessages((m) => [...m, current]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await sendChat({
        domain,
        message: text,
        sessionId,
        signal: controller.signal,
        onEvent: ({ event, data }) => {
          if (event === "session_id") {
            setSessionId(data.id);
            sessionStorage.setItem(`studio.session.${domain}`, data.id);
          } else if (event === "text") {
            current.text += data.delta;
            setMessages((m) => [...m.slice(0, -1), { ...current }]);
          } else if (event === "tool_use") {
            current.tools.push(data);
            setMessages((m) => [...m.slice(0, -1), { ...current }]);
          } else if (event === "tool_result") {
            current.results[data.tool_use_id] = data;
            setMessages((m) => [...m.slice(0, -1), { ...current }]);
          }
        },
      });
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const newSession = () => {
    abortRef.current?.abort();
    setSessionId(null);
    sessionStorage.removeItem(`studio.session.${domain}`);
    setMessages([]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.2 }}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40vh", background: "#1e293b", borderTop: "1px solid #334155", display: "flex", flexDirection: "column", zIndex: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #334155", fontSize: 12 }}>
            <span>{domain} · session {sessionId?.slice(0, 6) || "—"}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button onClick={newSession}>🔄 new</button>
              <button onClick={() => abortRef.current?.abort()} disabled={!busy}>⏹ stop</button>
              <button onClick={onClose}>✕</button>
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                <div style={{ maxWidth: "80%", padding: 10, background: m.role === "user" ? "#334155" : "transparent", borderRadius: 6, fontSize: 13 }}>
                  <ReactMarkdown>{m.text || (busy && i === messages.length - 1 ? "…" : "")}</ReactMarkdown>
                  {m.tools?.map((t) => (
                    <ToolUseBadge key={t.id} use={t} result={m.results?.[t.id]} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div style={{ padding: 10, borderTop: "1px solid #334155", display: "flex", gap: 8 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
              placeholder="⌘⏎ — отправить"
              rows={2}
              style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", padding: 8, fontFamily: "inherit", fontSize: 13, resize: "none" }}
            />
            <button onClick={send} disabled={busy} style={{ padding: "0 16px", background: "#1e40af", border: "none", borderRadius: 4, color: "white" }}>Send</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
