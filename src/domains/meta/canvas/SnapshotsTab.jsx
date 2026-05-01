import React from "react";
import snapshotMod from "../meta-snapshot.js";

/**
 * Снапшоты — текущий meta-snapshot.js summary (один named snapshot) +
 * Φ-state metrics из сервера. Будущее: множественные snapshots с
 * timestamps, diff между ними.
 */
export default function SnapshotsTab() {
  const snap = snapshotMod || {};
  const summary = snap.summary || {};
  const ts = snap.snapshottedAt ? new Date(snap.snapshottedAt) : null;

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        Текущий snapshot · {ts ? ts.toISOString().slice(0, 16).replace("T", " ") : "—"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {Object.entries(summary).map(([k, v]) => (
          <div key={k} style={{ padding: 12, border: "1px solid #2a2a32", borderRadius: 6, background: "#15151a" }}>
            <div style={{ fontSize: 10, color: "#7a7a85", textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontSize: 22, color: "#f0f0f4", fontWeight: 300 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 16px", border: "1px solid #2a2a32", borderRadius: 6, background: "#15151a", fontSize: 12 }}>
        <div style={{ color: "#bababd", marginBottom: 6 }}>Команды</div>
        <pre style={{
          fontFamily: "monospace", fontSize: 11, color: "#9f9faa",
          margin: 0, lineHeight: 1.6,
        }}>
{`# Регенерировать snapshot
npm run meta-snapshot

# Compile Φ → markdown
npm run meta-compile

# Compile offline (без сервера, через sqlite)
node scripts/meta-compile.mjs --offline`}
        </pre>
      </div>
    </div>
  );
}
