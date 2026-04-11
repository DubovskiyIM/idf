import { useState, useCallback, useMemo } from "react";
import FormModal from "./FormModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import BulkWizard from "./BulkWizard.jsx";
// Side-effect imports: виджеты регистрируются в реестр CAPTURE_WIDGETS при
// загрузке модуля. Порядок не важен — матчинг идёт по id из spec.
import "./capture/VoiceRecorder.jsx";
import "./capture/EmojiPicker.jsx";
import "./capture/EntityPicker.jsx";
import { findCaptureWidgetById } from "./capture/registry.js";

const OVERLAY_COMPONENTS = {
  formModal: FormModal,
  confirmDialog: ConfirmDialog,
  bulkWizard: BulkWizard,
};

/**
 * Хук, предоставляющий openOverlay/closeOverlay и карту overlays по key.
 * openOverlay принимает опциональный контекст (например { item }), который
 * пробрасывается в рендеримый overlay как prop `context`.
 */
export function useOverlayManager(overlays) {
  const [active, setActive] = useState(null); // { key, context }

  const overlayMap = useMemo(() => {
    const map = {};
    for (const o of overlays || []) {
      if (o.key) map[o.key] = o;
    }
    return map;
  }, [overlays]);

  const openOverlay = useCallback((key, context = {}) => setActive({ key, context }), []);
  const closeOverlay = useCallback(() => setActive(null), []);

  return {
    activeKey: active?.key || null,
    activeContext: active?.context || {},
    openOverlay,
    closeOverlay,
    overlayMap,
  };
}

export default function OverlayManager({ activeKey, activeContext, overlayMap, onClose, ctx }) {
  if (!activeKey) return null;
  const overlay = overlayMap[activeKey];
  if (!overlay) return null;

  // customCapture: резолвим React-компонент виджета из реестра по widgetId,
  // который кристаллизатор кладёт в overlay.widgetId.
  if (overlay.type === "customCapture") {
    const widget = findCaptureWidgetById(overlay.widgetId);
    if (!widget) {
      console.warn("[OverlayManager] unknown capture widget:", overlay.widgetId);
      return null;
    }
    const Widget = widget.component;
    return <Widget spec={overlay} ctx={ctx} overlayContext={activeContext} onClose={onClose} />;
  }

  const Component = OVERLAY_COMPONENTS[overlay.type];
  if (!Component) {
    console.warn("[OverlayManager] unknown overlay type:", overlay.type);
    return null;
  }

  return <Component spec={overlay} ctx={ctx} overlayContext={activeContext} onClose={onClose} />;
}
