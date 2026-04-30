import React, { useState, useEffect, useCallback, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { getSpec, putSpec } from "./api/spec.js";

const dark = {
  bg: "#0b1220", panel: "#0f172a", border: "#1e293b",
  text: "#e2e8f0", muted: "#94a3b8", accent: "#60a5fa",
  ok: "#34d399", warn: "#fbbf24", err: "#f87171",
};

export default function SpecEditor({ domainId }) {
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [meta, setMeta] = useState({ source: null, validationIssues: [], canFinalize: false, state: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const load = useCallback(async () => {
    if (!domainId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await getSpec(domainId);
      const spec = data.spec || {
        meta: { id: domainId }, INTENTS: {},
        ONTOLOGY: { entities: {}, roles: {}, invariants: [] }, PROJECTIONS: {},
      };
      const formatted = JSON.stringify(spec, null, 2);
      setText(formatted);
      setOriginalText(formatted);
      setMeta({
        source: data.source,
        validationIssues: data.validationIssues || [],
        canFinalize: !!data.canFinalize,
        state: data.state || null,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [domainId]);

  useEffect(() => { load(); }, [load]);

  const dirty = text !== originalText;
  const parsed = useMemo(() => {
    try { return { spec: JSON.parse(text), error: null }; }
    catch (e) { return { spec: null, error: e.message }; }
  }, [text]);

  const save = useCallback(async (commit) => {
    if (parsed.error || !parsed.spec) return;
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const r = await putSpec(domainId, parsed.spec, { commit });
      setMeta({
        source: commit ? "session" : meta.source,
        validationIssues: r.validationIssues || [],
        canFinalize: !!r.canFinalize,
        state: r.state || null,
      });
      setOriginalText(text);
      setStatusMsg(commit ? `Закоммичено · ${r.path || ""}` : "Сохранено в сессию");
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (e) {
      setError(e.body?.error || e.message);
    } finally {
      setBusy(false);
    }
  }, [domainId, parsed, text, meta.source]);

  if (!domainId) {
    return <Empty msg="Выбери домен во вкладке «Граф»" />;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: dark.bg, color: dark.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <Header
        domainId={domainId} meta={meta} dirty={dirty} parsedError={parsed.error}
        busy={busy} statusMsg={statusMsg} error={error}
        onReload={load}
        onSave={() => save(false)}
        onCommit={() => save(true)}
      />
      <div style={{ flex: 1, overflow: "auto", borderTop: `1px solid ${dark.border}`, minHeight: 0 }}>
        <CodeMirror
          value={text}
          height="100%"
          theme="dark"
          extensions={[json()]}
          onChange={setText}
          basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true }}
        />
      </div>
      {meta.validationIssues.length > 0 && (
        <ValidationStrip issues={meta.validationIssues} />
      )}
    </div>
  );
}

function Header({ domainId, meta, dirty, parsedError, busy, statusMsg, error, onReload, onSave, onCommit }) {
  return (
    <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
      <div style={{ fontFamily: "ui-monospace, monospace", color: dark.text }}>{domainId}/domain.js</div>
      <Badge kind={meta.source === "file" ? "ok" : meta.source === "session" ? "warn" : "muted"}
             text={meta.source === "file" ? "от commited файла" : meta.source === "session" ? "сессионный draft" : "—"} />
      {meta.state && <Badge kind="muted" text={`state: ${meta.state}`} />}
      <div style={{ flex: 1 }} />
      {parsedError && <span style={{ color: dark.err, fontSize: 12 }}>JSON-ошибка: {parsedError}</span>}
      {error && <span style={{ color: dark.err, fontSize: 12 }}>{error}</span>}
      {statusMsg && <span style={{ color: dark.ok, fontSize: 12 }}>{statusMsg}</span>}
      <button disabled={busy} onClick={onReload} style={btn("ghost")}>Перечитать</button>
      <button disabled={busy || !dirty || !!parsedError} onClick={onSave} style={btn("primary")}>Сохранить в сессию</button>
      <button disabled={busy || !!parsedError || !meta.canFinalize}
              onClick={onCommit} style={btn("commit")}
              title={meta.canFinalize ? "Записать в файл + hot-reload" : "Нужны хотя бы 1 entity и 1 intent"}>
        Закоммитить → файл
      </button>
    </div>
  );
}

function ValidationStrip({ issues }) {
  return (
    <div style={{ borderTop: `1px solid ${dark.border}`, background: "rgba(251,191,36,0.06)", padding: "10px 18px", maxHeight: 140, overflowY: "auto" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: dark.warn, marginBottom: 6 }}>
        Validation issues ({issues.length})
      </div>
      {issues.map((iss, i) => (
        <div key={i} style={{ fontSize: 12, color: dark.text, marginBottom: 4 }}>
          <span style={{ color: dark.warn, marginRight: 8 }}>{iss.code}</span>
          {iss.message}
        </div>
      ))}
    </div>
  );
}

function Badge({ kind, text }) {
  const colors = {
    ok: { bg: "rgba(52,211,153,0.1)", fg: dark.ok },
    warn: { bg: "rgba(251,191,36,0.1)", fg: dark.warn },
    muted: { bg: "rgba(148,163,184,0.1)", fg: dark.muted },
  }[kind] || { bg: "transparent", fg: dark.muted };
  return <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, background: colors.bg, color: colors.fg }}>{text}</span>;
}

function btn(kind) {
  const base = { padding: "5px 12px", fontSize: 12, borderRadius: 4, border: "1px solid #334155", cursor: "pointer", fontFamily: "inherit" };
  if (kind === "primary") return { ...base, background: "#1e40af", color: "white", borderColor: "#1e40af" };
  if (kind === "commit") return { ...base, background: "#15803d", color: "white", borderColor: "#15803d" };
  return { ...base, background: "transparent", color: dark.muted };
}

function Empty({ msg }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: dark.muted, fontSize: 14 }}>
      {msg}
    </div>
  );
}
