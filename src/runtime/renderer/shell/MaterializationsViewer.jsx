/**
 * MaterializationsViewer — §1/§17 authoring-env drawer для одновременной
 * визуализации одной проекции как четырёх материализаций.
 *
 * Слева в основном canvas — pixel-рендер (без изменений). Drawer справа
 * показывает ту же projection как:
 *   - Pixels   — raw artifact v2 JSON (то, что рендерер получает на вход)
 *   - Voice    — /api/voice/:domain/:projection в форматах json / ssml / plain
 *   - Document — /api/document/:domain/:projection в форматах html / json
 *   - Agent    — /api/agent/:domain/{schema,world} — surface для LLM
 *
 * Активация: Cmd+Shift+M (см. V2Shell).
 *
 * Все 4 endpoint'а — viewer-scoped через JWT. Role для voice/document через
 * ?as=<role>; для agent — hardcoded "agent" в серверной декларации.
 */

import { useEffect, useMemo, useState } from "react";

const TOKEN_KEY = "idf_token";

export default function MaterializationsViewer({
  domainId, projectionId, artifact, onClose, role = "owner",
}) {
  const [tab, setTab] = useState("voice");
  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  if (!projectionId) {
    return (
      <div style={drawerStyle}>
        <Header onClose={onClose} />
        <div style={{ padding: 16, opacity: 0.6 }}>
          Выберите проекцию.
        </div>
      </div>
    );
  }

  return (
    <div style={drawerStyle}>
      <Header onClose={onClose} />

      <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>projection</div>
        <div style={{ fontFamily: "monospace", fontSize: 13 }}>
          {domainId} / {projectionId}
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
          Viewer-role: <span style={{ fontFamily: "monospace" }}>{role}</span>
          . Один spec — четыре читателя (§1 манифеста v2).
        </div>
      </div>

      <TabBar current={tab} onChange={setTab} />

      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "pixels" && <PixelsTab artifact={artifact} />}
        {tab === "voice" && (
          <VoiceTab domain={domainId} projection={projectionId} token={token} role={role} />
        )}
        {tab === "document" && (
          <DocumentTab domain={domainId} projection={projectionId} token={token} role={role} />
        )}
        {tab === "agent" && (
          <AgentTab domain={domainId} token={token} projection={projectionId} />
        )}
      </div>
    </div>
  );
}

function Header({ onClose }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 12px", borderBottom: "1px solid #2a2a2a",
      background: "#1a1a1a",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        Materializations · 4 reader'а одной проекции
      </div>
      <button
        onClick={onClose}
        style={{
          background: "transparent", border: "1px solid #333",
          color: "#aaa", padding: "2px 8px", borderRadius: 4,
          fontSize: 11, cursor: "pointer",
        }}
      >
        Cmd+Shift+M / Close
      </button>
    </div>
  );
}

const TABS = [
  { id: "pixels",   icon: "📱", label: "Pixels",   hint: "raw artifact v2" },
  { id: "voice",    icon: "🎙",  label: "Voice",    hint: "/api/voice" },
  { id: "document", icon: "📄", label: "Document", hint: "/api/document" },
  { id: "agent",    icon: "🤖", label: "Agent",    hint: "/api/agent" },
];

function TabBar({ current, onChange }) {
  return (
    <div style={{
      display: "flex", borderBottom: "1px solid #2a2a2a",
      background: "#151515",
    }}>
      {TABS.map(t => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            title={t.hint}
            style={{
              flex: 1,
              padding: "8px 10px",
              background: active ? "#2d2d2d" : "transparent",
              color: active ? "#fff" : "#888",
              border: "none",
              borderBottom: active ? "2px solid #4a9eff" : "2px solid transparent",
              cursor: "pointer",
              fontSize: 12,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Pixels tab: raw artifact JSON ────────────────────────────────────────

function PixelsTab({ artifact }) {
  if (!artifact) {
    return <div style={{ padding: 16, opacity: 0.6 }}>Нет артефакта.</div>;
  }
  return (
    <div style={{ padding: 12 }}>
      <Caption>
        artifact v2 — то, что рендерер получает на вход слева. Pixels —
        это <code>ProjectionRendererV2</code> на этой структуре.
      </Caption>
      <JsonBlock data={artifact} />
    </div>
  );
}

// ─── Voice tab ────────────────────────────────────────────────────────────

function VoiceTab({ domain, projection, token, role }) {
  const [format, setFormat] = useState("json");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancel = false;
    setStatus("loading"); setData(null);
    const url = `/api/voice/${domain}/${projection}?format=${format}&as=${role}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async r => {
        const ct = r.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await r.json() : await r.text();
        if (cancel) return;
        if (r.ok) { setData(body); setStatus("ok"); }
        else { setData(body); setStatus("error"); }
      })
      .catch(err => { if (!cancel) { setData(String(err)); setStatus("error"); } });
    return () => { cancel = true; };
  }, [domain, projection, token, role, format]);

  return (
    <div style={{ padding: 12 }}>
      <Caption>
        <code>GET /api/voice/{domain}/{projection}</code> — brevity-rules
        (top-3 для catalog), деньги читаются словами. Три формата: JSON для
        voice-agent (Claude Voice / OpenAI realtime), SSML для TTS, plain
        для debug / IVR.
      </Caption>
      <FormatSwitch
        options={[
          { v: "json",  label: "json (turns)" },
          { v: "ssml",  label: "SSML (TTS)" },
          { v: "plain", label: "plain (debug)" },
        ]}
        current={format} onChange={setFormat}
      />
      <OutputBlock status={status} data={data} as={format === "json" ? "json" : "text"} />
      {format === "json" && data?.turns && <VoiceTurnsPreview turns={data.turns} />}
    </div>
  );
}

function VoiceTurnsPreview({ turns }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed #333", paddingTop: 12 }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
        Human-readable preview
      </div>
      {turns.map((t, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontFamily: "monospace", padding: "1px 6px",
            borderRadius: 3, background: "#2a2a2a", marginRight: 6,
          }}>
            {t.role}
          </span>
          <span style={{ fontSize: 13 }}>{t.text}</span>
          {Array.isArray(t.items) && t.items.length > 0 && (
            <ul style={{ fontSize: 12, margin: "4px 0 0 16px", opacity: 0.8 }}>
              {t.items.map((it, j) => (
                <li key={j}>{typeof it === "string" ? it : JSON.stringify(it)}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Document tab ─────────────────────────────────────────────────────────

function DocumentTab({ domain, projection, token, role }) {
  const [format, setFormat] = useState("html");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancel = false;
    setStatus("loading"); setData(null);
    const url = `/api/document/${domain}/${projection}?format=${format}&as=${role}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async r => {
        const ct = r.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await r.json() : await r.text();
        if (cancel) return;
        if (r.ok) { setData(body); setStatus("ok"); }
        else { setData(body); setStatus("error"); }
      })
      .catch(err => { if (!cancel) { setData(String(err)); setStatus("error"); } });
    return () => { cancel = true; };
  }, [domain, projection, token, role, format]);

  return (
    <div style={{ padding: 12 }}>
      <Caption>
        <code>GET /api/document/{domain}/{projection}</code> — structured
        document-граф, который та же <code>projection</code> становится
        как «письмо» или PDF-ready отчёт. Материализация #4 из §1.
      </Caption>
      <FormatSwitch
        options={[
          { v: "html", label: "HTML (print-ready)" },
          { v: "json", label: "json (structured)" },
        ]}
        current={format} onChange={setFormat}
      />
      {status === "loading" && <Spinner />}
      {status === "error" && (
        <ErrorBox>
          {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
        </ErrorBox>
      )}
      {status === "ok" && format === "html" && (
        <iframe
          title="document preview"
          srcDoc={typeof data === "string" ? data : ""}
          style={{
            width: "100%", height: 460,
            background: "#fff", border: "1px solid #2a2a2a",
            borderRadius: 4, marginTop: 8,
          }}
        />
      )}
      {status === "ok" && format === "json" && <JsonBlock data={data} />}
    </div>
  );
}

// ─── Agent tab ────────────────────────────────────────────────────────────

function AgentTab({ domain, token, projection }) {
  const [endpoint, setEndpoint] = useState("schema");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancel = false;
    setStatus("loading"); setData(null);
    const url = `/api/agent/${domain}/${endpoint}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async r => {
        const body = await r.json();
        if (cancel) return;
        if (r.ok) { setData(body); setStatus("ok"); }
        else { setData(body); setStatus("error"); }
      })
      .catch(err => { if (!cancel) { setData({ error: String(err) }); setStatus("error"); } });
    return () => { cancel = true; };
  }, [domain, token, endpoint]);

  return (
    <div style={{ padding: 12 }}>
      <Caption>
        <code>/api/agent/{domain}/{endpoint}</code> — surface для LLM-агента
        как равноправного пользователя (§17). <b>schema</b> — executable
        tool-list (видит каждый <i>agent</i>-role intent c параметрами + preapproval-
        гарды). <b>world</b> — folded Φ отфильтрованный через <code>filterWorldForRole("agent")</code>.
      </Caption>
      <FormatSwitch
        options={[
          { v: "schema", label: "schema (tools)" },
          { v: "world",  label: "world (rows)" },
        ]}
        current={endpoint} onChange={setEndpoint}
      />
      {status === "loading" && <Spinner />}
      {status === "error" && (
        <ErrorBox>
          {data?.error === "ontology_unavailable"
            ? "Ontology не зарегистрирована на сервере — открой домен в UI хотя бы раз."
            : JSON.stringify(data, null, 2)}
        </ErrorBox>
      )}
      {status === "ok" && endpoint === "schema" && <AgentSchemaPreview data={data} />}
      {status === "ok" && endpoint === "world" && <JsonBlock data={data} />}
    </div>
  );
}

function AgentSchemaPreview({ data }) {
  const intents = Array.isArray(data?.intents) ? data.intents : [];
  const total = intents.length;
  return (
    <>
      <div style={{
        fontSize: 12, opacity: 0.8, margin: "8px 0",
        padding: "6px 8px", background: "#1a2530", borderRadius: 4,
      }}>
        Агент видит <b>{total}</b> intent-ов. Роль{" "}
        <code>{data?.role}</code>, viewer <code>{data?.viewer?.id}</code>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {intents.map(it => (
          <details key={it.intentId}
            style={{
              background: "#1a1a1a", border: "1px solid #2a2a2a",
              borderRadius: 4, padding: "6px 8px", fontSize: 12,
            }}
          >
            <summary style={{ cursor: "pointer", fontFamily: "monospace" }}>
              <b>{it.intentId}</b>
              {it.name && <span style={{ opacity: 0.6 }}> — {it.name}</span>}
              {it.preapproval && (
                <span style={{
                  marginLeft: 6, fontSize: 10,
                  padding: "1px 5px", background: "#5a3a1a", borderRadius: 3,
                }}>
                  preapproval: {Object.keys(it.preapproval).join(",")}
                </span>
              )}
            </summary>
            <JsonBlock data={it} compact />
          </details>
        ))}
      </div>
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, opacity: 0.6 }}>
          raw schema JSON
        </summary>
        <JsonBlock data={data} />
      </details>
    </>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────

function Caption({ children }) {
  return (
    <div style={{
      fontSize: 11, opacity: 0.7, marginBottom: 10, lineHeight: 1.4,
    }}>
      {children}
    </div>
  );
}

function FormatSwitch({ options, current, onChange }) {
  return (
    <div style={{
      display: "inline-flex", gap: 0, marginBottom: 10,
      border: "1px solid #333", borderRadius: 4, overflow: "hidden",
    }}>
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: "4px 10px", fontSize: 11,
            background: current === o.v ? "#2d4a6a" : "transparent",
            color: current === o.v ? "#fff" : "#888",
            border: "none", cursor: "pointer",
            fontFamily: "monospace",
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function OutputBlock({ status, data, as }) {
  if (status === "loading") return <Spinner />;
  if (status === "error") return <ErrorBox>{typeof data === "string" ? data : JSON.stringify(data, null, 2)}</ErrorBox>;
  if (as === "json") return <JsonBlock data={data} />;
  return (
    <pre style={preStyle}>{typeof data === "string" ? data : JSON.stringify(data, null, 2)}</pre>
  );
}

function JsonBlock({ data, compact = false }) {
  return (
    <pre style={{ ...preStyle, fontSize: compact ? 11 : 12 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Spinner() {
  return <div style={{ padding: 12, opacity: 0.5, fontSize: 12 }}>⏳ загрузка…</div>;
}

function ErrorBox({ children }) {
  return (
    <pre style={{
      ...preStyle, background: "#2a1515", borderColor: "#5a2a2a", color: "#fca5a5",
    }}>
      {children}
    </pre>
  );
}

const preStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
  fontSize: 12,
  lineHeight: 1.45,
  padding: 10,
  background: "#121212",
  border: "1px solid #2a2a2a",
  borderRadius: 4,
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "#d4d4d4",
  maxHeight: 520,
  overflow: "auto",
};

const drawerStyle = {
  position: "fixed", top: 0, right: 0, bottom: 0, width: 560,
  background: "#0f0f0f", color: "#ddd",
  borderLeft: "1px solid #2a2a2a",
  overflowY: "hidden",
  display: "flex", flexDirection: "column",
  zIndex: 100,
  fontFamily: "system-ui, sans-serif",
  boxShadow: "-4px 0 12px rgba(0,0,0,0.4)",
};
