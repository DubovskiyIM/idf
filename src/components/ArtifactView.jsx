/**
 * ArtifactView — кристаллизация по кнопке + рендеринг артефакта из БД.
 *
 * Автор нажимает «Кристаллизовать» → генерируется JSON → сохраняется в БД → рендерится.
 * Никакого JSX. Никакого Vite. Мгновенно.
 */

import { useState, useEffect, useMemo } from "react";
import { crystallize } from "../runtime/crystallize.js";
import { crystallizeV2 } from "../runtime/crystallize_v2/index.js";
import ProjectionRenderer from "../runtime/renderer.jsx";
import ProjectionRendererV2 from "../runtime/renderer/index.jsx";

export default function ArtifactView({ domain, world, exec, viewer }) {
  const [artifacts, setArtifacts] = useState({});
  const [selectedProj, setSelectedProj] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [status, setStatus] = useState("");

  const INTENTS = domain.INTENTS || {};
  const PROJECTIONS = domain.PROJECTIONS || {};
  const ONTOLOGY = domain.ONTOLOGY || {};

  // Загрузить артефакты из БД при монтировании
  useEffect(() => {
    fetch("/api/artifacts")
      .then(r => r.json())
      .then(data => {
        const byProj = {};
        for (const a of data) {
          try {
            const parsed = typeof a.code === "string" ? JSON.parse(a.code) : a.code;
            byProj[parsed.projection] = parsed;
          } catch {}
        }
        setArtifacts(byProj);
        if (!selectedProj && Object.keys(byProj).length > 0) setSelectedProj(Object.keys(byProj)[0]);
      }).catch(() => {});
  }, []);

  // Кристаллизовать все проекции (v1)
  const handleCrystallize = async () => {
    setStatus("Кристаллизация...");
    const generated = crystallize(INTENTS, PROJECTIONS, ONTOLOGY);

    for (const [projId, artifact] of Object.entries(generated)) {
      await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projection: projId,
          code: JSON.stringify(artifact),
          intents_hash: artifact.intentsHash,
        }),
      }).catch(() => {});
    }

    setArtifacts(generated);
    setSelectedProj(Object.keys(generated)[0]);
    setStatus(`✓ ${Object.keys(generated).length} артефактов кристаллизовано`);
    setTimeout(() => setStatus(""), 3000);
  };

  // Кристаллизовать в v2 (feed-архетип, только для проекций с kind)
  const handleCrystallizeV2 = async () => {
    setStatus("Кристаллизация v2...");
    const generated = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, domain.DOMAIN_ID || "unknown");

    for (const [projId, artifact] of Object.entries(generated)) {
      await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projection: projId,
          code: JSON.stringify(artifact),
          intents_hash: artifact.inputsHash,
        }),
      }).catch(() => {});
    }

    setArtifacts(prev => ({ ...prev, ...generated }));
    if (Object.keys(generated).length > 0) {
      setSelectedProj(Object.keys(generated)[0]);
    }
    setStatus(`✓ ${Object.keys(generated).length} артефактов v2`);
    setTimeout(() => setStatus(""), 3000);
  };

  const currentArtifact = selectedProj ? artifacts[selectedProj] : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Панель управления */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <button onClick={handleCrystallize}
          style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#8b5cf6", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          🔮 Кристаллизовать
        </button>
        <button onClick={handleCrystallizeV2}
          style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          🔮 v2
        </button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {Object.keys(INTENTS).length} намерений → {Object.keys(PROJECTIONS).length} проекций
        </span>
        {status && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{status}</span>}
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={showJson} onChange={e => setShowJson(e.target.checked)} /> JSON
        </label>
      </div>

      {/* Табы проекций */}
      {Object.keys(artifacts).length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {Object.entries(artifacts).map(([projId, artifact]) => (
            <button key={projId} onClick={() => setSelectedProj(projId)}
              style={{ padding: "6px 14px", borderRadius: 6, border: selectedProj === projId ? "2px solid #8b5cf6" : "1px solid #d1d5db",
                background: selectedProj === projId ? "#f5f3ff" : "#fff", color: selectedProj === projId ? "#8b5cf6" : "#1a1a2e",
                fontSize: 12, cursor: "pointer", fontWeight: selectedProj === projId ? 600 : 400 }}>
              {artifact.name || projId}
            </button>
          ))}
        </div>
      )}

      {/* Рендеринг артефакта */}
      {currentArtifact && !showJson && (
        <div style={{ border: "2px solid #8b5cf6", borderRadius: 8, padding: 16, background: "#fff", minHeight: 200 }}>
          <div style={{ fontSize: 10, color: "#8b5cf6", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🔮 Артефакт: {currentArtifact.projection}</span>
            <span>v{currentArtifact.version}</span>
            <span>layer: {currentArtifact.layer}</span>
            {currentArtifact.archetype && <span>archetype: {currentArtifact.archetype}</span>}
            <span>{new Date(currentArtifact.generatedAt).toLocaleTimeString("ru")}</span>
          </div>
          {currentArtifact.version === 2
            ? <ProjectionRendererV2 artifact={currentArtifact} world={world} exec={exec} viewer={viewer} />
            : <ProjectionRenderer artifact={currentArtifact} world={world} exec={exec} viewer={viewer} />
          }
        </div>
      )}

      {/* JSON-артефакт */}
      {currentArtifact && showJson && (
        <pre style={{ background: "#1a1a2e", color: "#e2e5eb", padding: 16, borderRadius: 8, fontSize: 11, fontFamily: "ui-monospace, monospace", overflow: "auto", maxHeight: 500, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(currentArtifact, null, 2)}
        </pre>
      )}

      {Object.keys(artifacts).length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
          Нажмите «🔮 Кристаллизовать» чтобы сгенерировать артефакты из определений
        </div>
      )}
    </div>
  );
}
