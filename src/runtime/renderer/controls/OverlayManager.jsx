import { useState, useCallback, useMemo } from "react";
import FormModal from "./FormModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

const OVERLAY_COMPONENTS = {
  formModal: FormModal,
  confirmDialog: ConfirmDialog,
};

/**
 * Хук, предоставляющий openOverlay/closeOverlay и карту overlays по key.
 * Используется архетипом-контейнером.
 */
export function useOverlayManager(overlays) {
  const [activeKey, setActiveKey] = useState(null);

  const overlayMap = useMemo(() => {
    const map = {};
    for (const o of overlays || []) {
      if (o.key) map[o.key] = o;
    }
    return map;
  }, [overlays]);

  const openOverlay = useCallback((key) => setActiveKey(key), []);
  const closeOverlay = useCallback(() => setActiveKey(null), []);

  return { activeKey, openOverlay, closeOverlay, overlayMap };
}

export default function OverlayManager({ activeKey, overlayMap, onClose, ctx }) {
  if (!activeKey) return null;
  const overlay = overlayMap[activeKey];
  if (!overlay) return null;

  const Component = OVERLAY_COMPONENTS[overlay.type];
  if (!Component) {
    console.warn("[OverlayManager] unknown overlay type:", overlay.type);
    return null;
  }

  return <Component spec={overlay} ctx={ctx} onClose={onClose} />;
}
