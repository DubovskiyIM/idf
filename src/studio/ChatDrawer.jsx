import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { sendChat } from "./api/chat.js";
import ToolUseBadge from "./components/ToolUseBadge.jsx";

const MESSAGES_KEY = (d) => `studio.messages.${d}`;
const SESSION_KEY = (d) => `studio.session.${d}`;

function loadMessages(domain) {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY(domain));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function ChatDrawer({ open, onClose, domain, prefill, onPrefillConsumed, onBusyChange, onProgress, onDone }) {
  // Per-domain persistence: messages + sessionId живут в sessionStorage,
  // чтобы переключение между табами / закрытие drawer'а не теряли
  // историю чата.
  const [messages, setMessages] = useState(() => loadMessages(domain));
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY(domain)); } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      onPrefillConsumed?.();
    }
  }, [prefill]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Persist messages при каждом обновлении (простой debounce не нужен —
  // пишем в sessionStorage, это fast).
  useEffect(() => {
    if (!domain) return;
    try {
      if (messages.length === 0) sessionStorage.removeItem(MESSAGES_KEY(domain));
      else sessionStorage.setItem(MESSAGES_KEY(domain), JSON.stringify(messages));
    } catch {}
  }, [messages, domain]);

  // При смене домена — перезагрузить messages + sessionId из storage.
  useEffect(() => {
    setMessages(loadMessages(domain));
    try { setSessionId(sessionStorage.getItem(SESSION_KEY(domain))); }
    catch { setSessionId(null); }
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
            onProgress?.({ lastTool: data, toolCount: current.tools.length });
          } else if (event === "tool_result") {
            current.results[data.tool_use_id] = data;
            setMessages((m) => [...m.slice(0, -1), { ...current }]);
          } else if (event === "done" || event === "end") {
            // Claude CLI type=result → "done" или SSE fallback "end" из route.
            // Триггерим onDone один раз, если была реальная работа.
            if ((current.tools.length > 0 || current.text.length > 0) && !current._doneFired) {
              current._doneFired = true;
              onDone?.({ usage: data?.usage });
            }
          } else if (event === "error" || event === "stderr") {
            current.text += `\n\n**[${event}]** ${data.message || data.text}`;
            setMessages((m) => [...m.slice(0, -1), { ...current }]);
          } else if (event === "close" && !current.text && !current.tools.length) {
            current.text = `**claude завершился без вывода** (code=${data.code}). Проверь PATH к \`claude\` или задай CLAUDE_BIN.`;
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

  const btnStyle = {
    background: "transparent", border: "1px solid #334155", color: "#94a3b8",
    fontSize: 12, padding: "4px 10px", borderRadius: 4, cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.22 }}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "42vh",
            background: "#0f172a", borderTop: "1px solid #1e293b",
            display: "flex", flexDirection: "column", zIndex: 30,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 500 }}>Chat · {domain}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
              {sessionId ? `session ${sessionId.slice(0, 8)}` : "new session"}
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={newSession} style={btnStyle}>новый чат</button>
            <button onClick={() => abortRef.current?.abort()} disabled={!busy} style={{ ...btnStyle, opacity: busy ? 1 : 0.4 }}>
              стоп
            </button>
            <button onClick={onClose} title="Скрыть" style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {messages.length === 0 && !busy && (
              <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "30px 16px", lineHeight: 1.6 }}>
                Опиши что изменить в домене — Claude правит ontology/intents/projections.<br/>
                <span style={{ fontSize: 11 }}>⌘⏎ — отправить · Esc — закрыть</span>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 14 }}>
                <div style={{
                  maxWidth: "78%", padding: "10px 14px",
                  background: m.role === "user" ? "#1e293b" : "transparent",
                  borderRadius: 10, fontSize: 13, lineHeight: 1.55, color: "#e2e8f0",
                }}>
                  <ReactMarkdown>{m.text || (busy && i === messages.length - 1 ? "…" : "")}</ReactMarkdown>
                  {m.tools?.map((t) => (
                    <ToolUseBadge key={t.id} use={t} result={m.results?.[t.id]} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid #1e293b", display: "flex", gap: 10 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
              placeholder="Опиши правку или задай вопрос · ⌘⏎"
              rows={2}
              style={{
                flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 6,
                color: "#e2e8f0", padding: "10px 12px", fontFamily: "inherit", fontSize: 13,
                resize: "none", outline: "none", lineHeight: 1.5,
              }}
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              style={{
                padding: "0 20px", background: busy || !input.trim() ? "#334155" : "#4338ca",
                border: "none", borderRadius: 6, color: "white", fontWeight: 500, fontSize: 13,
                cursor: busy || !input.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}
            >
              Отправить
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
