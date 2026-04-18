import React from "react";
import { AnimatePresence, motion } from "framer-motion";

const rowStyle = { display: "flex", fontSize: 13, gap: 12, padding: "6px 0", borderBottom: "1px solid #1e293b" };
const sectionTitle = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginTop: 20, marginBottom: 10, fontWeight: 600 };
const code = { fontFamily: "ui-monospace, 'SF Mono', monospace", fontSize: 12, color: "#c7d2fe" };
const listItem = { fontSize: 13, padding: "4px 0", color: "#cbd5e1" };

function Row({ label, value }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: "#64748b", minWidth: 80 }}>{label}</span>
      <span style={{ color: "#e2e8f0", flex: 1, wordBreak: "break-word" }}>{String(value ?? "—")}</span>
    </div>
  );
}

function EntityDetails({ node }) {
  return (
    <>
      <Row label="kind" value={node.entityKind} />
      {node.ownerField && <Row label="owner" value={node.ownerField} />}
      <div style={sectionTitle}>Поля ({node.fields?.length || 0})</div>
      <div>
        {(node.fields || []).map((f) => (
          <div key={f.name} style={listItem}>
            <span style={code}>{f.name}</span>
            <span style={{ color: "#64748b", marginLeft: 10 }}>{f.type}</span>
          </div>
        ))}
      </div>
      {node.statuses && node.statuses.length > 0 && (
        <>
          <div style={sectionTitle}>Statuses</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {node.statuses.map((s) => (
              <span key={s} style={{ fontSize: 11, padding: "2px 8px", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, color: "#cbd5e1" }}>{s}</span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function IntentDetails({ node, warnings, onFixWithClaude }) {
  const myWarnings = warnings.filter((w) => w.intentId === node.intentId);
  const effects = node.particles?.effects || [];
  const witnesses = node.particles?.witnesses || [];
  return (
    <>
      {node.antagonist && <Row label="antagonist" value={node.antagonist} />}
      {node.creates && <Row label="creates" value={node.creates} />}
      <div style={sectionTitle}>Effects ({effects.length})</div>
      <div>
        {effects.map((e, i) => (
          <div key={i} style={listItem}>
            <span style={code}>{typeof e === "object" ? `${e.α} → ${e.target}` : String(e)}</span>
          </div>
        ))}
      </div>
      <div style={sectionTitle}>Witnesses ({witnesses.length})</div>
      <div>
        {witnesses.map((w, i) => (<div key={i} style={listItem}><span style={code}>{String(w)}</span></div>))}
      </div>
      {myWarnings.length > 0 && (
        <>
          <div style={sectionTitle}>Warnings ({myWarnings.length})</div>
          <div style={{ background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, padding: 12 }}>
            {myWarnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                <div style={{ color: "#fca5a5", marginBottom: 6 }}>
                  {w.severity === "error" ? "✗" : "⚠"} {w.message}
                </div>
                {onFixWithClaude && (
                  <button onClick={() => onFixWithClaude(node, w)} style={{
                    padding: "5px 10px", background: "#4338ca", border: "none", borderRadius: 4, color: "white",
                    fontSize: 11, fontWeight: 500, cursor: "pointer",
                  }}>
                    Починить через Claude
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function Inspector({ node, warnings, onClose, onFixWithClaude, onFlyTo }) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: "tween", duration: 0.22 }}
          style={{
            position: "absolute", top: 0, right: 0, width: 340, height: "100%",
            background: "#0f172a", borderLeft: "1px solid #1e293b",
            padding: "20px 22px", overflowY: "auto", zIndex: 20,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            color: "#e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {node.name || node.id}
            </h3>
            <button onClick={onFlyTo} title="Центр камеры" style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>⌖</button>
            <button onClick={onClose} title="Закрыть" style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
            {node.kind}
          </div>
          {node.kind === "entity" && <EntityDetails node={node} />}
          {node.kind === "intent" && <IntentDetails node={node} warnings={warnings} onFixWithClaude={onFixWithClaude} />}
          {node.kind === "role" && (
            <>
              <Row label="base" value={node.base} />
              <Row label="scope" value={node.scope} />
              <div style={sectionTitle}>canInvoke ({(node.canInvoke || []).length})</div>
              <div>
                {(node.canInvoke || []).map((id) => (<div key={id} style={listItem}><span style={code}>{id}</span></div>))}
              </div>
            </>
          )}
          {node.kind === "projection" && (
            <>
              <Row label="archetype" value={node.archetype} />
              <Row label="source" value={node.source} />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
