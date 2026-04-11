import { useMemo } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";

/**
 * Detail-архетип: показывает одну сущность по mainEntity+idParam из routeParams.
 * Body рендерится с contextItem = target — все bind'ы резолвятся без префикса.
 */
export default function ArchetypeDetail({ slots, ctx: parentCtx, projection }) {
  const { activeKey, activeContext, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);
  const ctx = useMemo(() => ({ ...parentCtx, openOverlay }), [parentCtx, openOverlay]);

  const target = useMemo(() => {
    const mainEntity = projection?.mainEntity;
    const idParam = projection?.idParam;
    if (!mainEntity || !idParam) return null;
    const collection = pluralize(mainEntity.toLowerCase());
    const list = parentCtx.world?.[collection] || [];
    const id = parentCtx.routeParams?.[idParam];
    if (!id) return null;
    return list.find(e => e.id === id) || null;
  }, [projection, parentCtx.world, parentCtx.routeParams]);

  if (!target) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Сущность не найдена: {projection?.mainEntity} id={parentCtx.routeParams?.[projection?.idParam]}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#f9fafb",
    }}>
      {slots.header?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
        }}>
          <SlotRenderer items={slots.header} ctx={ctx} contextItem={target} />
        </div>
      )}

      {slots.toolbar?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
          flexWrap: "wrap",
        }}>
          <SlotRenderer items={slots.toolbar} ctx={ctx} contextItem={target} />
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{
          maxWidth: 640, margin: "0 auto", background: "#fff",
          borderRadius: 12, padding: 24, border: "1px solid #e5e7eb",
        }}>
          <SlotRenderer item={slots.body} ctx={ctx} contextItem={target} />
        </div>
      </div>

      <OverlayManager
        activeKey={activeKey}
        activeContext={activeContext}
        overlayMap={overlayMap}
        onClose={closeOverlay}
        ctx={ctx}
      />
    </div>
  );
}

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}
