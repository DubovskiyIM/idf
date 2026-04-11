import { useMemo, useState, useCallback } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";

export default function ArchetypeCatalog({ slots, ctx: parentCtx }) {
  const { activeKey, activeContext, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);

  // viewState — параметры запроса проекции (§5 манифеста v1.1+).
  // Эфемерное состояние, не Φ/Δ/Σ/Π. Используется inlineSearch и
  // аналогичными view-filter контролами.
  const [viewState, setViewStateRaw] = useState({});
  const setViewState = useCallback((key, val) => {
    setViewStateRaw(prev => {
      if (prev[key] === val) return prev;
      return { ...prev, [key]: val };
    });
  }, []);

  const ctx = useMemo(() => ({
    ...parentCtx,
    openOverlay,
    viewState,
    setViewState,
  }), [parentCtx, openOverlay, viewState, setViewState]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--mantine-color-body)", position: "relative",
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
          flexWrap: "wrap",
        }}>
          <SlotRenderer items={slots.toolbar} ctx={ctx} />
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {slots.hero?.length > 0 && (
          <div>
            <SlotRenderer items={slots.hero} ctx={ctx} />
          </div>
        )}
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
