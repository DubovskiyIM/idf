/**
 * PolicyDetailCanvas — canvas-обёртка для PolicyDetailPane (U-polish-3, B15)
 * + Metadata Objects tab (U-tag-policy-objects).
 *
 * Читает routeParams.policyId, ищет Policy в world.policies (по id или name).
 * Tabs: Rules / Metadata Objects / Properties — Rules/Properties делегируем
 * PolicyDetailPane (там свой внутренний tab-bar), Metadata Objects → новый
 * MetadataObjectsPane (reverse-lookup entities с этой policy + Unlink).
 *
 * Unlink → exec("associatePoliciesForObject", { entity, entityType:
 * collectionKey, policies: filteredList }) — domain.js custom buildEffects
 * overwrite by entity.id.
 */
import { useState } from "react";
import PolicyDetailPane from "./PolicyDetailPane.jsx";
import MetadataObjectsPane from "./MetadataObjectsPane.jsx";

const TABS = [
  { key: "rules", label: "Rules" },
  { key: "objects", label: "Metadata Objects" },
  { key: "properties", label: "Properties" },
];

export default function PolicyDetailCanvas({ world = {}, routeParams, ctx, exec = () => {} }) {
  const params = routeParams ?? ctx?.routeParams ?? {};
  const policyId = params.policyId;
  const policy = (world.policies || []).find(p => p.id === policyId || p.name === policyId);
  const [active, setActive] = useState("rules");
  if (!policy) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)" }}>
        Policy не найдена (id: {String(policyId)})
      </div>
    );
  }
  const metalakeName = (world.metalakes || [])[0]?.name || "default";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        display: "flex",
        padding: "10px 16px",
        borderBottom: "1px solid var(--idf-border, #e5e7eb)",
        background: "var(--idf-card, #fff)",
        gap: 16,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: active === t.key ? 600 : 400,
              color: active === t.key ? "var(--idf-primary, #6478f7)" : "var(--idf-text)",
              padding: "4px 0",
              borderBottom: active === t.key
                ? "2px solid var(--idf-primary, #6478f7)"
                : "2px solid transparent",
            }}
          >{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {active === "objects" ? (
          <MetadataObjectsPane
            kind="policy"
            name={policy.name}
            world={world}
            onUnlink={({ entityType, collectionKey, entity }) => {
              const newPolicies = (entity.policies || []).filter(n => n !== policy.name);
              exec("associatePoliciesForObject", {
                entity,
                entityType: collectionKey,
                policies: newPolicies,
                metalake: metalakeName,
                metadataObjectType: entityType,
                metadataObjectFullName: entity.name,
              });
            }}
          />
        ) : (
          <PolicyDetailPane policy={policy} />
        )}
      </div>
    </div>
  );
}
