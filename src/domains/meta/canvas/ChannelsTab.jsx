import React from "react";

/**
 * 4 канала — четыре материализации §1 манифеста (pixels / voice /
 * agent-API / document). Каждая — карточка с описанием + ссылка на
 * текущую проекцию через данный reader.
 */
export default function ChannelsTab() {
  const channels = [
    {
      id: "pixels",
      title: "Пиксели (UI)",
      description: "React+adapter рендерит проекции поверх артефактов crystallizeV2. Текущий surface — этот canvas.",
      sample: "/meta",
      sampleLabel: "/meta",
      enabled: true,
    },
    {
      id: "document",
      title: "Документ",
      description: "documentMaterializer превращает projection в structured document-граф. HTML / JSON.",
      sample: "/api/document/meta/backlog_inbox?as=observer&format=html",
      sampleLabel: "GET /api/document/meta/backlog_inbox",
      enabled: true,
    },
    {
      id: "agent",
      title: "Agent-API",
      description: "JWT-protected /api/agent/meta/{schema,world,exec} — preapproval + visibleFields + canExecute.",
      sample: "/api/agent/meta/schema",
      sampleLabel: "GET /api/agent/meta/schema",
      enabled: true,
    },
    {
      id: "voice",
      title: "Голос",
      description: "voiceMaterializer → speech-script (json / SSML / plain). Brevity: top-3 для catalog.",
      sample: "/api/voice/meta/backlog_inbox?as=observer&format=plain",
      sampleLabel: "GET /api/voice/meta/backlog_inbox",
      enabled: true,
    },
  ];

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        4 reader'а формата (§1 манифеста)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {channels.map((ch) => (
          <div key={ch.id} style={{
            padding: 16, border: "1px solid #2a2a32", borderRadius: 8, background: "#15151a",
          }}>
            <div style={{ fontSize: 14, color: "#f0f0f4", fontWeight: 500, marginBottom: 6 }}>
              {ch.title}
            </div>
            <p style={{ fontSize: 12, color: "#9f9faa", lineHeight: 1.5, margin: "0 0 12px" }}>
              {ch.description}
            </p>
            <a href={ch.sample} target="_blank" rel="noreferrer" style={{
              fontFamily: "monospace", fontSize: 11, color: "#7c8aff",
              textDecoration: "none", display: "inline-block",
              padding: "4px 8px", background: "#1a1a20", borderRadius: 4,
              border: "1px solid #2a2a32",
            }}>
              {ch.sampleLabel}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
