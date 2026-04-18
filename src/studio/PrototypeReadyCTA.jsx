import React from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * PrototypeReadyCTA — появляется после `done`-события Claude'а и только если
 * в домене уже что-то есть (intents или entities). Предлагает открыть
 * прототип в новом табе.
 */
export default function PrototypeReadyCTA({ visible, domain, intentsCount, entitiesCount, onDismiss }) {
  const isEmpty = (intentsCount || 0) === 0 && (entitiesCount || 0) === 0;
  const show = visible && domain && !isEmpty;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
            border: "1px solid #10b981",
            borderRadius: 12,
            padding: "14px 20px",
            color: "#ecfdf5",
            fontSize: 13,
            boxShadow: "0 12px 40px rgba(16, 185, 129, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            maxWidth: 520,
          }}
        >
          <div style={{ fontSize: 22 }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              Прототип «{domain}» готов
            </div>
            <div style={{ fontSize: 11, color: "#a7f3d0" }}>
              {intentsCount} intents · {entitiesCount} entities · UI деривирован из projections
            </div>
          </div>
          <a
            href={`/?domain=${encodeURIComponent(domain)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "8px 16px",
              background: "#ecfdf5",
              color: "#065f46",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Открыть прототип →
          </a>
          <button
            onClick={onDismiss}
            title="Скрыть"
            style={{
              background: "transparent",
              border: "none",
              color: "#a7f3d0",
              cursor: "pointer",
              fontSize: 18,
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
