import { useMemo, useState, useCallback } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";
import { useMediaQuery } from "../hooks.js";
import Icon from "../adapters/Icon.jsx";

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

      <PinnedMessageBanner ctx={ctx} />

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

function PinnedMessageBanner({ ctx }) {
  const messages = ctx.world?.messages || [];
  const pinned = messages.filter(m => m.pinned && m.conversationId === ctx.routeParams?.conversationId);
  if (pinned.length === 0) return null;
  const msg = pinned[pinned.length - 1];
  const senderName = msg.senderName || ((ctx.world?.users || []).find(u => u.id === msg.senderId))?.name || "";

  const handleUnpin = () => {
    ctx.exec("unpin_message", { id: msg.id });
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 16px",
      background: "var(--mantine-color-primary-light, rgba(99,102,241,0.08))",
      borderBottom: "1px solid var(--mantine-color-default-border)",
      fontSize: 12, color: "var(--mantine-color-text)",
    }}>
      <Icon emoji="📌" size={14} />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {senderName && <span style={{ fontWeight: 600, marginRight: 6 }}>{senderName}</span>}
        <span style={{ color: "var(--mantine-color-dimmed)" }}>
          {(msg.content || "").slice(0, 80)}{(msg.content || "").length > 80 ? "…" : ""}
        </span>
      </div>
      <button
        onClick={handleUnpin}
        title="Открепить"
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--mantine-color-dimmed)", fontSize: 14, padding: 4,
        }}
      >✕</button>
    </div>
  );
}
