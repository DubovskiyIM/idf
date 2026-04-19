/**
 * CrystallizeInspector — §27 authoring-env drawer для отображения witness
 * trail кристаллизации текущей проекции.
 *
 * Consumer of SDK `explainCrystallize(artifact)` из @intent-driven/core.
 * Отвечает на три вопроса автора:
 *   1. «какое правило R1–R10 вывело эту проекцию?» (ruleIds, origin)
 *   2. «какой input запустил правило?» (witness.input)
 *   3. «какой паттерн обогатил слоты?» (patternIds, temporal, polymorphic)
 *
 * Активируется Cmd+Shift+C / Ctrl+Shift+C в V2Shell.
 *
 * Не требует server-вызова — работает с artifact целиком.
 *
 * TODO: после merge PR #66 переключить import на "@intent-driven/core".
 */

import { useMemo } from "react";

// Inlined reduction `explainCrystallize` — зеркалит SDK @intent-driven/core@0.17+.
// TODO: после merge PR #66 и npm-publish заменить на `import { explainCrystallize } from "@intent-driven/core"`.
const BASIS_ORDER = [
  "crystallize-rule", "polymorphic-variant", "temporal-section",
  "pattern-bank", "alphabetical-fallback", "authored",
];
const ORIGIN_RULES = new Set(["R1", "R1b", "R2", "R3", "R7", "R10"]);
const ENRICH_RULES = new Set(["R4", "R6", "R9"]);

function explainCrystallize(artifact) {
  if (!artifact || typeof artifact !== "object") throw new TypeError("artifact required");
  const witnesses = Array.isArray(artifact.witnesses) ? artifact.witnesses : [];
  const witnessesByBasis = {};
  for (const w of witnesses) {
    const b = w.basis || "unknown";
    if (!witnessesByBasis[b]) witnessesByBasis[b] = [];
    witnessesByBasis[b].push(w);
  }
  const ruleIds = (witnessesByBasis["crystallize-rule"] || []).map(w => w.ruleId).filter(Boolean);
  const patternIds = (witnessesByBasis["pattern-bank"] || []).map(w => w.pattern).filter(Boolean);
  const hasOrigin = ruleIds.some(r => ORIGIN_RULES.has(r));
  const hasEnrich = ruleIds.some(r => ENRICH_RULES.has(r));
  const origin = hasOrigin
    ? (hasEnrich ? "derived+enriched" : "derived")
    : (hasEnrich ? "authored+enriched" : "authored");
  let step = 0;
  const trace = [];
  for (const basis of BASIS_ORDER) {
    for (const w of witnessesByBasis[basis] || []) {
      step++;
      trace.push({ step, basis, ruleId: w.ruleId, pattern: w.pattern, rationale: w.rationale });
    }
  }
  const parts = [`${artifact.archetype || "?"} "${artifact.projection}"`];
  parts.push({ derived: "выведена правилами", "derived+enriched": "выведена + обогащена",
               "authored+enriched": "авторская + обогащена правилами", authored: "авторская без derivation origin" }[origin]);
  if (ruleIds.length > 0) parts.push(`правила: ${[...new Set(ruleIds)].sort().join(", ")}`);
  if (patternIds.length > 0) parts.push(`паттерны: ${[...new Set(patternIds)].sort().join(", ")}`);
  return {
    projection: artifact.projection, archetype: artifact.archetype,
    origin, witnessesByBasis, ruleIds, patternIds, trace,
    summary: parts.join(" · "),
  };
}

const BASIS_LABEL = {
  "crystallize-rule":     "Crystallize rules",
  "pattern-bank":         "Pattern Bank",
  "polymorphic-variant":  "Polymorphic variant",
  "temporal-section":     "Temporal section",
  "alphabetical-fallback":"Alphabetical fallback",
  "authored":             "Authored",
  "unknown":              "Unknown",
};

const ORIGIN_BADGE = {
  "derived":            { bg: "#2d5", label: "DERIVED" },
  "derived+enriched":   { bg: "#3a7", label: "DERIVED+ENRICHED" },
  "authored+enriched":  { bg: "#a85", label: "AUTHORED+ENRICHED" },
  "authored":           { bg: "#966", label: "AUTHORED" },
};

export default function CrystallizeInspector({ artifact, onClose }) {
  const expl = useMemo(() => {
    if (!artifact) return null;
    try {
      return explainCrystallize(artifact);
    } catch {
      return null;
    }
  }, [artifact]);

  if (!expl) {
    return (
      <div style={drawerStyle}>
        <Header title="Crystallize Inspector" onClose={onClose} />
        <div style={{ padding: 16, opacity: 0.6 }}>
          Нет артефакта для объяснения. Выберите проекцию.
        </div>
      </div>
    );
  }

  const badge = ORIGIN_BADGE[expl.origin] || ORIGIN_BADGE.authored;

  return (
    <div style={drawerStyle}>
      <Header title="Crystallize Inspector" onClose={onClose} />

      <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>projection</div>
        <div style={{ fontFamily: "monospace", fontSize: 14 }}>{expl.projection}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>archetype</div>
        <div style={{ fontFamily: "monospace", fontSize: 14 }}>{expl.archetype}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: 4,
            background: badge.bg, color: "#fff", fontSize: 11, fontWeight: 600,
            fontFamily: "monospace",
          }}>{badge.label}</span>
        </div>
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>summary</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{expl.summary}</div>
      </div>

      {(expl.ruleIds.length > 0 || expl.patternIds.length > 0) && (
        <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a" }}>
          {expl.ruleIds.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.6 }}>rule IDs</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                {[...new Set(expl.ruleIds)].sort().map(r => (
                  <span key={r} style={tagStyle("#3a5")}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {expl.patternIds.length > 0 && (
            <div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>pattern IDs</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                {[...new Set(expl.patternIds)].sort().map(p => (
                  <span key={p} style={tagStyle("#58a")}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>trace ({expl.trace.length} step{expl.trace.length === 1 ? "" : "s"})</div>
        {expl.trace.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>—</div>}
        {expl.trace.map(t => (
          <TraceStep key={t.step} step={t} />
        ))}
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>witnesses by basis</div>
        {Object.keys(expl.witnessesByBasis).length === 0 && (
          <div style={{ opacity: 0.5, fontSize: 12 }}>—</div>
        )}
        {Object.entries(expl.witnessesByBasis).map(([basis, list]) => (
          <WitnessGroup key={basis} basis={basis} witnesses={list} />
        ))}
      </div>
    </div>
  );
}

function TraceStep({ step }) {
  const label = step.ruleId || step.pattern || step.basis;
  return (
    <div style={{
      padding: "6px 8px", margin: "3px 0", borderRadius: 4,
      background: "#1e1e1e", fontSize: 12, fontFamily: "monospace",
    }}>
      <span style={{ opacity: 0.5 }}>#{step.step}</span>{" "}
      <span style={{ color: "#8cf" }}>{step.basis}</span>
      {" → "}
      <span style={{ color: "#fc8" }}>{label}</span>
      {step.rationale && (
        <div style={{ opacity: 0.7, marginTop: 2, fontSize: 11, whiteSpace: "normal" }}>
          {step.rationale}
        </div>
      )}
    </div>
  );
}

function WitnessGroup({ basis, witnesses }) {
  return (
    <details style={{ marginBottom: 8 }}>
      <summary style={{ cursor: "pointer", fontSize: 12, padding: "4px 0" }}>
        <span style={{ color: "#8cf" }}>{BASIS_LABEL[basis] || basis}</span>{" "}
        <span style={{ opacity: 0.5 }}>({witnesses.length})</span>
      </summary>
      <pre style={{
        margin: "4px 0", padding: 8, background: "#141414", borderRadius: 4,
        fontSize: 11, overflow: "auto", maxHeight: 240,
      }}>
        {JSON.stringify(witnesses, null, 2)}
      </pre>
    </details>
  );
}

function Header({ title, onClose }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 12px", borderBottom: "1px solid #2a2a2a",
      background: "#1a1a1a",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <button
        onClick={onClose}
        style={{
          background: "transparent", border: "1px solid #333",
          color: "#aaa", padding: "2px 8px", borderRadius: 4,
          fontSize: 11, cursor: "pointer",
        }}
      >
        Cmd+Shift+C / Close
      </button>
    </div>
  );
}

function tagStyle(bg) {
  return {
    display: "inline-block", padding: "2px 6px", borderRadius: 3,
    background: bg, color: "#fff", fontSize: 11, fontWeight: 600,
    fontFamily: "monospace",
  };
}

const drawerStyle = {
  position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
  background: "#0f0f0f", color: "#ddd",
  borderLeft: "1px solid #2a2a2a",
  overflowY: "auto", zIndex: 100,
  fontFamily: "system-ui, sans-serif",
  boxShadow: "-4px 0 12px rgba(0,0,0,0.4)",
};
