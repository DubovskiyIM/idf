import React from "react";
import { AnimatePresence, motion } from "framer-motion";

const labelStyle = { display: "flex", fontSize: 12, gap: 8, padding: "3px 0" };
const btnFix = { marginTop: 4, padding: "4px 8px", background: "#1e40af", border: "none", borderRadius: 3, color: "white", fontSize: 11, cursor: "pointer" };

function Row({ label, value }) {
  return (
    <div style={labelStyle}>
      <span style={{ color: "#64748b", width: 80 }}>{label}</span>
      <span>{String(value ?? "—")}</span>
    </div>
  );
}

function EntityDetails({ node }) {
  return (
    <>
      <Row label="kind" value={node.entityKind} />
      {node.ownerField && <Row label="owner" value={node.ownerField} />}
      <h4 style={{ marginTop: 12 }}>Fields</h4>
      <ul style={{ fontSize: 12, marginLeft: 12 }}>
        {node.fields.map((f) => (
          <li key={f.name}><code>{f.name}</code> <span style={{ color: "#64748b" }}>{f.type}</span></li>
        ))}
      </ul>
      {node.statuses && <div style={{ fontSize: 12, marginTop: 8 }}>statuses: {node.statuses.join(", ")}</div>}
    </>
  );
}

function IntentDetails({ node, warnings, onFixWithClaude }) {
  const myWarnings = warnings.filter((w) => w.intentId === node.intentId);
  return (
    <>
      {node.antagonist && <Row label="antagonist" value={node.antagonist} />}
      {node.creates && <Row label="creates" value={node.creates} />}
      <h4 style={{ marginTop: 12 }}>Effects</h4>
      <ul style={{ fontSize: 12, marginLeft: 12 }}>
        {(node.particles.effects || []).map((e, i) => (
          <li key={i}><code>{typeof e === "object" ? `${e.α} → ${e.target}` : String(e)}</code></li>
        ))}
      </ul>
      <h4 style={{ marginTop: 12 }}>Witnesses</h4>
      <ul style={{ fontSize: 12, marginLeft: 12 }}>
        {(node.particles.witnesses || []).map((w, i) => (<li key={i}><code>{String(w)}</code></li>))}
      </ul>
      {myWarnings.length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 4 }}>
          <h4 style={{ color: "#fca5a5", marginBottom: 8 }}>Warnings ({myWarnings.length})</h4>
          {myWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
              <div>{w.severity === "error" ? "✗" : "⚠"} {w.message}</div>
              <button onClick={() => onFixWithClaude(node, w)} style={btnFix}>fix with Claude</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Inspector({ node, warnings, onClose, onFixWithClaude, onFlyTo }) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "tween", duration: 0.2 }}
          style={{ position: "absolute", top: 0, right: 0, width: 320, height: "100vh", background: "#1e293b", borderLeft: "1px solid #334155", padding: 16, overflowY: "auto", zIndex: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center", gap: 8 }}>
            <h3 style={{ fontSize: 16, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name || node.id}</h3>
            <button onClick={onFlyTo} title="Вернуться к узлу" style={{ padding: "3px 8px", fontSize: 12 }}>⌖</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", padding: 0 }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{node.kind}</div>
          {node.kind === "entity" && <EntityDetails node={node} />}
          {node.kind === "intent" && <IntentDetails node={node} warnings={warnings} onFixWithClaude={onFixWithClaude} />}
          {node.kind === "role" && (
            <>
              <Row label="base" value={node.base} />
              <Row label="scope" value={node.scope} />
              <h4 style={{ marginTop: 12 }}>canInvoke</h4>
              <ul style={{ fontSize: 12, marginLeft: 12 }}>
                {(node.canInvoke || []).map((id) => (<li key={id}>{id}</li>))}
              </ul>
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
