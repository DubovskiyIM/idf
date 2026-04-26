import React, { useState, useMemo } from "react";
import StudioHeader from "./StudioHeader.jsx";
import StudioTabBar from "./StudioTabBar.jsx";
import SpecPanel from "./SpecPanel.jsx";
import ChatHistory from "./ChatHistory.jsx";
import { ONTOLOGY, INTENTS } from "../domain.js";

/**
 * Meta Studio Canvas — primary-entry projection /meta route.
 * Layout: top header (full-width), под ним 2-pane (chat-history slot
 * 460px + spec-panel grow), composer-input живёт внутри ChatHistory.
 *
 * Контракт renderer'а: первый аргумент — artifact (для main.row), props
 * extends с world / exec / viewer / projection.
 */
export default function MetaStudioCanvas({ artifact, world, exec, viewer, projection }) {
  const [topTab, setTopTab] = useState("spec");

  // mainEntity: Domain. Берём `meta` row из world; fallback к локальным
  // ONTOLOGY/INTENTS counts если world ещё не наполнен.
  const domain = useMemo(() => {
    const all = world?.domains || [];
    return all.find((d) => d.id === "meta") || {
      id: "meta",
      name: "meta",
      title: "Meta · IDF Self-Description",
      description: "Мета-домен: формат IDF описывает сам себя. Domain / Intent / Projection / Pattern / Witness / RRule / Adapter / Capability / BacklogItem. Φ — build-time snapshot из pattern-bank/, src/domains/*, idf-sdk. Level 1 (read) + Level 2 (soft-authoring через compile).",
      entityCount: Object.keys(ONTOLOGY.entities).length,
      intentCount: Object.keys(INTENTS).length,
      roleCount: Object.keys(ONTOLOGY.roles).length,
      invariantCount: (ONTOLOGY.invariants || []).length,
    };
  }, [world]);

  const items = world?.backlogitems || world?.backlogItems || [];

  function handleAdd({ section, title, description }) {
    if (!exec) return;
    exec("add_backlog_item", { section, title, description });
  }

  function handleBack() {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  }

  function handleDelete() {
    if (typeof window !== "undefined") {
      window.alert("Удалить домен — TODO (Level 3, codegen-side).");
    }
  }

  return (
    <div style={{
      // Fullscreen overlay поверх V2Shell side-nav / auth-bar / kit-picker —
      // мета-Studio это primary surface, остальные слои не нужны.
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      background: "#0d0d10", color: "#e8e8ec",
      fontFamily: "Inter, -apple-system, system-ui, sans-serif",
    }}>
      <StudioHeader domain={domain} onBack={handleBack} onDelete={handleDelete} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flexBasis: 460, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <ChatHistory items={items} onAdd={handleAdd} viewer={viewer} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <StudioTabBar active={topTab} onChange={setTopTab} />
          <div style={{ flex: 1, overflow: "hidden" }}>
            {topTab === "spec" && (
              <SpecPanel domain={domain} ontology={ONTOLOGY} intents={INTENTS} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
