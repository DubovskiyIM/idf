/**
 * Toast — мини-нотификации для optimistic feedback (D11 / U-polish-1).
 *
 * <ToastProvider> на верхнем уровне CatalogExplorer; useToast() даёт
 * (message, kind?) callback. Toast'ы автоматически исчезают через 3.5s.
 *
 * Kind: "info" | "success" | "error" | "warning". Color = left-border accent.
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastCtx = createContext(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const KIND_COLOR = {
  info:    "#03C3EC",
  success: "#71DD37",
  error:   "#FF3E1D",
  warning: "#FFAB00",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const fire = useCallback((message, kind = "info") => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastCtx.Provider value={fire}>
      {children}
      <div style={{
        position: "fixed", bottom: 16, right: 16, zIndex: 1000,
        display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            style={{
              minWidth: 240, maxWidth: 360,
              padding: "10px 14px",
              background: "var(--idf-card, #fff)",
              color: "var(--idf-text)",
              border: "1px solid var(--idf-border, #e5e7eb)",
              borderLeft: `3px solid ${KIND_COLOR[t.kind] || KIND_COLOR.info}`,
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              fontSize: 13,
              pointerEvents: "auto",
            }}
          >{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
