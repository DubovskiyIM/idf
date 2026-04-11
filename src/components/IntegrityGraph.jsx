/**
 * 3D-граф целостности.
 * Узлы: намерения (зелёные), проекции (синие), сущности (фиолетовые)
 * Рёбра: effects→сущности, conditions→производители, witnesses→проекции
 * Проблемы: узлы/рёбра с issues подсвечиваются красным
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { checkIntegrity } from "../runtime/integrity.js";

const NODE_COLORS = {
  intent: "#22c55e",
  projection: "#60a5fa",
  entity: "#a78bfa",
  error: "#ef4444",
  warning: "#f59e0b",
};

function getResolutions(issue) {
  const resolutions = [];

  switch (issue.rule) {
    case "algebra_composition":
      resolutions.push(
        { icon: "🔄", label: "Изменить α-тип", desc: `Заменить один из α-типов на совместимый. Например, оба на 'replace' (побеждает ≺-поздний).` },
        { icon: "🎯", label: "Разделить target", desc: `Если эффекты на разные аспекты сущности — использовать разные target (slot.status vs slot.count).` },
        { icon: "🚫", label: "Добавить исключающую связь", desc: `Если намерения не должны применяться одновременно — сделать их исключающими (⊕).` },
        { icon: "✕", label: "Удалить намерение", desc: `Если одно из намерений ошибочно — удалить его из определений.` },
      );
      break;
    case "no_dead_intents":
      resolutions.push(
        { icon: "➕", label: "Добавить производителя", desc: `Создать намерение, чей эффект устанавливает нужное значение для условия.` },
        { icon: "🔧", label: "Ослабить условие", desc: `Изменить или удалить условие, если оно слишком строгое.` },
        { icon: "📦", label: "Добавить seed-данные", desc: `Условие может быть выполнено начальными данными (seed), не обязательно другим намерением.` },
      );
      break;
    case "no_orphan_effects":
      resolutions.push(
        { icon: "📊", label: "Добавить проекцию", desc: `Создать проекцию, которая наблюдает этот эффект.` },
        { icon: "👁", label: "Добавить witness", desc: `Добавить поле в witnesses существующей проекции.` },
      );
      break;
    case "witness_completeness":
      resolutions.push(
        { icon: "👁", label: "Добавить witness", desc: `Добавить свидетельство для условия, чтобы пользователь видел его перед решением.` },
        { icon: "ℹ️", label: "Игнорировать", desc: `Условие может быть очевидным из контекста (например, status виден в UI).` },
      );
      break;
    case "confirmation_proportionality":
      resolutions.push(
        { icon: "⚠", label: "Усилить подтверждение", desc: `Заменить 'click' на confirm-dialog, двойной клик, или ввод текста.` },
        { icon: "↓", label: "Снизить необратимость", desc: `Если операция обратима (мягкое удаление) — снизить irreversibility.` },
      );
      break;
    case "antagonist_exists":
      resolutions.push(
        { icon: "➕", label: "Создать антагониста", desc: `Добавить намерение-антагонист с указанным ID.` },
        { icon: "✕", label: "Убрать ссылку", desc: `Удалить поле antagonist из определения.` },
      );
      break;
    case "ontology_coverage":
    case "anchoring_entity":
      resolutions.push(
        { icon: "📦", label: "Добавить в онтологию", desc: `Добавить сущность в ONTOLOGY.entities с полями и типом.` },
        { icon: "🔧", label: "Исправить имя", desc: `Возможно опечатка — проверить написание типа.` },
      );
      break;
    case "anchoring_effect":
      resolutions.push(
        { icon: "📦", label: "Добавить сущность", desc: `Добавить коллекцию в ONTOLOGY.entities.` },
        { icon: "🎯", label: "Исправить target", desc: `Target эффекта может содержать опечатку.` },
      );
      break;
    case "anchoring_field":
      resolutions.push(
        { icon: "➕", label: "Добавить поле", desc: `Добавить поле в ONTOLOGY.entities.[тип].fields.` },
        { icon: "🔧", label: "Исправить target", desc: `Возможно поле называется иначе в онтологии.` },
      );
      break;
    case "anchoring_witness":
      resolutions.push(
        { icon: "➕", label: "Добавить поле в онтологию", desc: `Свидетельство ссылается на поле, которого нет — добавить.` },
        { icon: "✎", label: "Исправить witness", desc: `Возможно опечатка в имени поля.` },
      );
      break;
    default:
      resolutions.push({ icon: "🔍", label: "Исследовать", desc: `Проанализировать проблему вручную.` });
  }

  return resolutions;
}

export default function IntegrityGraph({ domain }) {
  const containerRef = useRef();
  const graphRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const INTENTS = domain.INTENTS || {};
  const PROJECTIONS = domain.PROJECTIONS || {};
  const ONTOLOGY = domain.ONTOLOGY || {};

  const integrity = useMemo(() => checkIntegrity(INTENTS, PROJECTIONS, ONTOLOGY), [INTENTS, PROJECTIONS, ONTOLOGY]);

  const issuesByIntent = useMemo(() => {
    const map = {};
    for (const issue of integrity.issues) {
      // Алгебра: "intent1 ⊗ intent2" → пометить оба
      if (issue.intent.includes(" ⊗ ")) {
        const [id1, id2] = issue.intent.split(" ⊗ ");
        if (!map[id1]) map[id1] = [];
        if (!map[id2]) map[id2] = [];
        map[id1].push(issue);
        map[id2].push(issue);
      } else {
        if (!map[issue.intent]) map[issue.intent] = [];
        map[issue.intent].push(issue);
      }
    }
    return map;
  }, [integrity]);

  // Конфликтные рёбра из алгебры
  const algebraConflicts = useMemo(() => {
    return integrity.issues
      .filter(i => i.rule === "algebra_composition" && i.intent.includes(" ⊗ "))
      .map(i => {
        const [id1, id2] = i.intent.split(" ⊗ ");
        return { source: id1, target: id2, detail: i.detail };
      });
  }, [integrity]);

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    // Намерения
    for (const [id, intent] of Object.entries(INTENTS)) {
      const issues = issuesByIntent[id] || [];
      const hasError = issues.some(i => i.level === "error");
      const hasWarning = issues.some(i => i.level === "warning");
      nodes.push({
        id: `intent:${id}`,
        name: `${intent.name} (${id})`,
        type: "intent",
        val: 12,
        color: hasError ? NODE_COLORS.error : hasWarning ? NODE_COLORS.warning : NODE_COLORS.intent,
        issues,
        data: intent,
      });
    }

    // Проекции
    for (const [id, proj] of Object.entries(PROJECTIONS)) {
      nodes.push({
        id: `proj:${id}`,
        name: `📊 ${proj.name}`,
        type: "projection",
        val: 10,
        color: NODE_COLORS.projection,
        data: proj,
      });
    }

    // Сущности из онтологии
    for (const [name, entity] of Object.entries(ONTOLOGY.entities || {})) {
      nodes.push({
        id: `entity:${name}`,
        name: `📦 ${name} (${entity.type})`,
        type: "entity",
        val: 8,
        color: NODE_COLORS.entity,
        data: entity,
      });
    }

    // Рёбра: намерение → сущность (через effects target)
    for (const [id, intent] of Object.entries(INTENTS)) {
      for (const ef of (intent.particles.effects || [])) {
        const base = ef.target.split(".")[0];
        // Найти сущность
        const entityName = Object.keys(ONTOLOGY.entities || {}).find(e =>
          e.toLowerCase() === base || e.toLowerCase() + "s" === base
        );
        if (entityName) {
          links.push({
            source: `intent:${id}`,
            target: `entity:${entityName}`,
            color: "#22c55e44",
            label: ef.α,
          });
        }
      }

      // Рёбра: намерение → намерение (антагонист)
      if (intent.antagonist && INTENTS[intent.antagonist]) {
        links.push({
          source: `intent:${id}`,
          target: `intent:${intent.antagonist}`,
          color: "#f472b644",
          label: "⇌",
        });
      }

      // Рёбра: намерение → сущность (через entities)
      for (const entityStr of (intent.particles.entities || [])) {
        const typeName = entityStr.split(":").pop().trim().replace(/\(.*\)/, "");
        const entityName = Object.keys(ONTOLOGY.entities || {}).find(e => e === typeName);
        if (entityName) {
          links.push({
            source: `intent:${id}`,
            target: `entity:${entityName}`,
            color: "#a78bfa33",
          });
        }
      }
    }

    // Рёбра: проекция → сущность
    for (const [id, proj] of Object.entries(PROJECTIONS)) {
      for (const w of (proj.witnesses || [])) {
        const base = w.split(".")[0];
        const entityName = Object.keys(ONTOLOGY.entities || {}).find(e =>
          e.toLowerCase() === base || e.toLowerCase().startsWith(base)
        );
        if (entityName) {
          links.push({
            source: `proj:${id}`,
            target: `entity:${entityName}`,
            color: "#60a5fa33",
          });
        }
      }
    }

    // Рёбра: конфликты алгебры ⊥ (красные, толстые)
    for (const conflict of algebraConflicts) {
      links.push({
        source: `intent:${conflict.source}`,
        target: `intent:${conflict.target}`,
        color: "#ef4444",
        width: 4,
        label: "⊥",
      });
    }

    return { nodes, links };
  }, [INTENTS, PROJECTIONS, ONTOLOGY, issuesByIntent, algebraConflicts]);

  // 3D граф
  useEffect(() => {
    let graph;
    let destroyed = false;

    import("3d-force-graph").then(mod => {
      if (destroyed || !containerRef.current) return;
      const ForceGraph3D = mod.default;
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();

      graph = new ForceGraph3D()(el)
        .backgroundColor("#1a1a2e")
        .width(rect.width)
        .height(rect.height)
        .nodeLabel("name")
        .nodeVal("val")
        .nodeColor(n => n.color)
        .nodeOpacity(0.9)
        .linkColor(l => l.color)
        .linkWidth(l => l.width || 2)
        .linkDirectionalArrowLength(4)
        .linkDirectionalArrowRelPos(1)
        .onNodeClick(node => setSelectedNode(prev => prev?.id === node.id ? null : node))
        .graphData(graphData);

      graphRef.current = graph;

      const onResize = () => {
        if (containerRef.current && graph) {
          const r = containerRef.current.getBoundingClientRect();
          graph.width(r.width).height(r.height);
        }
      };
      window.addEventListener("resize", onResize);
      graph._resizeHandler = onResize;
    });

    return () => {
      destroyed = true;
      if (graph) window.removeEventListener("resize", graph._resizeHandler);
      if (containerRef.current) containerRef.current.innerHTML = "";
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (graphRef.current) graphRef.current.graphData(graphData);
  }, [graphData]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Сводка целостности */}
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 2px 8px #0002", fontFamily: "system-ui, sans-serif", fontSize: 12, maxWidth: 300 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: integrity.passed ? "#22c55e" : "#ef4444" }}>
          {integrity.passed ? "✓ Целостность OK" : "⚠ Есть проблемы"}
        </div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>{integrity.summary}</div>
        {integrity.issues.length > 0 && (
          <div style={{ marginTop: 8, maxHeight: 300, overflow: "auto" }}>
            {integrity.issues.map((issue, i) => (
              <div key={i} onClick={() => setSelectedNode({ id: `issue:${i}`, name: issue.message, type: "issue", color: issue.level === "error" ? "#ef4444" : "#f59e0b", issues: [issue], data: issue,
                resolutions: getResolutions(issue) })}
                style={{ fontSize: 10, padding: "4px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                  color: issue.level === "error" ? "#ef4444" : issue.level === "warning" ? "#f59e0b" : "#6b7280" }}>
                <span style={{ fontWeight: 600 }}>{issue.intent}</span>: {issue.message}
                <span style={{ marginLeft: 4, fontSize: 9, color: "#9ca3af" }}>→ клик для решения</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Детали узла */}
      {selectedNode && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 2px 8px #0002", fontFamily: "system-ui, sans-serif", fontSize: 12, width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{selectedNode.name}</span>
            <button onClick={() => setSelectedNode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>×</button>
          </div>
          <div style={{ fontSize: 10, color: selectedNode.color, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{selectedNode.type}</div>
          {selectedNode.issues?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {selectedNode.issues.map((issue, i) => (
                <div key={i} style={{ fontSize: 10, padding: "2px 0", color: issue.level === "error" ? "#ef4444" : "#f59e0b" }}>
                  [{issue.rule}] {issue.detail}
                </div>
              ))}
            </div>
          )}
          {/* Инструменты разрешения */}
          {selectedNode.resolutions?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a2e", marginBottom: 4 }}>Варианты решения:</div>
              {selectedNode.resolutions.map((res, i) => (
                <div key={i} style={{ fontSize: 10, padding: "4px 6px", marginBottom: 3, background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>
                  <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{res.icon} {res.label}</div>
                  <div style={{ color: "#6b7280", marginTop: 2 }}>{res.desc}</div>
                </div>
              ))}
            </div>
          )}
          {!selectedNode.resolutions && (
            <pre style={{ fontSize: 9, color: "#6b7280", background: "#f9fafb", padding: 6, borderRadius: 4, overflow: "auto", maxHeight: 150 }}>
              {JSON.stringify(selectedNode.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Легенда */}
      <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, display: "flex", gap: 12, fontSize: 10, fontFamily: "system-ui, sans-serif" }}>
        {[
          { color: NODE_COLORS.intent, label: "намерение" },
          { color: NODE_COLORS.projection, label: "проекция" },
          { color: NODE_COLORS.entity, label: "сущность" },
          { color: NODE_COLORS.warning, label: "warning" },
          { color: NODE_COLORS.error, label: "error" },
        ].map(l => (
          <span key={l.label} style={{ color: l.color, display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
