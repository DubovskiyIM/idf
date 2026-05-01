/**
 * ConfirmDialog — irreversibility confirmation by name-match (D6 / U-polish-1).
 *
 * UX как в gravitino/web-v2 ConfirmInput: пользователь вводит exact name
 * сущности (например "prod_lake") в input → Confirm button становится active.
 * Защита от accidental delete на критичные сущности.
 *
 * Props:
 *   - entityName: exact string для match
 *   - entityKind: "metalake" | "catalog" | "..." — для заголовка
 *   - confirmLabel: default "Delete" — текст красной кнопки
 *   - tone: default "danger" — окрашивает Confirm button красным
 */
import { useEffect, useState } from "react";

export default function ConfirmDialog({
  visible,
  entityName,
  entityKind = "entity",
  confirmLabel = "Delete",
  tone = "danger",
  onCancel = () => {},
  onConfirm = () => {},
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => { if (!visible) setTyped(""); }, [visible]);
  if (!visible) return null;

  const matches = typed === entityName;
  const tonal = tone === "danger" ? "#FF3E1D" : "var(--idf-primary, #6478f7)";

  return (
    <div
      role="dialog"
      aria-label={`Delete ${entityKind}`}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--idf-card, #fff)", color: "var(--idf-text)",
          border: "1px solid var(--idf-border, #e5e7eb)",
          borderRadius: 8, padding: 18, width: 420,
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: tonal }}>
          Delete {entityKind} «{entityName}»?
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--idf-text-muted)", lineHeight: 1.5 }}>
          Действие необратимо. Чтобы подтвердить, введите название —
          {" "}<code style={{
            padding: "1px 6px", background: "var(--idf-bg-subtle, #f9fafb)",
            borderRadius: 3, fontFamily: "monospace", color: tonal,
          }}>{entityName}</code>
          {" "}— в поле ниже.
        </p>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={entityName}
          style={{
            width: "100%", padding: "7px 10px", fontSize: 13, marginBottom: 14,
            border: matches ? `1px solid ${tonal}` : "1px solid var(--idf-border, #e5e7eb)",
            borderRadius: 4, background: "var(--idf-surface, #fff)",
            color: "var(--idf-text)", boxSizing: "border-box",
            fontFamily: "monospace",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 14px", fontSize: 12, borderRadius: 4,
              border: "1px solid var(--idf-border, #e5e7eb)",
              background: "transparent", color: "var(--idf-text-muted)",
              cursor: "pointer",
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches}
            style={{
              padding: "6px 16px", fontSize: 12, fontWeight: 600,
              border: `1px solid ${tonal}`,
              background: matches ? tonal : "rgba(255,62,29,0.4)",
              color: "white", borderRadius: 4,
              cursor: matches ? "pointer" : "not-allowed",
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
