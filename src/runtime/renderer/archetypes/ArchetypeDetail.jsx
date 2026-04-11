import { useMemo } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";

/**
 * Detail-архетип: показывает одну сущность по mainEntity+idParam из routeParams.
 * Body рендерится с contextItem = target — все bind'ы резолвятся без префикса.
 */
export default function ArchetypeDetail({ slots, nav, ctx: parentCtx, projection }) {
  const { activeKey, activeContext, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);
  const ctx = useMemo(() => ({ ...parentCtx, openOverlay }), [parentCtx, openOverlay]);

  // Role check (M3.5b): editEdge показываем только если viewer владеет
  // сущностью. Для User mainEntity — собственный профиль (target.id === viewer.id).
  // Чужой user_profile не должен давать кнопку редактирования.
  const isViewerOwner = (target) => {
    if (!target || !parentCtx.viewer?.id) return false;
    const mainEntity = projection?.mainEntity;
    if (mainEntity === "User") return target.id === parentCtx.viewer.id;
    // По умолчанию считаем non-owner для незнакомых сущностей —
    // расширим логику, когда появятся другие editable detail-проекции.
    return target.id === parentCtx.viewer.id;
  };

  // Edit-action edge: если в nav есть исходящее ребро kind:"edit-action",
  // показываем кнопку «Редактировать» в header, которая навигирует в form-проекцию.
  const editEdge = (nav?.outgoing || []).find(e => e.kind === "edit-action");
  const onEditClick = () => {
    if (!editEdge || !parentCtx.navigate) return;
    // params могут содержать "routeParams.userId" — разрешить
    const resolvedParams = {};
    for (const [k, v] of Object.entries(editEdge.params || {})) {
      if (typeof v === "string" && v.startsWith("routeParams.")) {
        resolvedParams[k] = parentCtx.routeParams?.[v.slice("routeParams.".length)];
      } else {
        resolvedParams[k] = v;
      }
    }
    parentCtx.navigate(editEdge.to, resolvedParams);
  };

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

  const canEdit = editEdge && isViewerOwner(target);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#f9fafb",
    }}>
      {(slots.header?.length > 0 || canEdit) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
        }}>
          <SlotRenderer items={slots.header} ctx={ctx} contextItem={target} />
          <div style={{ flex: 1 }} />
          {canEdit && (
            <button
              onClick={onEditClick}
              title="Редактировать"
              style={{
                padding: "6px 14px", borderRadius: 6, border: "1px solid #6366f1",
                background: "#eef2ff", color: "#6366f1", fontSize: 13,
                fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>✎</span>
              <span>Редактировать</span>
            </button>
          )}
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
