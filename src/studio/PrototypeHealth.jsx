import React, { useMemo } from "react";
import { crystallizeV2, validateArtifact } from "@intent-driven/core";
import useDomainModule from "./useDomainModule.js";

/**
 * PrototypeHealth — автоматически собирает проблемы domain'а, которые
 * мешают Прототипу рендериться: invalid artifacts (crystallize_v2 + SDK
 * validateArtifact). Если есть ошибки — показывает banner с количеством
 * проблем + CTA «Починить всё через Claude» c prefill всех detail'ей.
 *
 * Если проблем нет — возвращает null.
 */
export default function PrototypeHealth({ domainId, onFix }) {
  const { domain } = useDomainModule(domainId);

  const issues = useMemo(() => {
    if (!domain?.INTENTS || !domain?.ONTOLOGY || !domain?.PROJECTIONS) return [];
    let artifacts;
    try {
      artifacts = crystallizeV2(domain.INTENTS, domain.PROJECTIONS, domain.ONTOLOGY, domainId);
    } catch (e) {
      return [{ projection: "*", scope: "crystallize", errors: [e.message] }];
    }
    const out = [];
    for (const [projId, art] of Object.entries(artifacts || {})) {
      if (!art) {
        out.push({ projection: projId, scope: "missing", errors: ["артефакт не сгенерирован"] });
        continue;
      }
      try {
        const v = validateArtifact(art);
        if (!v.ok) {
          out.push({ projection: projId, archetype: art.archetype, scope: "validation", errors: v.errors });
        }
      } catch (e) {
        out.push({ projection: projId, scope: "validation", errors: [e.message] });
      }
    }
    return out;
  }, [domain, domainId]);

  if (issues.length === 0) return null;

  const totalErrors = issues.reduce((s, i) => s + i.errors.length, 0);
  const preview = issues.slice(0, 3).map((i) =>
    `${i.projection}${i.archetype ? ` (${i.archetype})` : ""}: ${i.errors[0]}`
  ).join(" · ");

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "10px 16px", background: "rgba(239, 68, 68, 0.08)",
      borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
      flexShrink: 0, color: "#fecaca", fontSize: 12,
    }}>
      <span style={{ fontSize: 14, marginTop: 1 }}>⚠</span>
      <div style={{ flex: 1, lineHeight: 1.5 }}>
        <div style={{ color: "#fca5a5", fontWeight: 500, marginBottom: 2 }}>
          {issues.length} {issues.length === 1 ? "проекция с ошибкой" : issues.length < 5 ? "проекции с ошибками" : "проекций с ошибками"}
          {" · "}
          <span style={{ color: "#fecaca", fontWeight: 400 }}>{totalErrors} {totalErrors === 1 ? "проблема" : totalErrors < 5 ? "проблемы" : "проблем"}</span>
        </div>
        <div style={{ fontSize: 11, color: "#fecaca", opacity: 0.8 }}>{preview}{issues.length > 3 ? ` · +${issues.length - 3}` : ""}</div>
      </div>
      <button
        onClick={() => onFix?.(issues)}
        style={{
          padding: "6px 12px", fontSize: 12, fontWeight: 600,
          background: "#b91c1c", border: "none", borderRadius: 4, color: "white",
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
        }}
      >
        ⌘K Починить всё
      </button>
    </div>
  );
}
