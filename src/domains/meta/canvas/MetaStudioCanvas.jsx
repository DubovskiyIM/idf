import React, { useState, useMemo } from "react";
import StudioHeader from "./StudioHeader.jsx";
import StudioTabBar from "./StudioTabBar.jsx";
import SpecPanel from "./SpecPanel.jsx";
import ChatHistory from "./ChatHistory.jsx";
import ChangesTab from "./ChangesTab.jsx";
import LiveTab from "./LiveTab.jsx";
import ChannelsTab from "./ChannelsTab.jsx";
import AuditTab from "./AuditTab.jsx";
import AccessTab from "./AccessTab.jsx";
import DeploysTab from "./DeploysTab.jsx";
import SnapshotsTab from "./SnapshotsTab.jsx";
import { ONTOLOGY, INTENTS } from "../domain.js";
import snapshotMod from "../meta-snapshot.js";

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
      // Fills the V2Shell main area (не fixed) — оставляет side-nav доступной
      // для перехода в Pattern Bank / Backlog / другие projections meta-домена.
      display: "flex", flexDirection: "column",
      minHeight: "calc(100vh - 56px)", height: "calc(100vh - 56px)",
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
          <div style={{ flex: 1, overflow: "auto" }}>
            {topTab === "spec" && <SpecPanel domain={domain} ontology={ONTOLOGY} intents={INTENTS} />}
            {topTab === "changes" && <ChangesTab items={items} />}
            {topTab === "live" && <LiveTab />}
            {topTab === "channels" && <ChannelsTab />}
            {topTab === "audit" && <AuditTab ontology={ONTOLOGY} />}
            {topTab === "access" && <AccessTab ontology={ONTOLOGY} intents={INTENTS} />}
            {topTab === "deploys" && <DeploysTab adapters={snapshotMod?.adapters || []} />}
            {topTab === "snapshots" && <SnapshotsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
