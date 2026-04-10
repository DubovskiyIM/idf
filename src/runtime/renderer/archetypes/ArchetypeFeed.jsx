import { useMemo } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";
import { useMediaQuery } from "../hooks.js";

export default function ArchetypeFeed({ slots, ctx: parentCtx }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { activeKey, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);

  // Расширить ctx методом openOverlay — используется IntentButton
  const ctx = useMemo(() => ({ ...parentCtx, openOverlay }), [parentCtx, openOverlay]);

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
          <SlotRenderer items={slots.header} ctx={ctx} />
        </div>
      )}

      {slots.toolbar?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
        }}>
          <SlotRenderer items={slots.toolbar} ctx={ctx} />
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <SlotRenderer item={slots.body} ctx={ctx} />
        </div>

        {isDesktop && slots.context?.length > 0 && (
          <aside style={{
            width: 300, background: "#fff", borderLeft: "1px solid #e5e7eb",
            padding: 16, overflow: "auto",
          }}>
            <SlotRenderer items={slots.context} ctx={ctx} />
          </aside>
        )}
      </div>

      {slots.composer && (
        <SlotRenderer item={slots.composer} ctx={ctx} />
      )}

      <OverlayManager
        activeKey={activeKey}
        overlayMap={overlayMap}
        onClose={closeOverlay}
        ctx={ctx}
      />
    </div>
  );
}
