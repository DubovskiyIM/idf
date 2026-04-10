import { useState } from "react";
import { ModalShell } from "./FormModal.jsx";
import { template, resolve } from "../eval.js";

export default function ConfirmDialog({ spec, ctx, onClose }) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const message = template(spec.message || "Подтвердить?", ctx.world);
  const expectedText = spec.confirmBy?.expected
    ? resolve(ctx.world, spec.confirmBy.expected) || spec.confirmBy.expected
    : null;

  const canConfirm =
    spec.confirmBy?.type === "typeText"
      ? typed === expectedText
      : true;

  const onConfirm = async () => {
    setSubmitting(true);
    try {
      await ctx.exec(spec.triggerIntentId, {});
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 style={{
        margin: "0 0 12px", fontSize: 18,
        color: spec.irreversibility === "high" ? "#dc2626" : "#1a1a2e",
      }}>
        {spec.title || "Подтверждение"}
      </h2>
      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.5, margin: "0 0 16px" }}>
        {message}
      </p>

      {spec.confirmBy?.type === "typeText" && expectedText && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Введите «{expectedText}» для подтверждения:
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            autoFocus
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 6,
              border: "1px solid #d1d5db", fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db",
            background: "#fff", cursor: "pointer", fontSize: 13,
          }}
        >Отмена</button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm || submitting}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "none",
            background: canConfirm ? "#dc2626" : "#e5e7eb",
            color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: canConfirm && !submitting ? "pointer" : "default",
            opacity: submitting ? 0.6 : 1,
          }}
        >{submitting ? "…" : "Подтвердить"}</button>
      </div>
    </ModalShell>
  );
}
