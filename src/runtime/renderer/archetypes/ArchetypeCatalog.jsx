import { useMemo } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";

export default function ArchetypeCatalog({ slots, ctx: parentCtx }) {
  const { activeKey, activeContext, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);
  const ctx = useMemo(() => ({ ...parentCtx, openOverlay }), [parentCtx, openOverlay]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#f9fafb", position: "relative",
    }}>
      {slots.header?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
        }}>
          <SlotRenderer items={slots.header} ctx={ctx} />
        </div>
      )}

      {slots.toolbar?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
          flexWrap: "wrap",
        }}>
          <SlotRenderer items={slots.toolbar} ctx={ctx} />
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <SlotRenderer item={slots.body} ctx={ctx} />
      </div>

      {slots.fab?.length > 0 && (
        <div style={{
          position: "absolute", bottom: 24, right: 24,
          display: "flex", flexDirection: "column", gap: 8,
          zIndex: 5,
        }}>
          <SlotRenderer items={slots.fab} ctx={ctx} />
        </div>
      )}

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
