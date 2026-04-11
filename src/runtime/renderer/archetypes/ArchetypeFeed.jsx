import { useMemo, useState, useCallback } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";
import { useMediaQuery } from "../hooks.js";

export default function ArchetypeFeed({ slots, ctx: parentCtx }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { activeKey, activeContext, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);

  // viewState — параметры запроса проекции (§5 манифеста v1.1+)
  const [viewState, setViewStateRaw] = useState({});
  const setViewState = useCallback((key, val) => {
    setViewStateRaw(prev => {
      if (prev[key] === val) return prev;
      return { ...prev, [key]: val };
    });
  }, []);

  // Расширить ctx методом openOverlay + viewState — используется inlineSearch/IntentButton
  const ctx = useMemo(() => ({
    ...parentCtx,
    openOverlay,
    viewState,
    setViewState,
  }), [parentCtx, openOverlay, viewState, setViewState]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--mantine-color-body)",
    }}>
      {slots.header?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px",
          background: "var(--mantine-color-default)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}>
          <SlotRenderer items={slots.header} ctx={ctx} />
        </div>
      )}

      {slots.toolbar?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px",
          background: "var(--mantine-color-default)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
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
            width: 300, background: "var(--mantine-color-default)", borderLeft: "1px solid var(--mantine-color-default-border)",
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
        activeContext={activeContext}
        overlayMap={overlayMap}
        onClose={closeOverlay}
        ctx={ctx}
      />
    </div>
  );
}
